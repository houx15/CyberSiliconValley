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
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.keyword_edge import KeywordEdge
from db.models.keyword_node import KeywordNode
from db.models.match import Match
from db.models.seeking_report import SeekingReport
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


def _seed_task10_data() -> dict[str, object]:
    engine = create_engine_from_url(DATABASE_URL)
    for table in (
        KeywordEdge.__table__,
        KeywordNode.__table__,
        SeekingReport.__table__,
        InboxItem.__table__,
        Match.__table__,
        Job.__table__,
        EnterpriseProfile.__table__,
        TalentProfile.__table__,
        User.__table__,
    ):
        table.drop(engine, checkfirst=True)

    for table in (
        User.__table__,
        TalentProfile.__table__,
        EnterpriseProfile.__table__,
        Job.__table__,
        Match.__table__,
        InboxItem.__table__,
        SeekingReport.__table__,
        KeywordNode.__table__,
        KeywordEdge.__table__,
    ):
        table.create(engine, checkfirst=True)

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
            profile_data={},
            preferences={},
            onboarding_done=True,
        )
        talent_profile = TalentProfile(
            id=uuid4(),
            user_id=talent_user.id,
            display_name="Talent One",
            headline="Senior AI Engineer",
            bio="Builds production LLM systems.",
            skills=[
                {"name": "Python", "level": "expert", "category": "backend"},
                {"name": "RAG", "level": "advanced", "category": "ai"},
            ],
            experience=[
                {
                    "role": "Lead Engineer",
                    "company": "Past Startup",
                    "description": "Built agent and retrieval systems.",
                    "duration": "2024-2026",
                }
            ],
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
            description="Own the applied AI platform.",
            structured={
                "skills": [{"name": "Python", "level": "expert", "required": True}],
                "location": "San Francisco",
                "workMode": "hybrid",
                "seniority": "senior",
                "timeline": "immediate",
                "deliverables": ["ship product", "grow team"],
                "budget": {"min": 120, "max": 180, "currency": "USD"},
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
            breakdown={"skills": 94, "goals": 88},
            status="invited",
            ai_reasoning="Strong applied AI execution fit.",
        )
        session.add(match)
        session.flush()

        invite_item = InboxItem(
            id=uuid4(),
            user_id=talent_user.id,
            item_type="invite",
            title="You've been invited to apply: Founding AI Engineer",
            content={"jobId": str(job.id), "jobTitle": job.title, "matchId": str(match.id)},
            read=False,
        )
        system_item = InboxItem(
            id=uuid4(),
            user_id=talent_user.id,
            item_type="system",
            title="Profile refreshed",
            content={"kind": "refresh"},
            read=False,
        )
        session.add_all([invite_item, system_item])

        report = SeekingReport(
            id=uuid4(),
            talent_id=talent_profile.id,
            report_data={
                "scanSummary": {
                    "totalScanned": 42,
                    "highMatches": 3,
                    "mediumMatches": 5,
                    "periodLabel": "This week",
                },
                "highMatches": [
                    {
                        "matchId": str(match.id),
                        "jobId": str(job.id),
                        "jobTitle": job.title,
                        "companyName": enterprise_profile.company_name,
                        "location": "San Francisco",
                        "workMode": "hybrid",
                        "score": 91.5,
                        "skillMatches": [{"skill": "Python", "matched": True, "level": "expert"}],
                        "aiAssessment": "Very strong fit.",
                    }
                ],
                "preChatActivity": [],
                "inboundInterest": [
                    {
                        "matchId": str(match.id),
                        "companyName": enterprise_profile.company_name,
                        "reason": "Profile aligned with role requirements",
                        "score": 91.5,
                        "jobId": str(job.id),
                    }
                ],
                "generatedAt": "2026-03-31T10:00:00Z",
            },
        )
        session.add(report)

        node_python = KeywordNode(id=uuid4(), keyword="Python", job_count=8, trending=True)
        node_rag = KeywordNode(id=uuid4(), keyword="RAG", job_count=4, trending=False)
        session.add_all([node_python, node_rag])
        session.flush()
        edge = KeywordEdge(id=uuid4(), source_id=node_python.id, target_id=node_rag.id, weight=1.5)
        session.add(edge)

        invite_item_id = str(invite_item.id)
        talent_id = str(talent_profile.id)
        job_id = str(job.id)
        match_id = str(match.id)

    engine.dispose()
    return {
        "credentials": credentials,
        "invite_item_id": invite_item_id,
        "talent_id": talent_id,
        "job_id": job_id,
        "match_id": match_id,
    }


def _cleanup_task10_data() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    try:
        for table in (
            KeywordEdge.__table__,
            KeywordNode.__table__,
            SeekingReport.__table__,
            InboxItem.__table__,
            Match.__table__,
            Job.__table__,
            EnterpriseProfile.__table__,
            TalentProfile.__table__,
            User.__table__,
        ):
            table.drop(engine, checkfirst=True)
    finally:
        engine.dispose()


@pytest.fixture
def task10_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL or "")
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("COOKIE_DOMAIN", "localhost")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    _clear_dependency_caches()
    return create_app()


