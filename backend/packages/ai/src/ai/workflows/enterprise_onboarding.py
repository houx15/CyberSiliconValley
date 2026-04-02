from __future__ import annotations

from collections.abc import AsyncIterator

from ai.prompts.enterprise_onboarding import (
    ENTERPRISE_ONBOARDING_SYSTEM_PROMPT,
    ENTERPRISE_ONBOARDING_TOOLS,
)
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.chat import StreamEvent


async def run_enterprise_onboarding_streaming(
    provider_router: ProviderRouter,
    *,
    messages: list[dict[str, str]],
) -> AsyncIterator[StreamEvent]:
    """Run enterprise onboarding conversation with real LLM."""
    request = AICompletionRequest(
        surface="enterprise_onboarding",
        system_prompt=ENTERPRISE_ONBOARDING_SYSTEM_PROMPT,
        messages=messages,
        metadata={"tools": ENTERPRISE_ONBOARDING_TOOLS},
    )

    yield StreamEvent(event="start", data={"surface": "enterprise_onboarding"})

    full_text = ""
    async for event in provider_router.stream(request):
        if event["event"] == "text":
            full_text += event["data"]["delta"]
            yield StreamEvent(event="text", data=event["data"])
        elif event["event"] == "tool":
            yield StreamEvent(event="tool", data=event["data"])

    yield StreamEvent(event="done", data={"message": full_text})
