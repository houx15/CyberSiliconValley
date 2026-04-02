from __future__ import annotations

import pytest

from ai.prompts.coach import build_coach_system_prompt
from ai.providers.router import AICompletionResult, ProviderRouter
from ai.workflows.coach import run_coach_workflow
from ai.workflows.screening import run_screening_workflow


class FakeProvider:
    async def complete(self, request):
        return AICompletionResult(
            text=f"Answer for {request.surface}",
            tool_events=[{"name": "provider_tool", "source": request.surface}],
        )


@pytest.mark.anyio
async def test_coach_workflow_includes_provider_tool_events() -> None:
    provider_router = ProviderRouter(provider=FakeProvider())

    text, events = await run_coach_workflow(
        provider_router,
        mode="resume-review",
        messages=[{"role": "user", "content": "Review my resume"}],
        profile_json='{"displayName":"Talent One"}',
        goals='{"target":"Staff AI Engineer"}',
        recent_matches_summary="1 high match",
        profile_name="Talent One",
    )

    assert text == "Answer for coach"
    event_types = [event.event for event in events]
    assert "start" in event_types
    assert "text" in event_types
    assert "tool" in event_types
    assert "done" in event_types
    tool_events = [e for e in events if e.event == "tool"]
    assert any(e.data.get("name") == "provider_tool" for e in tool_events)


@pytest.mark.anyio
async def test_screening_workflow_includes_provider_tool_events() -> None:
    provider_router = ProviderRouter(provider=FakeProvider())

    text, events = await run_screening_workflow(
        provider_router,
        message="Find ML engineers",
        company_name="CSV Enterprise",
        active_jobs=[{"id": "job-1", "title": "Founding AI Engineer"}],
        history=[],
    )

    assert text == "Answer for screening"
    event_types = [event.event for event in events]
    assert "start" in event_types
    assert "text" in event_types
    assert "tool" in event_types
    assert "done" in event_types
    tool_events = [e for e in events if e.event == "tool"]
    assert any(e.data.get("name") == "provider_tool" for e in tool_events)


def test_coach_prompt_varies_by_mode() -> None:
    prompt = build_coach_system_prompt(
        "mock-interview",
        profile_json="{}",
        goals="{}",
        recent_matches_summary="none",
    )

    assert "Act like an interviewer" in prompt
    assert "Mode: mock-interview." in prompt
