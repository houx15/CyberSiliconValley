from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ai.providers.router import ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from ai.workflows.coach import run_coach_workflow_streaming
from contracts.auth import AuthUser
from contracts.coach import CoachRequest
from core.auth.service import AuthService, InvalidSessionError
from core.coach.service import CoachService, MissingTalentProfileError, _normalize_messages, _dedupe_transcript, _profile_json, _format_recent_match_summary, COACH_THREAD_CONTEXT_KEY
from csv_api.dependencies import get_ai_provider_router, get_auth_service, get_coach_service, get_db_session
from db.repositories.chat import (
    get_chat_session_context,
    get_or_create_chat_session,
    save_chat_message,
    update_chat_session_context,
)
from db.repositories.matching import list_recent_matches_for_talent
from db.repositories.profiles import get_talent_profile_by_user_id


router = APIRouter(prefix="/api/v1/coach", tags=["coach"])


def get_coach_user(request: Request, auth_service: AuthService = Depends(get_auth_service)) -> AuthUser:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user = auth_service.read_token(token)
    except InvalidSessionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from exc

    if user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user


@router.post("")
async def coach_chat(
    payload: CoachRequest,
    user: AuthUser = Depends(get_coach_user),
    session: Session = Depends(get_db_session),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    profile = get_talent_profile_by_user_id(session, UUID(user.id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Talent profile not found")

    chat_session = get_or_create_chat_session(session, user_id=UUID(user.id), session_type="coach")
    context = get_chat_session_context(session, session_id=chat_session.id)
    coach_threads = dict(context.get(COACH_THREAD_CONTEXT_KEY) or {})
    mode_history = list(coach_threads.get(payload.mode) or [])

    normalized_messages = _normalize_messages(payload.messages)
    new_messages = _dedupe_transcript(mode_history, normalized_messages)
    thread_history = [*mode_history, *new_messages]

    update_chat_session_context(
        session,
        session_id=chat_session.id,
        context={
            **context,
            COACH_THREAD_CONTEXT_KEY: {
                **coach_threads,
                payload.mode: thread_history,
            },
        },
    )

    last_user_message = ""
    for message in reversed(normalized_messages):
        if message["role"] == "user":
            last_user_message = message["content"]
            break

    if last_user_message:
        save_chat_message(session, session_id=chat_session.id, role="user", content=last_user_message)

    recent_matches = list_recent_matches_for_talent(session, talent_id=profile.id, limit=20)

    async def generate():
        full_text = ""
        try:
            async for event in run_coach_workflow_streaming(
                provider_router,
                mode=payload.mode,
                messages=thread_history,
                profile_json=_profile_json(profile),
                goals=str(profile.goals or {}),
                recent_matches_summary=_format_recent_match_summary(recent_matches),
                coach_id=payload.coach_id,
            ):
                if event.event == "text":
                    full_text += event.data.get("delta", "")
                yield event
        finally:
            if full_text:
                save_chat_message(session, session_id=chat_session.id, role="assistant", content=full_text)
                update_chat_session_context(
                    session,
                    session_id=chat_session.id,
                    context={
                        **context,
                        COACH_THREAD_CONTEXT_KEY: {
                            **coach_threads,
                            payload.mode: [*thread_history, {"role": "assistant", "content": full_text}],
                        },
                    },
                )
            session.commit()

    return stream_async_events_as_sse(generate())
