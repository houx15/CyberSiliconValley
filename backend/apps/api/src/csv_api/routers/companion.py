from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai.providers.router import ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from ai.workflows.companion import run_companion_workflow_streaming
from contracts.auth import AuthUser
from contracts.chat import CompanionRequest, StreamEvent
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from db.models.chat_session import ChatSession
from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.match import Match
from db.models.memory_space import MemorySpace
from db.models.pre_chat import PreChat
from db.repositories.chat import (
    get_or_create_chat_session,
    load_chat_history,
    save_chat_message,
)
from db.repositories.profiles import get_talent_profile_by_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/companion", tags=["companion"])


@router.post("")
async def companion_chat(
    payload: CompanionRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    user_id = UUID(current_user.id)
    is_ai_hr = payload.persona == "ai-hr" and current_user.role == "enterprise"
    session_prefix = "ai-hr" if is_ai_hr else "companion"
    session_type = payload.session_type if payload.session_type in {"general", "home", "coach"} else "general"
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type=f"{session_prefix}:{session_type}")

    # Extract latest user message
    latest_user_message = _extract_latest_user_message(payload)
    if latest_user_message:
        save_chat_message(session, session_id=chat_session.id, role="user", content=latest_user_message)
        session.commit()

    # Load profile — enterprise for AI HR, talent for buddy
    if is_ai_hr:
        from db.repositories.profiles import get_enterprise_profile_by_user_id
        ep = get_enterprise_profile_by_user_id(session, user_id)
        profile_json = json.dumps({
            "companyName": ep.company_name if ep else "",
            "industry": ep.industry if ep else "",
            "description": ep.description if ep else "",
        }, ensure_ascii=False, default=str) if ep else "{}"
        memory_scope = "enterprise_global"
    else:
        profile = get_talent_profile_by_user_id(session, user_id)
        profile_json = _profile_to_json(profile) if profile else "{}"
        memory_scope = "talent_global"

    # Load memory
    memory_entries = _load_memory_entries(session, user_id, scope=memory_scope)

    # Load conversation history
    history = _load_history(session, chat_session.id)

    # Stream real LLM response
    async def generate():
        full_text = ""
        try:
            async for event in run_companion_workflow_streaming(
                provider_router,
                messages=history,
                profile_json=profile_json,
                memory_entries=memory_entries,
                function_mode=payload.function_mode,
            ):
                if event.event == "text":
                    full_text += event.data.get("delta", "")
                yield event
        finally:
            if full_text:
                save_chat_message(session, session_id=chat_session.id, role="assistant", content=full_text)
                session.commit()

    return stream_async_events_as_sse(generate())


def _extract_latest_user_message(payload: CompanionRequest) -> str:
    for message in reversed(payload.messages):
        text = "".join(
            part.text or "" for part in message.parts or [] if part.type == "text"
        ).strip() or (message.content or "").strip()
        if message.role == "user" and text:
            return text
    return ""


def _load_history(session: Session, chat_session_id) -> list[dict[str, str]]:
    rows = load_chat_history(session, session_id=chat_session_id)
    return [{"role": row.role, "content": row.content} for row in rows[-50:]]


def _profile_to_json(profile) -> str:
    return json.dumps({
        "displayName": profile.display_name,
        "headline": profile.headline,
        "bio": profile.bio,
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "education": profile.education or [],
        "goals": profile.goals or {},
        "availability": profile.availability,
    }, ensure_ascii=False, default=str)


def _load_memory_entries(session: Session, user_id: UUID, scope: str = "talent_global") -> list[dict]:
    stmt = select(MemorySpace).where(
        MemorySpace.owner_id == user_id,
        MemorySpace.scope_type == scope,
    ).limit(1)
    space = session.execute(stmt).scalar_one_or_none()
    if space is None:
        return []
    return space.entries or []


@router.get("/sessions")
def list_companion_sessions(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    """List all companion chat sessions for the current user."""
    user_id = UUID(current_user.id)
    stmt = (
        select(ChatSession)
        .where(
            ChatSession.user_id == user_id,
            ChatSession.session_type.like("companion:%"),
        )
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = list(session.execute(stmt).scalars())
    return [
        {
            "id": str(s.id),
            "title": _session_title(s),
            "mode": s.session_type.replace("companion:", ""),
            "updatedAt": s.updated_at.isoformat() if s.updated_at else "",
        }
        for s in sessions
    ]


def _session_title(s: ChatSession) -> str:
    mode = s.session_type.replace("companion:", "")
    titles = {
        "general": "General Chat",
        "home": "Home Assistant",
        "coach": "Coach Chat",
        "profile": "Profile Update",
        "questions": "Career Q&A",
        "analysis": "Opportunity Analysis",
    }
    return titles.get(mode, f"Chat ({mode})")


@router.get("/opportunities")
def list_opportunities(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    """List matched opportunities for the talent's buddy report tab."""
    user_id = UUID(current_user.id)
    profile = get_talent_profile_by_user_id(session, user_id)
    if profile is None:
        return []

    talent_skills = {s.get("name", "").lower() for s in (profile.skills or [])}

    # Join matches with jobs and enterprise profiles
    stmt = (
        select(Match, Job, EnterpriseProfile)
        .join(Job, Match.job_id == Job.id)
        .join(EnterpriseProfile, Job.enterprise_id == EnterpriseProfile.id)
        .where(Match.talent_id == profile.id)
        .order_by(Match.score.desc())
        .limit(50)
    )
    rows = session.execute(stmt).all()

    results = []
    for match, job, enterprise in rows:
        # Determine opportunity status from match + prechat state
        opp_status = _opportunity_status(session, match, profile.id)

        # Build skill match info
        job_skills = [s.get("name", "") for s in (job.structured or {}).get("skills", [])]
        skills_matched = [
            {"name": s, "matched": s.lower() in talent_skills}
            for s in job_skills
        ]

        # Get prechat summary if exists
        prechat_summary = None
        prechat = session.execute(
            select(PreChat).where(
                PreChat.job_id == job.id,
                PreChat.talent_id == profile.id,
            ).limit(1)
        ).scalar_one_or_none()
        if prechat and prechat.ai_summary:
            prechat_summary = prechat.ai_summary

        results.append({
            "id": str(match.id),
            "companyName": enterprise.company_name or "",
            "jobTitle": job.title,
            "opportunityType": (job.structured or {}).get("focusCategory", "fulltime"),
            "location": (job.structured or {}).get("location", ""),
            "workMode": (job.structured or {}).get("workMode", "remote"),
            "matchScore": round(match.score or 0),
            "status": opp_status,
            "aiAssessment": match.ai_reasoning or "",
            "skills": skills_matched,
            "preChatSummary": prechat_summary,
            "updatedAt": match.created_at.isoformat() if match.created_at else "",
        })

    return results


def _opportunity_status(session: Session, match: Match, talent_id) -> str:
    """Derive opportunity status from match status + prechat state."""
    if match.status == "invited":
        return "action_needed"
    if match.status in ("shortlisted", "applied"):
        # Check if prechat exists
        prechat = session.execute(
            select(PreChat).where(
                PreChat.job_id == match.job_id,
                PreChat.talent_id == talent_id,
            ).limit(1)
        ).scalar_one_or_none()
        if prechat:
            if prechat.status == "completed":
                return "pre_chat_done"
            if prechat.status == "active":
                return "pre_chat"
        return "enterprise_inquiry"
    return "screened"
