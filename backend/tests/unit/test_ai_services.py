from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import core.coach.service as coach_module
import core.screening.service as screening_module
from ai.providers.router import ProviderRouter
from contracts.auth import AuthUser
from contracts.coach import CoachRequest
from contracts.screening import ScreeningRequest
from core.coach.service import CoachService
from core.screening.service import ScreeningService


@pytest.mark.anyio
async def test_coach_service_persists_user_and_assistant_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    session_id = uuid4()
    talent_id = uuid4()
    saved_messages: list[tuple[str, str]] = []
    updated_contexts: list[dict[str, object]] = []

    monkeypatch.setattr(
        coach_module,
        "get_talent_profile_by_user_id",
        lambda session, user_id: SimpleNamespace(
            id=talent_id,
            display_name="Talent One",
            headline="ML Engineer",
            bio="Builds AI systems",
            skills=[],
            experience=[],
            education=[],
            goals={},
            availability="open",
        ),
    )
    monkeypatch.setattr(
        coach_module,
        "get_or_create_chat_session",
        lambda session, user_id, session_type: SimpleNamespace(id=session_id),
    )
    monkeypatch.setattr(coach_module, "get_chat_session_context", lambda session, session_id: {})
    monkeypatch.setattr(
        coach_module,
        "update_chat_session_context",
        lambda session, session_id, context: updated_contexts.append(context),
    )
    monkeypatch.setattr(
        coach_module,
        "save_chat_message",
        lambda session, session_id, role, content, metadata=None: saved_messages.append((role, content)),
    )
    monkeypatch.setattr(coach_module, "list_recent_matches_for_talent", lambda session, talent_id, limit=20: [])

    async def fake_run_coach_workflow(*args, **kwargs):
        return "Coach answer", [
            {"event": "start", "data": {"surface": "coach"}},
            {"event": "text", "data": {"delta": "Coach answer"}},
            {"event": "done", "data": {"message": "Coach answer"}},
        ]

    monkeypatch.setattr(coach_module, "run_coach_workflow", fake_run_coach_workflow)

    service = CoachService(session=object(), provider_router=ProviderRouter())
    events = await service.stream(
        AuthUser(id=str(uuid4()), email="talent@csv.dev", role="talent"),
        CoachRequest(
            mode="chat",
            messages=[{"role": "user", "content": "Help me focus my profile"}],
        ),
    )

    assert [event["event"] for event in events] == ["start", "text", "done"]
    assert saved_messages == [
        ("user", "Help me focus my profile"),
        ("assistant", "Coach answer"),
    ]
    assert len(updated_contexts) == 2


@pytest.mark.anyio
async def test_screening_service_persists_user_and_assistant_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    session_id = uuid4()
    enterprise_id = uuid4()
    saved_messages: list[tuple[str, str]] = []

    monkeypatch.setattr(
        screening_module,
        "get_enterprise_profile_by_user_id",
        lambda session, user_id: SimpleNamespace(id=enterprise_id, company_name="CSV Enterprise"),
    )
    monkeypatch.setattr(
        screening_module,
        "list_jobs_for_enterprise",
        lambda session, enterprise_id: [(SimpleNamespace(id=uuid4(), title="Founding AI Engineer"), 0, 0)],
    )
    monkeypatch.setattr(
        screening_module,
        "get_or_create_chat_session",
        lambda session, user_id, session_type: SimpleNamespace(id=session_id),
    )
    monkeypatch.setattr(screening_module, "load_chat_history", lambda session, session_id: [])
    monkeypatch.setattr(
        screening_module,
        "save_chat_message",
        lambda session, session_id, role, content, metadata=None: saved_messages.append((role, content)),
    )

    async def fake_run_screening_workflow(*args, **kwargs):
        return "Screening answer", [
            {"event": "start", "data": {"surface": "screening"}},
            {"event": "text", "data": {"delta": "Screening answer"}},
            {"event": "done", "data": {"message": "Screening answer"}},
        ]

    monkeypatch.setattr(screening_module, "run_screening_workflow", fake_run_screening_workflow)

    service = ScreeningService(session=object(), provider_router=ProviderRouter())
    events = await service.stream(
        AuthUser(id=str(uuid4()), email="enterprise@csv.dev", role="enterprise"),
        ScreeningRequest(message="Find ML engineers"),
    )

    assert [event["event"] for event in events] == ["start", "text", "done"]
    assert saved_messages == [
        ("user", "Find ML engineers"),
        ("assistant", "Screening answer"),
    ]
