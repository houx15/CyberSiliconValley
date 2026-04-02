from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from ai.prompts.companion import COMPANION_TOOLS, build_companion_system_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.chat import StreamEvent


async def run_companion_workflow_streaming(
    provider_router: ProviderRouter,
    *,
    messages: list[dict[str, str]],
    profile_json: str,
    memory_entries: list[dict] | None = None,
    function_mode: str | None = None,
) -> AsyncIterator[StreamEvent]:
    """Run companion conversation with real LLM, yielding SSE events."""
    system_prompt = build_companion_system_prompt(
        profile_json=profile_json,
        memory_entries=memory_entries,
    )

    request = AICompletionRequest(
        surface="companion",
        system_prompt=system_prompt,
        messages=messages,
        metadata={"tools": COMPANION_TOOLS},
    )

    yield StreamEvent(event="start", data={"surface": "companion", "functionMode": function_mode or "general"})

    full_text = ""
    async for event in provider_router.stream(request):
        if event["event"] == "text":
            full_text += event["data"]["delta"]
            yield StreamEvent(event="text", data=event["data"])
        elif event["event"] == "tool":
            yield StreamEvent(event="tool", data=event["data"])

    yield StreamEvent(event="done", data={"message": full_text})
