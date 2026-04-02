"""
Remote integration tests against the deployed backend.

Run with:
    REMOTE_API_URL=http://47.93.151.131:8093 uv run pytest tests/integration/test_remote_api.py -v

These tests exercise the real API endpoints (health, auth, profile, chat)
against the deployed server without requiring a local database.
"""
from __future__ import annotations

import json
import os

import httpx
import pytest

REMOTE_API_URL = os.getenv("REMOTE_API_URL", "http://47.93.151.131:8093")

pytestmark = pytest.mark.skipif(
    not os.getenv("REMOTE_API_URL") and not os.getenv("RUN_REMOTE_TESTS"),
    reason="Set REMOTE_API_URL or RUN_REMOTE_TESTS=1 to run remote tests",
)


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
        if event_name:
            events.append({"event": event_name, "data": data_payload})
    return events


class TestHealth:
    def test_health_endpoint(self):
        r = httpx.get(f"{REMOTE_API_URL}/api/v1/health", timeout=10)
        # 200 on healthy, 503 if old version still running
        assert r.status_code in (200, 503)

    def test_ready_endpoint(self):
        r = httpx.get(f"{REMOTE_API_URL}/api/v1/health/ready", timeout=10)
        assert r.status_code in (200, 503)


class TestAuth:
    """Test auth endpoints. Uses demo credentials from seed data."""

    TALENT_EMAIL = "talent1@csv.dev"
    TALENT_PASSWORD = "csv2026"
    ENTERPRISE_EMAIL = "enterprise1@csv.dev"
    ENTERPRISE_PASSWORD = "csv2026"

    def test_login_invalid_credentials(self):
        r = httpx.post(
            f"{REMOTE_API_URL}/api/v1/auth/login",
            json={"email": "nobody@csv.dev", "password": "wrong"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_login_talent_success(self):
        r = httpx.post(
            f"{REMOTE_API_URL}/api/v1/auth/login",
            json={"email": self.TALENT_EMAIL, "password": self.TALENT_PASSWORD},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == self.TALENT_EMAIL
        assert data["user"]["role"] == "talent"
        assert "auth-token" in r.headers.get("set-cookie", "")

    def test_login_enterprise_success(self):
        r = httpx.post(
            f"{REMOTE_API_URL}/api/v1/auth/login",
            json={"email": self.ENTERPRISE_EMAIL, "password": self.ENTERPRISE_PASSWORD},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "enterprise"

    def test_session_requires_auth(self):
        r = httpx.get(f"{REMOTE_API_URL}/api/v1/auth/session", timeout=10)
        assert r.status_code == 401


class _AuthenticatedBase:
    """Base class that logs in and carries cookies."""

    EMAIL: str
    PASSWORD: str

    @pytest.fixture(autouse=True)
    def login(self):
        self.client = httpx.Client(base_url=REMOTE_API_URL, timeout=30)
        r = self.client.post(
            "/api/v1/auth/login",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        if r.status_code != 200:
            pytest.skip(f"Login failed ({r.status_code}): user may not exist in DB")
        yield
        self.client.close()


class TestTalentProfile(_AuthenticatedBase):
    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_read_profile(self):
        r = self.client.get("/api/v1/profile")
        assert r.status_code == 200
        profile = r.json().get("profile", {})
        # Profile should have basic talent fields
        assert any(k in profile for k in ("display_name", "displayName", "skills"))

    def test_patch_visible(self):
        r = self.client.patch(
            "/api/v1/profile",
            json={"visible": True},
        )
        assert r.status_code == 200

    def test_patch_skills(self):
        r = self.client.patch(
            "/api/v1/profile",
            json={"skills": [{"name": "Python", "level": "advanced", "category": "engineering"}]},
        )
        assert r.status_code == 200


class TestEnterpriseProfile(_AuthenticatedBase):
    EMAIL = "enterprise1@csv.dev"
    PASSWORD = "csv2026"

    def test_read_profile(self):
        r = self.client.get("/api/v1/profile")
        assert r.status_code == 200
        profile = r.json().get("profile", {})
        assert any(k in profile for k in ("company_name", "companyName"))


class TestOnboardingChat(_AuthenticatedBase):
    """Test talent onboarding chat endpoint with real LLM streaming."""

    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_onboarding_chat_returns_sse(self):
        r = self.client.post(
            "/api/v1/onboarding/chat",
            json={"message": "Hi! I'm a Python developer with 3 years experience."},
        )
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = _parse_sse(r.text)
        event_types = [e["event"] for e in events]
        assert "start" in event_types
        assert "done" in event_types

    def test_onboarding_chat_produces_text(self):
        r = self.client.post(
            "/api/v1/onboarding/chat",
            json={"message": "I'm a full-stack engineer, I use React and Python."},
        )
        assert r.status_code == 200
        events = _parse_sse(r.text)
        text_events = [e for e in events if e["event"] == "text"]
        assert len(text_events) > 0, "Expected at least one text event"

    def test_onboarding_chat_empty_message_rejected(self):
        r = self.client.post(
            "/api/v1/onboarding/chat",
            json={"message": ""},
        )
        assert r.status_code == 422


class TestCompanionChat(_AuthenticatedBase):
    """Test companion (buddy) chat endpoint."""

    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_companion_chat_returns_sse(self):
        r = self.client.post(
            "/api/v1/companion",
            json={
                "messages": [{"role": "user", "content": "What opportunities match my skills?"}],
                "sessionType": "general",
            },
        )
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = _parse_sse(r.text)
        event_types = [e["event"] for e in events]
        assert "start" in event_types
        assert "done" in event_types

    def test_companion_with_function_mode(self):
        r = self.client.post(
            "/api/v1/companion",
            json={
                "messages": [{"role": "user", "content": "Help me update my profile"}],
                "persona": "buddy",
                "functionMode": "profile",
            },
        )
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "done" for e in events)

    def test_companion_sessions_list(self):
        r = self.client.get("/api/v1/companion/sessions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_companion_requires_messages(self):
        r = self.client.post(
            "/api/v1/companion",
            json={"messages": []},
        )
        assert r.status_code == 422


class TestCoachChat(_AuthenticatedBase):
    """Test coach chat endpoint with coachId support."""

    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_coach_chat_returns_sse(self):
        r = self.client.post(
            "/api/v1/coach",
            json={
                "mode": "chat",
                "messages": [{"role": "user", "content": "How can I improve my resume?"}],
            },
        )
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")

    def test_coach_with_coach_id(self):
        r = self.client.post(
            "/api/v1/coach",
            json={
                "mode": "chat",
                "coachId": "technical",
                "messages": [{"role": "user", "content": "Help me prep for system design"}],
            },
        )
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "done" for e in events)

    def test_coach_requires_auth(self):
        r = httpx.post(
            f"{REMOTE_API_URL}/api/v1/coach",
            json={"mode": "chat", "messages": [{"role": "user", "content": "Hi"}]},
            timeout=10,
        )
        assert r.status_code == 401


class TestEnterpriseOnboarding(_AuthenticatedBase):
    """Test enterprise onboarding chat."""

    EMAIL = "enterprise1@csv.dev"
    PASSWORD = "csv2026"

    def test_enterprise_onboarding_returns_sse(self):
        r = self.client.post(
            "/api/v1/enterprise/onboarding/chat",
            json={"message": "We are TechCorp, an AI company with 50 employees."},
        )
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = _parse_sse(r.text)
        event_types = [e["event"] for e in events]
        assert "start" in event_types
        assert "done" in event_types

    def test_enterprise_onboarding_forbidden_for_talent(self):
        # Login as talent user
        client2 = httpx.Client(base_url=REMOTE_API_URL, timeout=10)
        r = client2.post(
            "/api/v1/auth/login",
            json={"email": "talent1@csv.dev", "password": "csv2026"},
        )
        if r.status_code != 200:
            pytest.skip("Talent user not available")
        r = client2.post(
            "/api/v1/enterprise/onboarding/chat",
            json={"message": "test"},
        )
        assert r.status_code == 403
        client2.close()


class TestMemory(_AuthenticatedBase):
    """Test memory space CRUD."""

    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_get_memory_space(self):
        r = self.client.get("/api/v1/memory/talent_global")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data

    def test_update_memory_space(self):
        r = self.client.post(
            "/api/v1/memory/talent_global",
            json={
                "entries": [
                    {"key": "test_fact", "value": "I like Python", "updatedAt": "2026-04-02T00:00:00Z"}
                ]
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert any(e["key"] == "test_fact" for e in data["entries"])


class TestUpload(_AuthenticatedBase):
    """Test file upload endpoint."""

    EMAIL = "talent1@csv.dev"
    PASSWORD = "csv2026"

    def test_upload_resume(self):
        r = self.client.post(
            "/api/v1/upload/resume",
            files={"file": ("test.txt", b"This is a test resume content", "text/plain")},
        )
        assert r.status_code == 201
        data = r.json()
        assert "fileId" in data
        assert data["filename"] == "test.txt"
