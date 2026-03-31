from __future__ import annotations

from typing import Any

from ai.prompts.coach import build_coach_system_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.coach import CoachStreamEvent


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
    system_prompt = build_coach_system_prompt(
        mode,
        profile_json=profile_json,
        goals=goals,
        recent_matches_summary=recent_matches_summary,
    )
    completion = await provider_router.complete(
        AICompletionRequest(
            surface="coach",
            system_prompt=system_prompt,
            messages=messages,
            metadata={"mode": mode, "profile_name": profile_name},
        )
    )

    events = [CoachStreamEvent(event="start", data={"surface": "coach", "mode": mode})]
    for tool_event in completion.tool_events:
        events.append(CoachStreamEvent(event="tool", data=tool_event))
    for tool_event in _coach_tool_events(mode=mode, messages=messages):
        events.append(CoachStreamEvent(event="tool", data=tool_event))
    events.append(CoachStreamEvent(event="text", data={"delta": completion.text}))
    events.append(CoachStreamEvent(event="done", data={"message": completion.text}))
    return completion.text, events


def _coach_tool_events(*, mode: str, messages: list[dict[str, str]]) -> list[dict[str, Any]]:
    latest_user_message = ""
    for message in reversed(messages):
        if message.get("role") == "user":
            latest_user_message = message.get("content", "")
            break

    if mode == "skill-gaps":
        return [
            {
                "name": "suggest_skill",
                "suggestion": {
                    "name": "Evaluation Design",
                    "reason": "Your target roles increasingly expect strong AI quality and evaluation loops.",
                },
            }
        ]

    if mode == "resume-review":
        return [
            {
                "name": "rewrite_focus",
                "before": latest_user_message or "General resume phrasing",
                "after": "Lead with one quantified outcome, then the system you built to deliver it.",
            }
        ]

    return []
