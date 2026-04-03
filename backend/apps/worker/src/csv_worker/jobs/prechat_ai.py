from __future__ import annotations

import os
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ai.prompts.prechat import build_ai_hr_prompt, build_ai_talent_prompt
from ai.providers.claude import AnthropicProvider
from ai.providers.openai_compat import OpenAICompatProvider
from ai.providers.router import ProviderRouter
from ai.workflows.prechat_ai import generate_prechat_summary, run_ai_prechat_round
from db.models.enterprise_profile import EnterpriseProfile
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.pre_chat import PreChat, PreChatMessage
from db.models.talent_profile import TalentProfile
from db.session import create_engine_from_url, create_session_factory, session_scope


def _create_provider_router() -> ProviderRouter:
    """Create ProviderRouter from environment variables (worker context, no FastAPI DI)."""
    api_key = os.getenv("AI_API_KEY", "")
    if not api_key:
        return ProviderRouter()

    protocol = os.getenv("AI_PROTOCOL", "anthropic")
    model = os.getenv("AI_MODEL", "")
    base_url = os.getenv("AI_BASE_URL", "")

    if protocol == "anthropic":
        provider = AnthropicProvider(
            api_key=api_key,
            model=model or "claude-sonnet-4-20250514",
            base_url=base_url or None,
        )
    else:
        provider = OpenAICompatProvider(
            api_key=api_key,
            model=model or "gpt-4o",
            base_url=base_url or "https://api.openai.com/v1",
        )
    return ProviderRouter(provider=provider)


def _load_prechat_context(session: Session, pre_chat_id: UUID) -> tuple[PreChat, Job, TalentProfile, EnterpriseProfile]:
    """Load all entities needed for the AI pre-chat."""
    pc = session.get(PreChat, pre_chat_id)
    if pc is None:
        raise ValueError(f"PreChat {pre_chat_id} not found")

    job = session.get(Job, pc.job_id)
    if job is None:
        raise ValueError(f"Job {pc.job_id} not found")

    talent = session.get(TalentProfile, pc.talent_id)
    if talent is None:
        raise ValueError(f"TalentProfile {pc.talent_id} not found")

    enterprise = session.get(EnterpriseProfile, pc.enterprise_id)
    if enterprise is None:
        raise ValueError(f"EnterpriseProfile {pc.enterprise_id} not found")

    return pc, job, talent, enterprise


def _load_existing_messages(session: Session, pre_chat_id: UUID) -> list[PreChatMessage]:
    """Load existing pre-chat messages in stable round order."""
    stmt = (
        select(PreChatMessage)
        .where(PreChatMessage.pre_chat_id == pre_chat_id)
        .order_by(PreChatMessage.round_number, PreChatMessage.id)
    )
    return list(session.execute(stmt).scalars())


def _messages_to_history(messages: list[PreChatMessage], perspective: str) -> list[dict[str, str]]:
    """Convert PreChatMessages to LLM conversation history.

    Maps sender types by side:
    - HR perspective: ai_hr & human_enterprise → "assistant", ai_talent & human_talent → "user"
    - Talent perspective: ai_talent & human_talent → "assistant", ai_hr & human_enterprise → "user"
    """
    HR_SIDE = {"ai_hr", "human_enterprise"}
    TALENT_SIDE = {"ai_talent", "human_talent"}
    history: list[dict[str, str]] = []
    for msg in messages:
        if perspective == "ai_hr":
            role = "assistant" if msg.sender_type in HR_SIDE else "user"
        else:
            role = "assistant" if msg.sender_type in TALENT_SIDE else "user"
        history.append({"role": role, "content": msg.content})
    return history


def _get_user_id_for_profile(session: Session, profile_table: type, profile_id: UUID) -> UUID | None:
    """Look up the user_id for a talent or enterprise profile."""
    stmt = select(profile_table.user_id).where(profile_table.id == profile_id)
    return session.execute(stmt).scalar_one_or_none()


