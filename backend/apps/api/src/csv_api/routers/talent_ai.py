"""Talent-specific AI endpoints (resume AI, etc.)."""
from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ai.prompts.resume_ai import RESUME_AI_SYSTEM_PROMPT
from ai.providers.router import AICompletionRequest, ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from contracts.auth import AuthUser
from contracts.chat import CompanionRequest, StreamEvent
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from db.repositories.chat import get_or_create_chat_session, load_chat_history, save_chat_message
from db.repositories.profiles import get_talent_profile_by_user_id

router = APIRouter(prefix="/api/v1/talent", tags=["talent-ai"])


@router.post("/resume-ai")
async def resume_ai_chat(
    payload: CompanionRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    if current_user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_id = UUID(current_user.id)
    profile = get_talent_profile_by_user_id(session, user_id)
    profile_json = json.dumps({
        "displayName": profile.display_name,
        "headline": profile.headline,
        "bio": profile.bio,
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "education": profile.education or [],
        "goals": profile.goals or {},
    }, ensure_ascii=False, default=str) if profile else "{}"

    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type="resume_ai")

    # Extract and save latest user message
    latest = _extract_latest_user_message(payload)
    if latest:
        save_chat_message(session, session_id=chat_session.id, role="user", content=latest)
        session.commit()

    history = [
        {"role": row.role, "content": row.content}
        for row in load_chat_history(session, session_id=chat_session.id)
    ][-30:]

    system_prompt = RESUME_AI_SYSTEM_PROMPT.format(profile_context=profile_json)
    request = AICompletionRequest(
        surface="resume_ai",
        system_prompt=system_prompt,
        messages=history,
    )

    async def generate():
        yield StreamEvent(event="start", data={"surface": "resume_ai"})
        full_text = ""
        try:
            async for event in provider_router.stream(request):
                if event["event"] == "text":
                    full_text += event["data"]["delta"]
                    yield StreamEvent(event="text", data=event["data"])
            yield StreamEvent(event="done", data={"message": full_text})
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
