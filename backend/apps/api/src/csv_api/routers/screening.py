from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ai.streaming.sse import stream_events_as_sse
from contracts.auth import AuthUser
from contracts.screening import ScreeningRequest
from core.auth.service import AuthService, InvalidSessionError
from core.screening.service import ScreeningService
from csv_api.dependencies import get_auth_service, get_screening_service


router = APIRouter(prefix="/api/v1/screening", tags=["screening"])


def get_screening_user(request: Request, auth_service: AuthService = Depends(get_auth_service)) -> AuthUser:
    token = request.cookies.get("token")
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
    screening_service: ScreeningService = Depends(get_screening_service),
):
    events = await screening_service.stream(user, payload)
    return stream_events_as_sse(events)
