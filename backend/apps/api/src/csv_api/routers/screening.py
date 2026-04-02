from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ai.providers.router import ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from ai.workflows.screening import run_screening_workflow_streaming
from contracts.auth import AuthUser
from contracts.screening import ScreeningRequest
from core.auth.service import AuthService, InvalidSessionError
from csv_api.dependencies import get_ai_provider_router, get_auth_service, get_db_session
from db.repositories.chat import get_or_create_chat_session, load_chat_history, save_chat_message
from db.repositories.jobs import list_jobs_for_enterprise
from db.repositories.profiles import get_enterprise_profile_by_user_id


router = APIRouter(prefix="/api/v1/screening", tags=["screening"])


def get_screening_user(request: Request, auth_service: AuthService = Depends(get_auth_service)) -> AuthUser:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user = auth_service.read_token(token)
    except InvalidSessionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from exc

    if user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user


@router.post("")
async def screening_chat(
    payload: ScreeningRequest,
    user: AuthUser = Depends(get_screening_user),
    session: Session = Depends(get_db_session),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    profile = get_enterprise_profile_by_user_id(session, UUID(user.id))
    company_name = profile.company_name if profile and profile.company_name else "Your Company"

    jobs = [
        {"id": str(job.id), "title": job.title}
        for job, _, _ in list_jobs_for_enterprise(session, profile.id)
    ] if profile is not None else []

    chat_session = get_or_create_chat_session(session, user_id=UUID(user.id), session_type="screening")
    history = [
        {"role": message.role, "content": message.content}
        for message in load_chat_history(session, session_id=chat_session.id)
    ]

    save_chat_message(session, session_id=chat_session.id, role="user", content=payload.message)

    async def generate():
        full_text = ""
        try:
            async for event in run_screening_workflow_streaming(
                provider_router,
                message=payload.message,
                company_name=company_name,
                active_jobs=jobs,
                history=history,
            ):
                if event.event == "text":
                    full_text += event.data.get("delta", "")
                yield event
        finally:
            if full_text:
                save_chat_message(session, session_id=chat_session.id, role="assistant", content=full_text)
            session.commit()

    return stream_async_events_as_sse(generate())
