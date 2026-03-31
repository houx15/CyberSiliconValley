from __future__ import annotations

import os
from types import SimpleNamespace
from uuid import uuid4

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

import csv_api.routers.jobs as jobs_router
import csv_api.routers.matches as matches_router
from csv_api.config import get_settings
from csv_api.dependencies import get_auth_service, get_engine, get_session_factory
from csv_api.main import create_app
from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.match import Match
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


def _seed_jobs_and_matches() -> dict[str, object]:
    engine = create_engine_from_url(DATABASE_URL)
    Match.__table__.drop(engine, checkfirst=True)
    Job.__table__.drop(engine, checkfirst=True)
    EnterpriseProfile.__table__.drop(engine, checkfirst=True)
    TalentProfile.__table__.drop(engine, checkfirst=True)
    User.__table__.drop(engine, checkfirst=True)

    User.__table__.create(engine, checkfirst=True)
    TalentProfile.__table__.create(engine, checkfirst=True)
    EnterpriseProfile.__table__.create(engine, checkfirst=True)
    Job.__table__.create(engine, checkfirst=True)
    Match.__table__.create(engine, checkfirst=True)

    session_factory = create_session_factory(engine)
    credentials = {
        "enterprise": ("enterprise1@csv.dev", "csv2026"),
        "talent": ("talent1@csv.dev", "csv2026"),
    }

    with session_scope(session_factory) as session:
        enterprise_user = User(
            id=uuid4(),
            email=credentials["enterprise"][0],
            password_hash=bcrypt.hashpw(credentials["enterprise"][1].encode(), bcrypt.gensalt()).decode(),
            role="enterprise",
        )
        talent_user = User(
            id=uuid4(),
            email=credentials["talent"][0],
            password_hash=bcrypt.hashpw(credentials["talent"][1].encode(), bcrypt.gensalt()).decode(),
            role="talent",
        )
        session.add_all([enterprise_user, talent_user])
        session.flush()

        enterprise_profile = EnterpriseProfile(
            id=uuid4(),
            user_id=enterprise_user.id,
            company_name="CSV Enterprise",
            industry="AI",
            preferences={},
            profile_data={},
            onboarding_done=True,
        )
        talent_profile = TalentProfile(
            id=uuid4(),
            user_id=talent_user.id,
            display_name="Talent One",
            headline="Senior AI Engineer",
            bio="Builds production LLM systems",
            skills=[{"name": "Python", "level": "expert", "category": "backend"}],
            experience=[],
            education=[],
            goals={},
            profile_data={},
            onboarding_done=True,
        )
        session.add_all([enterprise_profile, talent_profile])
        session.flush()

        job = Job(
            id=uuid4(),
            enterprise_id=enterprise_profile.id,
            title="Founding AI Engineer",
            description="Own the applied AI stack",
            structured={
                "skills": [{"name": "Python", "level": "expert", "required": True}],
                "seniority": "senior",
                "timeline": "immediate",
                "deliverables": ["ship product"],
                "budget": {"min": 80, "max": 120, "currency": "USD"},
                "workMode": "remote",
            },
            status="open",
            auto_match=True,
            auto_prechat=False,
        )
        session.add(job)
        session.flush()

        match = Match(
            id=uuid4(),
            job_id=job.id,
            talent_id=talent_profile.id,
            score=91.5,
            breakdown={"semantic": 0.93, "feature": 0.88, "dimensions": {"python": 0.97}},
            status="new",
            ai_reasoning="Strong fit for product-minded backend AI work.",
        )
        session.add(match)
        session.flush()

        job_id = str(job.id)
        match_id = str(match.id)

    engine.dispose()
    return {
        "credentials": credentials,
        "job_id": job_id,
        "match_id": match_id,
    }


def _cleanup_jobs_and_matches() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    try:
        Match.__table__.drop(engine, checkfirst=True)
        Job.__table__.drop(engine, checkfirst=True)
        EnterpriseProfile.__table__.drop(engine, checkfirst=True)
        TalentProfile.__table__.drop(engine, checkfirst=True)
        User.__table__.drop(engine, checkfirst=True)
    finally:
        engine.dispose()


@pytest.fixture
def jobs_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL or "")
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("COOKIE_DOMAIN", "localhost")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    _clear_dependency_caches()
    return create_app()


