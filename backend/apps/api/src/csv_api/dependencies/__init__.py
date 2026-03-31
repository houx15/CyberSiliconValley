from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.auth.service import AuthService
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


__all__ = [
    "Settings",
    "get_auth_service",
    "get_db_session",
    "get_engine",
    "get_session_factory",
    "get_settings",
]
