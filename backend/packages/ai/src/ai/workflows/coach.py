from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from ai.prompts.coach import build_coach_system_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.coach import CoachStreamEvent


COACH_TOOLS = [
    {
        "name": "suggest_skill",
        "description": "Suggest a skill for the user to develop based on their goals and gaps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Skill name"},
                "reason": {"type": "string", "description": "Why this skill matters for their goals"},
            },
            "required": ["name", "reason"],
        },
    },
    {
        "name": "rewrite_focus",
        "description": "Suggest a before/after rewrite for resume or positioning text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "before": {"type": "string", "description": "Current phrasing"},
                "after": {"type": "string", "description": "Improved phrasing"},
            },
            "required": ["before", "after"],
        },
    },
]


async def run_coach_workflow_streaming(
    provider_router: ProviderRouter,
    *,
    mode: str,
    messages: list[dict[str, str]],
    profile_json: str,
    goals: str,
    recent_matches_summary: str,
) -> AsyncIterator[CoachStreamEvent]:
    """Run coach conversation with real LLM, yielding SSE events."""
    system_prompt = build_coach_system_prompt(
        mode,
        profile_json=profile_json,
        goals=goals,
        recent_matches_summary=recent_matches_summary,
    )

    request = AICompletionRequest(
        surface="coach",
        system_prompt=system_prompt,
        messages=messages,
        metadata={"tools": COACH_TOOLS},
    )

    yield CoachStreamEvent(event="start", data={"surface": "coach", "mode": mode})

    full_text = ""
    async for event in provider_router.stream(request):
        if event["event"] == "text":
            full_text += event["data"]["delta"]
            yield CoachStreamEvent(event="text", data=event["data"])
        elif event["event"] == "tool":
            yield CoachStreamEvent(event="tool", data=event["data"])

    yield CoachStreamEvent(event="done", data={"message": full_text})


async def run_coach_workflow(
    provider_router: ProviderRouter,
    *,
    mode: str,
    messages: list[dict[str, str]],
    profile_json: str,
    goals: str,
    recent_matches_summary: str,
    profile_name: str,
) -> tuple[str, list[CoachStreamEvent]]:
    """Non-streaming version for backward compatibility."""
    events: list[CoachStreamEvent] = []
    full_text = ""
    async for event in run_coach_workflow_streaming(
        provider_router,
        mode=mode,
        messages=messages,
        profile_json=profile_json,
        goals=goals,
        recent_matches_summary=recent_matches_summary,
    ):
        events.append(event)
        if event.event == "done":
            full_text = event.data.get("message", "")
    return full_text, events
