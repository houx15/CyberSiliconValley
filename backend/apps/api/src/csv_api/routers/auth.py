from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import ErrorResponse, LoginRequest, LoginResponse, SessionResponse
from core.auth.service import AUTH_MAX_AGE_SECONDS, AuthService, InvalidCredentialsError, InvalidSessionError
from csv_api.dependencies import get_auth_service, get_db_session, get_settings
from csv_api.config import Settings


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _is_secure_cookie(settings: Settings) -> bool:
    return settings.app_env.lower() in {"production", "staging"}


def _set_auth_cookie(response: Response, token: str, settings: Settings, auth_service: AuthService) -> None:
    response.set_cookie(
        auth_service.cookie_name,
        token,
        httponly=True,
        secure=_is_secure_cookie(settings),
        samesite="lax",
        max_age=AUTH_MAX_AGE_SECONDS,
        path="/",
        domain=settings.cookie_domain if settings.cookie_domain != "localhost" else None,
    )


def _clear_auth_cookie(response: Response, settings: Settings, auth_service: AuthService) -> None:
    response.delete_cookie(
        auth_service.cookie_name,
        path="/",
        domain=settings.cookie_domain if settings.cookie_domain != "localhost" else None,
    )


@router.post("/login", response_model=LoginResponse, responses={401: {"model": ErrorResponse}})
def login(
    payload: LoginRequest,
    response: Response,
    session: Session = Depends(get_db_session),
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    try:
        user = auth_service.authenticate(session, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=ErrorResponse(error="INVALID_CREDENTIALS", message=str(exc)).model_dump(),
        )

    _set_auth_cookie(response, auth_service.issue_token(user), settings, auth_service)
    return LoginResponse(user=user)


@router.get("/session", response_model=SessionResponse, responses={401: {"model": ErrorResponse}})
def read_session(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> SessionResponse:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=ErrorResponse(error="UNAUTHORIZED", message="Not authenticated").model_dump(),
        )

    try:
        user = auth_service.read_token(token)
    except InvalidSessionError as exc:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=ErrorResponse(error="UNAUTHORIZED", message="Not authenticated").model_dump(),
        )

    return SessionResponse(user=user)


@router.post("/logout")
def logout(
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> dict[str, bool]:
    _clear_auth_cookie(response, settings, auth_service)
    return {"ok": True}