async def run_ai_prechat(ctx: dict[str, object], payload: dict[str, str]) -> dict[str, str]:
    """Worker task: run a multi-round AI-to-AI pre-chat conversation.

    Resumable: if the task fails mid-way, it can be retried and will
    pick up from the current round_count.
    """
    pre_chat_id = UUID(payload["pre_chat_id"])
    provider_router = _create_provider_router()
    engine = create_engine_from_url()
    factory = create_session_factory(engine)

    try:
        # --- Short transaction 1: claim ownership and load context ---
        with session_scope(factory) as session:
            locked = session.execute(
                select(PreChat).where(PreChat.id == pre_chat_id).with_for_update()
            ).scalar_one_or_none()
            if locked is None:
                return {"pre_chat_id": str(pre_chat_id), "status": "not_found"}
            if locked.status != "ai_screening":
                return {"pre_chat_id": str(pre_chat_id), "status": "skipped", "reason": f"status is '{locked.status}'"}

            pc, job, talent, enterprise = _load_prechat_context(session, pre_chat_id)

            # Snapshot immutable context for use outside transaction
            talent_name = talent.display_name or "Candidate"
            company_name = enterprise.company_name or "Company"
            job_title = job.title
            job_description = job.description or ""
            job_structured = job.structured or {}
            max_rounds = pc.max_rounds
            start_round = pc.round_count + 1
            talent_id = pc.talent_id
            enterprise_id = pc.enterprise_id

            talent_prompt = build_ai_talent_prompt(
                talent_name=talent_name,
                headline=talent.headline,
                skills=talent.skills or [],
                experience=talent.experience or [],
                goals=talent.goals or {},
                availability=talent.availability,
                salary_range=talent.salary_range,
            )

            existing_messages = _load_existing_messages(session, pre_chat_id)
            # Detach message data for use outside session
            history_cache = [
                SimpleNamespace(sender_type=m.sender_type, content=m.content)
                for m in existing_messages
            ]
            # Transaction commits here, releasing the lock

        # --- Round loop: AI calls outside transactions ---
        for round_num in range(start_round, max_rounds + 1):
            round_hr_prompt = build_ai_hr_prompt(
                company_name=company_name,
                job_title=job_title,
                job_description=job_description,
                job_structured=job_structured,
                round_number=round_num,
                max_rounds=max_rounds,
            )

            # AI HR asks (no DB lock held)
            hr_history = _messages_to_history(history_cache, "ai_hr")
            hr_response = await run_ai_prechat_round(
                provider_router, role="ai_hr",
                conversation_history=hr_history, system_prompt=round_hr_prompt,
            )
            history_cache.append(SimpleNamespace(sender_type="ai_hr", content=hr_response))

            # AI Talent responds (no DB lock held)
            talent_history = _messages_to_history(history_cache, "ai_talent")
            talent_response = await run_ai_prechat_round(
                provider_router, role="ai_talent",
                conversation_history=talent_history, system_prompt=talent_prompt,
            )
            history_cache.append(SimpleNamespace(sender_type="ai_talent", content=talent_response))

            # --- Short transaction: persist round results with guarded update ---
            with session_scope(factory) as session:
                # Claim round atomically: only if still ai_screening at expected round
                from sqlalchemy import update as sa_update
                result = session.execute(
                    sa_update(PreChat)
                    .where(
                        PreChat.id == pre_chat_id,
                        PreChat.status == "ai_screening",
                        PreChat.round_count == round_num - 1,
                    )
                    .values(round_count=round_num)
                )
                if result.rowcount == 0:
                    return {"pre_chat_id": str(pre_chat_id), "status": "aborted", "reason": "ownership lost"}

                session.add(PreChatMessage(
                    pre_chat_id=pre_chat_id, sender_type="ai_hr",
                    content=hr_response, round_number=round_num,
                ))
                session.add(PreChatMessage(
                    pre_chat_id=pre_chat_id, sender_type="ai_talent",
                    content=talent_response, round_number=round_num,
                ))
                session.commit()

        # --- Summary: AI call outside transaction ---
        conversation_for_summary = [
            {"role": m.sender_type, "content": m.content}
            for m in history_cache
        ]
        summary = await generate_prechat_summary(
            provider_router,
            company_name=company_name,
            job_title=job_title,
            talent_name=talent_name,
            conversation=conversation_for_summary,
        )

        # --- Short transaction: finalize ---
        with session_scope(factory) as session:
            pc = session.get(PreChat, pre_chat_id)
            if pc is None or pc.status != "ai_screening":
                return {"pre_chat_id": str(pre_chat_id), "status": "aborted", "reason": "ownership lost"}

            pc.ai_summary = summary
            pc.status = "pending_talent_review"

            talent_user_id = _get_user_id_for_profile(session, TalentProfile, talent_id)
            enterprise_user_id = _get_user_id_for_profile(session, EnterpriseProfile, enterprise_id)

            inbox_content = {
                "preChatId": str(pre_chat_id),
                "jobTitle": job_title,
                "summary": summary[:200],
            }

            if talent_user_id:
                session.add(InboxItem(
                    user_id=talent_user_id,
                    item_type="prechat_summary",
                    title=f"{company_name} 的 AI 预沟通已完成，请查看并决定是否继续",
                    content={**inbox_content, "companyName": company_name, "action": "review"},
                ))

            if enterprise_user_id:
                session.add(InboxItem(
                    user_id=enterprise_user_id,
                    item_type="prechat_summary",
                    title=f"与 {talent_name} 的 AI 预沟通已完成，等待候选人确认",
                    content={**inbox_content, "talentName": talent_name},
                ))

            session.commit()

        return {"pre_chat_id": str(pre_chat_id), "status": "pending_talent_review", "rounds": str(max_rounds)}
    finally:
        engine.dispose()
