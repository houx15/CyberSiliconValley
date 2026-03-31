from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from ai.providers.router import ProviderRouter
from contracts.auth import AuthUser
from core.auth.service import AuthService
from core.coach.service import CoachService
from core.screening.service import ScreeningService
from db.session import create_engine_from_url, create_session_factory, request_session

from csv_api.config import Settings, get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine_from_url(get_settings().database_url)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return create_session_factory(get_engine())


def get_db_session() -> Generator[Session, None, None]:
    yield from request_session(get_session_factory())


@lru_cache(maxsize=1)
def get_auth_service() -> AuthService:
    return AuthService(secret=get_settings().app_secret)


@lru_cache(maxsize=1)
def get_ai_provider_router() -> ProviderRouter:
    return ProviderRouter()


def get_current_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthUser:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        return auth_service.read_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from exc


def get_optional_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthUser | None:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        return None

    try:
        return auth_service.read_token(token)
    except Exception:
        return None


def get_coach_service(
    session: Session = Depends(get_db_session),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
) -> CoachService:
    return CoachService(session=session, provider_router=provider_router)


def get_screening_service(
    session: Session = Depends(get_db_session),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
) -> ScreeningService:
    return ScreeningService(session=session, provider_router=provider_router)


__all__ = [
    "Settings",
    "get_ai_provider_router",
    "get_auth_service",
    "get_coach_service",
    "get_current_user",
    "get_db_session",
    "get_engine",
    "get_optional_user",
    "get_screening_service",
    "get_session_factory",
    "get_settings",
]
