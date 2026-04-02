from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ai.providers.router import ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from ai.workflows.onboarding import run_onboarding_workflow_streaming
from contracts.auth import AuthUser
from contracts.chat import SimpleChatRequest, StreamEvent
from contracts.profile import OnboardingResponse, OnboardingUpdateRequest
from core.profiles.onboarding import apply_onboarding_update
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from db.repositories.chat import (
    get_or_create_chat_session,
    load_chat_history,
    save_chat_message,
)
from db.repositories.profiles import get_talent_profile_by_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.patch("", response_model=OnboardingResponse)
def patch_onboarding(
    payload: OnboardingUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OnboardingResponse:
    profile, onboarding_done = apply_onboarding_update(
        session,
        current_user,
        payload.profile,
        complete=payload.complete,
    )
    session.commit()
    return OnboardingResponse(profile=profile, onboarding_done=onboarding_done)


@router.post("/chat")
async def onboarding_chat(
    payload: SimpleChatRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    if current_user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_id = UUID(current_user.id)
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type="onboarding")

    # Save user message
    save_chat_message(session, session_id=chat_session.id, role="user", content=payload.message)
    session.commit()

    # Build conversation history from DB
    history = _load_history(session, chat_session.id)

    # Stream real LLM response
    async def generate():
        full_text = ""
        tool_events: list[dict] = []
        try:
            async for event in run_onboarding_workflow_streaming(
                provider_router, messages=history
            ):
                if event.event == "text":
                    full_text += event.data.get("delta", "")
                elif event.event == "tool":
                    tool_events.append(event.data)
                yield event
        finally:
            # Persist even if client disconnects mid-stream
            if full_text:
                save_chat_message(session, session_id=chat_session.id, role="assistant", content=full_text)

            profile_updates = _extract_profile_updates(tool_events)
            complete = any(t.get("name") == "complete_onboarding" for t in tool_events)
            if profile_updates or complete:
                apply_onboarding_update(session, current_user, profile_updates, complete=complete)

            session.commit()

    return stream_async_events_as_sse(generate())


def _load_history(session: Session, chat_session_id) -> list[dict[str, str]]:
    """Load conversation history from DB for LLM context."""
    rows = load_chat_history(session, session_id=chat_session_id)
    return [{"role": row.role, "content": row.content} for row in rows[-50:]]


def _extract_profile_updates(tool_events: list[dict]) -> dict:
    """Convert tool events into profile update dict."""
    updates: dict = {}
    skills: list[dict] = []

    for event in tool_events:
        name = event.get("name")
        if name == "reveal_profile_field":
            field = event.get("field")
            value = event.get("value")
            if field and value is not None:
                if field == "displayName":
                    updates["display_name"] = value
                elif field == "headline":
                    updates["headline"] = value
                elif field == "bio":
                    updates["bio"] = value
                elif field == "experience":
                    existing = updates.get("experience", [])
                    if isinstance(value, dict):
                        existing.append(value)
                    elif isinstance(value, list):
                        existing.extend(value)
                    updates["experience"] = existing
                elif field == "goals":
                    updates["goals"] = value
        elif name == "add_skill_tag":
            skills.append({
                "name": event.get("skillName", ""),
                "level": event.get("level", "intermediate"),
                "category": event.get("category", "general"),
            })

    if skills:
        updates["skills"] = skills

    return updates