@pytest.fixture
def queued_scan_calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str | None, str]]:
    calls: list[tuple[str | None, str]] = []

    async def fake_enqueue_match_scan_job(redis_url: str | None, job_id: str):
        calls.append((redis_url, job_id))
        return SimpleNamespace(job_id=f"queued-{job_id}")

    monkeypatch.setattr(jobs_router, "enqueue_match_scan_job", fake_enqueue_match_scan_job)
    monkeypatch.setattr(matches_router, "enqueue_match_scan_job", fake_enqueue_match_scan_job)
    return calls


@pytest.fixture(autouse=True)
def jobs_fixture() -> dict[str, object]:
    payload = _seed_jobs_and_matches()
    try:
        yield payload
    finally:
        _cleanup_jobs_and_matches()
        _clear_dependency_caches()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.anyio
async def test_create_and_list_jobs(
    jobs_app,
    jobs_fixture: dict[str, object],
    queued_scan_calls: list[tuple[str | None, str]],
) -> None:
    transport = ASGITransport(app=jobs_app)
    email, password = jobs_fixture["credentials"]["enterprise"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)

        create_response = await client.post(
            "/api/v1/jobs",
            json={
                "title": "Principal Agent Engineer",
                "description": "Lead agent-native product development.",
                "structured": {
                    "skills": [{"name": "TypeScript", "level": "expert", "required": True}],
                    "seniority": "staff",
                    "timeline": "quarter",
                    "deliverables": ["ship agent workflows"],
                    "budget": {"min": 100, "max": 160, "currency": "USD"},
                    "workMode": "hybrid",
                },
                "autoMatch": True,
                "autoPrechat": True,
            },
        )
        list_response = await client.get("/api/v1/jobs")

    assert create_response.status_code == 201
    assert create_response.json()["job"]["title"] == "Principal Agent Engineer"
    assert create_response.json()["job"]["autoPrechat"] is True
    assert queued_scan_calls and queued_scan_calls[0][1] == create_response.json()["job"]["id"]

    assert list_response.status_code == 200
    jobs = list_response.json()["jobs"]
    assert len(jobs) == 2
    assert jobs[0]["title"] == "Principal Agent Engineer"
    assert jobs[1]["matchCount"] == 1
    assert jobs[1]["shortlistedCount"] == 0


@pytest.mark.anyio
async def test_get_job_detail_and_matches(jobs_app, jobs_fixture: dict[str, object]) -> None:
    transport = ASGITransport(app=jobs_app)
    email, password = jobs_fixture["credentials"]["enterprise"]
    job_id = jobs_fixture["job_id"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        response = await client.get(f"/api/v1/jobs/{job_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["job"]["id"] == job_id
    assert body["matches"][0]["display_name"] == "Talent One"
    assert body["matches"][0]["score"] == pytest.approx(91.5)


@pytest.mark.anyio
async def test_list_get_and_update_matches(
    jobs_app,
    jobs_fixture: dict[str, object],
    queued_scan_calls: list[tuple[str | None, str]],
) -> None:
    transport = ASGITransport(app=jobs_app)
    email, password = jobs_fixture["credentials"]["enterprise"]
    match_id = jobs_fixture["match_id"]
    job_id = jobs_fixture["job_id"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        list_response = await client.get("/api/v1/matches")
        detail_response = await client.get(f"/api/v1/matches/{match_id}")
        patch_response = await client.patch(f"/api/v1/matches/{match_id}", json={"status": "shortlisted"})
        scan_response = await client.post("/api/v1/matches/scan", json={"jobId": job_id})

    assert list_response.status_code == 200
    matches = list_response.json()["matches"]
    assert matches[0]["matchId"] == match_id
    assert matches[0]["jobTitle"] == "Founding AI Engineer"
    assert matches[0]["talentName"] == "Talent One"

    assert detail_response.status_code == 200
    assert detail_response.json()["match"]["displayName"] == "Talent One"
    assert detail_response.json()["match"]["headline"] == "Senior AI Engineer"

    assert patch_response.status_code == 200
    assert patch_response.json()["match"]["status"] == "shortlisted"

    assert scan_response.status_code == 200
    assert scan_response.json()["message"] == "Match scan queued"
    assert scan_response.json()["queueJobId"] == f"queued-{job_id}"
    assert queued_scan_calls[-1][1] == job_id
