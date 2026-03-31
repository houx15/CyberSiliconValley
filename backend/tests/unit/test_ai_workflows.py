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
async def test_coach_workflow_includes_provider_and_local_tool_events() -> None:
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
    assert [event.event for event in events] == ["start", "tool", "tool", "text", "done"]
    assert events[1].data == {"name": "provider_tool", "source": "coach"}
    assert events[2].data["name"] == "rewrite_focus"


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
    assert [event.event for event in events] == ["start", "tool", "text", "done"]
    assert events[1].data == {"name": "provider_tool", "source": "screening"}


def test_coach_prompt_varies_by_mode() -> None:
    prompt = build_coach_system_prompt(
        "mock-interview",
        profile_json="{}",
        goals="{}",
        recent_matches_summary="none",
    )

    assert "Act like an interviewer" in prompt
    assert "Mode: mock-interview." in prompt
