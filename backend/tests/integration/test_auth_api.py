from __future__ import annotations

import os
from uuid import uuid4

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

from csv_api.config import get_settings
from csv_api.dependencies import get_auth_service, get_engine, get_session_factory
from csv_api.main import create_app
from db.models.user import User
from db.session import create_engine_from_url, create_session_factory, session_scope


DATABASE_URL = os.getenv("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is required")


def _clear_dependency_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    get_auth_service.cache_clear()


def _seed_user() -> tuple[str, str]:
    engine = create_engine_from_url(DATABASE_URL)
    User.__table__.drop(engine, checkfirst=True)
    User.__table__.create(engine, checkfirst=True)

    email = "talent1@csv.dev"
    password = "csv2026"
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    session_factory = create_session_factory(engine)

    with session_scope(session_factory) as session:
        session.add(
            User(
                id=uuid4(),
                email=email,
                password_hash=password_hash,
                role="talent",
            )
        )

    engine.dispose()
    return email, password


def _cleanup_users() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    try:
        User.__table__.drop(engine, checkfirst=True)
    finally:
        engine.dispose()


@pytest.fixture
def auth_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL or "")
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("COOKIE_DOMAIN", "localhost")
    _clear_dependency_caches()
    return create_app()


@pytest.fixture(autouse=True)
def auth_fixture() -> tuple[str, str]:
    credentials = _seed_user()
    try:
        yield credentials
    finally:
        _cleanup_users()
        _clear_dependency_caches()


@pytest.mark.anyio
async def test_login_success_sets_cookie(auth_app, auth_fixture: tuple[str, str]) -> None:
    email, password = auth_fixture
    transport = ASGITransport(app=auth_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})

    assert response.status_code == 200
    assert response.json()["user"]["email"] == email
    assert "auth-token=" in response.headers["set-cookie"]


@pytest.mark.anyio
async def test_login_failure_returns_invalid_credentials(auth_app, auth_fixture: tuple[str, str]) -> None:
    email, _ = auth_fixture
    transport = ASGITransport(app=auth_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {
        "error": "INVALID_CREDENTIALS",
        "message": "Invalid email or password",
    }


@pytest.mark.anyio
async def test_session_read_returns_current_user(auth_app, auth_fixture: tuple[str, str]) -> None:
    email, password = auth_fixture
    transport = ASGITransport(app=auth_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_response.status_code == 200

        response = await client.get("/api/v1/auth/session")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == email


@pytest.mark.anyio
async def test_logout_clears_cookie_and_session(auth_app, auth_fixture: tuple[str, str]) -> None:
    email, password = auth_fixture
    transport = ASGITransport(app=auth_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_response.status_code == 200

        logout_response = await client.post("/api/v1/auth/logout")
        session_response = await client.get("/api/v1/auth/session")

    assert logout_response.status_code == 200
    assert logout_response.headers["set-cookie"].startswith("auth-token=")
    assert session_response.status_code == 401
