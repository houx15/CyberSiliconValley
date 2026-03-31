from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.coach import CoachRequest
from core.auth.service import AuthService, InvalidSessionError
from core.coach.service import CoachService, MissingTalentProfileError
from csv_api.dependencies import get_auth_service, get_coach_service
from ai.streaming.sse import stream_events_as_sse


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
    coach_service: CoachService = Depends(get_coach_service),
):
    try:
        events = await coach_service.stream(user, payload)
    except MissingTalentProfileError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return stream_events_as_sse(events)
