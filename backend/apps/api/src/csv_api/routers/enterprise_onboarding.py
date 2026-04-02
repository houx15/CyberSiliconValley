from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ai.providers.router import ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from ai.workflows.enterprise_onboarding import run_enterprise_onboarding_streaming
from contracts.auth import AuthUser
from contracts.chat import SimpleChatRequest, StreamEvent
from core.profiles.onboarding import apply_onboarding_update
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from db.repositories.chat import (
    get_or_create_chat_session,
    load_chat_history,
    save_chat_message,
)
from db.repositories.jobs import create_job
from db.repositories.profiles import get_enterprise_profile_by_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/enterprise/onboarding", tags=["enterprise-onboarding"])


@router.post("/chat")
async def enterprise_onboarding_chat(
    payload: SimpleChatRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_id = UUID(current_user.id)
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type="enterprise_onboarding")
    save_chat_message(session, session_id=chat_session.id, role="user", content=payload.message)
    session.commit()

    history = _load_history(session, chat_session.id)

    async def generate():
        full_text = ""
        tool_events: list[dict] = []
        async for event in run_enterprise_onboarding_streaming(
            provider_router, messages=history
        ):
            if event.event == "text":
                full_text += event.data.get("delta", "")
            elif event.event == "tool":
                tool_events.append(event.data)
            yield event

        # Save assistant response
        if full_text:
            save_chat_message(session, session_id=chat_session.id, role="assistant", content=full_text)

        # Apply tool events
        _apply_tool_events(session, current_user, user_id, tool_events)
        session.commit()

    return stream_async_events_as_sse(generate())


def _load_history(session: Session, chat_session_id) -> list[dict[str, str]]:
    rows = load_chat_history(session, session_id=chat_session_id)
    return [{"role": row.role, "content": row.content} for row in rows[-30:]]


def _apply_tool_events(session: Session, current_user: AuthUser, user_id: UUID, tool_events: list[dict]):
    """Process tool events from the LLM and apply them to the database."""
    profile_updates: dict = {}
    complete = False

    for event in tool_events:
        name = event.get("name")

        if name == "set_company_profile":
            if event.get("companyName"):
                profile_updates["company_name"] = event["companyName"]
            if event.get("industry"):
                profile_updates["industry"] = event["industry"]
            if event.get("companySize"):
                profile_updates["company_size"] = event["companySize"]
            if event.get("website"):
                profile_updates["website"] = event["website"]
            if event.get("description"):
                profile_updates["description"] = event["description"]
            if event.get("aiMaturity"):
                profile_updates["ai_maturity"] = event["aiMaturity"]

        elif name == "create_job":
            enterprise_profile = get_enterprise_profile_by_user_id(session, user_id)
            if enterprise_profile:
                create_job(
                    session,
                    enterprise_id=enterprise_profile.id,
                    title=event.get("title", "Untitled Role"),
                    description=event.get("description", ""),
                    structured={
                        "skills": event.get("skills", []),
                        "seniority": event.get("seniority", "Mid"),
                        "workMode": event.get("workMode", "remote"),
                    },
                    auto_match=True,
                    auto_prechat=False,
                )

        elif name == "complete_onboarding":
            complete = True

    if profile_updates or complete:
        apply_onboarding_update(session, current_user, profile_updates, complete=complete)
