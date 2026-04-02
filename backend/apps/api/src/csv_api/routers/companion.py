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
from db.models.memory_space import MemorySpace
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
    session_type = payload.session_type if payload.session_type in {"general", "home", "coach"} else "general"
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type=f"companion:{session_type}")

    # Extract latest user message
    latest_user_message = _extract_latest_user_message(payload)
    if latest_user_message:
        save_chat_message(session, session_id=chat_session.id, role="user", content=latest_user_message)
        session.commit()

    # Load profile
    profile = get_talent_profile_by_user_id(session, user_id)
    profile_json = _profile_to_json(profile) if profile else "{}"

    # Load memory
    memory_entries = _load_memory_entries(session, user_id)

    # Load conversation history
    history = _load_history(session, chat_session.id)

    # Stream real LLM response
    async def generate():
        full_text = ""
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


def _load_memory_entries(session: Session, user_id: UUID) -> list[dict]:
    stmt = select(MemorySpace).where(
        MemorySpace.owner_id == user_id,
        MemorySpace.scope_type == "talent_global",
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
