from __future__ import annotations

import os
from uuid import uuid4

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

from csv_api.config import get_settings
from csv_api.dependencies import get_auth_service, get_engine, get_session_factory
from csv_api.main import create_app
from db.models.enterprise_profile import EnterpriseProfile
from db.models.talent_profile import TalentProfile
from db.models.user import User
from db.session import create_engine_from_url, create_session_factory, session_scope


DATABASE_URL = os.getenv("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is required")


def _clear_dependency_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    get_auth_service.cache_clear()


def _seed_profiles() -> dict[str, tuple[str, str]]:
    engine = create_engine_from_url(DATABASE_URL)
    EnterpriseProfile.__table__.drop(engine, checkfirst=True)
    TalentProfile.__table__.drop(engine, checkfirst=True)
    User.__table__.drop(engine, checkfirst=True)
    User.__table__.create(engine, checkfirst=True)
    TalentProfile.__table__.create(engine, checkfirst=True)
    EnterpriseProfile.__table__.create(engine, checkfirst=True)

    session_factory = create_session_factory(engine)

    credentials = {
        "talent": ("talent1@csv.dev", "csv2026"),
        "enterprise": ("enterprise1@csv.dev", "csv2026"),
    }
    with session_scope(session_factory) as session:
        talent_user = User(
            id=uuid4(),
            email=credentials["talent"][0],
            password_hash=bcrypt.hashpw(credentials["talent"][1].encode(), bcrypt.gensalt()).decode(),
            role="talent",
        )
        enterprise_user = User(
            id=uuid4(),
            email=credentials["enterprise"][0],
            password_hash=bcrypt.hashpw(credentials["enterprise"][1].encode(), bcrypt.gensalt()).decode(),
            role="enterprise",
        )
        session.add_all([talent_user, enterprise_user])
        session.flush()
        session.add(
            TalentProfile(
                id=uuid4(),
                user_id=talent_user.id,
                display_name="Talent One",
                headline="Initial headline",
                bio="Initial bio",
                skills=[],
                experience=[],
                education=[],
                goals={},
                profile_data={},
                onboarding_done=False,
            )
        )

    engine.dispose()
    return credentials


def _cleanup_profiles() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    try:
        EnterpriseProfile.__table__.drop(engine, checkfirst=True)
        TalentProfile.__table__.drop(engine, checkfirst=True)
        User.__table__.drop(engine, checkfirst=True)
    finally:
        engine.dispose()


@pytest.fixture
def profile_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL or "")
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("COOKIE_DOMAIN", "localhost")
    _clear_dependency_caches()
    return create_app()


@pytest.fixture(autouse=True)
def profile_fixture() -> dict[str, tuple[str, str]]:
    credentials = _seed_profiles()
    try:
        yield credentials
    finally:
        _cleanup_profiles()
        _clear_dependency_caches()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_current_profile(profile_app, profile_fixture: dict[str, tuple[str, str]]) -> None:
    transport = ASGITransport(app=profile_app)
    email, password = profile_fixture["talent"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        response = await client.get("/api/v1/profile")

    assert response.status_code == 200
    assert response.json()["profile"]["display_name"] == "Talent One"


@pytest.mark.anyio
async def test_update_current_profile(profile_app, profile_fixture: dict[str, tuple[str, str]]) -> None:
    transport = ASGITransport(app=profile_app)
    email, password = profile_fixture["talent"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        response = await client.patch(
            "/api/v1/profile",
            json={"headline": "Updated headline", "bio": "Updated bio"},
        )

    assert response.status_code == 200
    assert response.json()["profile"]["headline"] == "Updated headline"
    assert response.json()["profile"]["bio"] == "Updated bio"


@pytest.mark.anyio
async def test_onboarding_update_flow_creates_and_updates_enterprise_profile(
    profile_app, profile_fixture: dict[str, tuple[str, str]]
) -> None:
    transport = ASGITransport(app=profile_app)
    email, password = profile_fixture["enterprise"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        response = await client.patch(
            "/api/v1/onboarding",
            json={
                "profile": {
                    "company_name": "CSV Enterprise",
                    "industry": "AI",
                    "preferences": {"priority": "speed"},
                },
                "complete": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["profile"]["company_name"] == "CSV Enterprise"
    assert response.json()["onboarding_done"] is True