@pytest.fixture(autouse=True)
def task10_fixture() -> dict[str, object]:
    payload = _seed_task10_data()
    try:
        yield payload
    finally:
        _cleanup_task10_data()
        _clear_dependency_caches()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.anyio
async def test_inbox_list_detail_and_mark_read(task10_app, task10_fixture: dict[str, object]) -> None:
    transport = ASGITransport(app=task10_app)
    email, password = task10_fixture["credentials"]["talent"]
    item_id = task10_fixture["invite_item_id"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        list_response = await client.get("/api/v1/inbox?filter=invites")
        detail_response = await client.get(f"/api/v1/inbox/{item_id}")
        patch_response = await client.patch(f"/api/v1/inbox/{item_id}")
        refreshed_response = await client.get("/api/v1/inbox")

    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["itemType"] == "invite"
    assert list_response.json()["data"]["unreadCount"] == 2

    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["id"] == item_id

    assert patch_response.status_code == 200
    assert patch_response.json() == {"success": True}

    assert refreshed_response.status_code == 200
    assert refreshed_response.json()["data"]["unreadCount"] == 1


@pytest.mark.anyio
async def test_seeking_report_and_resume_generation(task10_app, task10_fixture: dict[str, object]) -> None:
    transport = ASGITransport(app=task10_app)
    email, password = task10_fixture["credentials"]["talent"]
    talent_id = task10_fixture["talent_id"]
    job_id = task10_fixture["job_id"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _login(client, email, password)
        seeking_response = await client.get("/api/v1/seeking")
        resume_response = await client.post(
            "/api/v1/resume/generate",
            json={"talentId": talent_id, "jobId": job_id},
        )

    assert seeking_response.status_code == 200
    assert seeking_response.json()["data"]["scanSummary"]["totalScanned"] == 42
    assert seeking_response.json()["data"]["highMatches"][0]["companyName"] == "CSV Enterprise"

    assert resume_response.status_code == 200
    data = resume_response.json()["data"]
    assert data["talentName"] == "Talent One"
    assert data["jobTitle"] == "Founding AI Engineer"
    assert data["companyName"] == "CSV Enterprise"
    assert "Talent One" in data["markdown"]
    assert "Founding AI Engineer" in data["markdown"]


@pytest.mark.anyio
async def test_graph_overview_keyword_jobs_and_job_detail(task10_app, task10_fixture: dict[str, object]) -> None:
    transport = ASGITransport(app=task10_app)
    email, password = task10_fixture["credentials"]["talent"]
    job_id = task10_fixture["job_id"]

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        overview_response = await client.get("/api/v1/graph")
        await _login(client, email, password)
        jobs_response = await client.get("/api/v1/graph/Python/jobs")
        detail_response = await client.get(f"/api/v1/graph/Python/jobs?jobId={job_id}")

    assert overview_response.status_code == 200
    assert len(overview_response.json()["nodes"]) == 2
    assert overview_response.json()["edges"][0]["weight"] == pytest.approx(1.5)

    assert jobs_response.status_code == 200
    assert jobs_response.json()["keyword"] == "Python"
    assert jobs_response.json()["jobs"][0]["companyName"] == "CSV Enterprise"
    assert jobs_response.json()["jobs"][0]["matchScore"] == pytest.approx(91.5)

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["companyName"] == "CSV Enterprise"
    assert detail["budgetRange"] == "USD 120-180"
    assert detail["matchBreakdown"] == {"skills": 94.0, "goals": 88.0}
