from __future__ import annotations

import json

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from contracts.auth import AuthUser
from core.auth.service import AuthService
from csv_api.config import get_settings
from csv_api.dependencies import (
    get_auth_service,
    get_coach_service,
    get_screening_service,
)
from csv_api.main import create_app


def _clear_dependency_caches() -> None:
    get_settings.cache_clear()
    get_auth_service.cache_clear()


class FakeCoachService:
    async def stream(self, user: AuthUser, payload) -> list[dict[str, object]]:
        assert user.role == "talent"
        assert payload.mode == "resume-review"
        return [
            {"event": "start", "data": {"surface": "coach", "mode": payload.mode}},
            {"event": "text", "data": {"delta": "Refine your headline around outcomes."}},
            {"event": "done", "data": {"message": "Refine your headline around outcomes."}},
        ]


class FakeScreeningService:
    async def stream(self, user: AuthUser, payload) -> list[dict[str, object]]:
        assert user.role == "enterprise"
        return [
            {"event": "start", "data": {"surface": "screening"}},
            {"event": "text", "data": {"delta": f"Searching for: {payload.message}"}},
            {"event": "done", "data": {"message": f"Searching for: {payload.message}"}},
        ]


def _issue_token(*, role: str, cookie_name: str) -> dict[str, str]:
    auth_service = AuthService(secret="test-secret")
    token = auth_service.issue_token(
        AuthUser(id="user-1", email=f"{role}@csv.dev", role=role),  # type: ignore[arg-type]
    )
    return {cookie_name: token}


def _parse_sse(body: str) -> list[dict[str, object]]:
    chunks = [chunk.strip() for chunk in body.strip().split("\n\n") if chunk.strip()]
    events: list[dict[str, object]] = []

    for chunk in chunks:
        event_name = ""
        data_payload = None
        for line in chunk.splitlines():
            if line.startswith("event: "):
                event_name = line.removeprefix("event: ")
            elif line.startswith("data: "):
                data_payload = json.loads(line.removeprefix("data: "))
        events.append({"event": event_name, "data": data_payload})

    return events


@pytest.fixture
def ai_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("COOKIE_DOMAIN", "localhost")
    _clear_dependency_caches()

    app = create_app()
    app.dependency_overrides[get_coach_service] = lambda: FakeCoachService()
    app.dependency_overrides[get_screening_service] = lambda: FakeScreeningService()
    return app


@pytest.mark.anyio
async def test_coach_requires_authentication(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/coach",
            json={"mode": "chat", "messages": [{"role": "user", "content": "Help me"}]},
        )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.anyio
async def test_coach_rejects_wrong_role(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        cookies=_issue_token(role="enterprise", cookie_name="auth-token"),
    ) as client:
        response = await client.post(
            "/api/v1/coach",
            json={"mode": "chat", "messages": [{"role": "user", "content": "Help me"}]},
        )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_coach_validates_messages(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        cookies=_issue_token(role="talent", cookie_name="auth-token"),
    ) as client:
        response = await client.post("/api/v1/coach", json={"mode": "chat", "messages": []})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.anyio
async def test_coach_stream_returns_typed_sse_events(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        cookies=_issue_token(role="talent", cookie_name="auth-token"),
    ) as client:
        response = await client.post(
            "/api/v1/coach",
            json={
                "mode": "resume-review",
                "messages": [{"role": "user", "content": "Review my resume"}],
            },
        )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["content-type"].startswith("text/event-stream")
    assert _parse_sse(response.text) == [
        {"event": "start", "data": {"surface": "coach", "mode": "resume-review"}},
        {"event": "text", "data": {"delta": "Refine your headline around outcomes."}},
        {"event": "done", "data": {"message": "Refine your headline around outcomes."}},
    ]


@pytest.mark.anyio
async def test_screening_requires_token_cookie(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/screening", json={"message": "Find ML engineers"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.anyio
async def test_screening_validates_message(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        cookies=_issue_token(role="enterprise", cookie_name="auth-token"),
    ) as client:
        response = await client.post("/api/v1/screening", json={"message": ""})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.anyio
async def test_screening_stream_returns_typed_sse_events(ai_app) -> None:
    transport = ASGITransport(app=ai_app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        cookies=_issue_token(role="enterprise", cookie_name="auth-token"),
    ) as client:
        response = await client.post("/api/v1/screening", json={"message": "Find ML engineers"})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["content-type"].startswith("text/event-stream")
    assert _parse_sse(response.text) == [
        {"event": "start", "data": {"surface": "screening"}},
        {"event": "text", "data": {"delta": "Searching for: Find ML engineers"}},
        {"event": "done", "data": {"message": "Searching for: Find ML engineers"}},
    ]
