from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from ai.prompts.onboarding import (
    ONBOARDING_SYSTEM_PROMPT,
    ONBOARDING_TOOLS,
    RESUME_CONTEXT_TEMPLATE,
)
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.chat import StreamEvent


async def run_onboarding_workflow_streaming(
    provider_router: ProviderRouter,
    *,
    messages: list[dict[str, str]],
    resume_text: str | None = None,
) -> AsyncIterator[StreamEvent]:
    """Run the onboarding conversation with real LLM, yielding SSE events."""
    system_prompt = ONBOARDING_SYSTEM_PROMPT

    # If resume was uploaded, inject the extracted text into the conversation
    if resume_text:
        augmented_messages = list(messages)
        # Append resume context as a user message so the LLM processes it
        if augmented_messages:
            last_msg = augmented_messages[-1]
            if last_msg.get("role") == "user":
                augmented_messages[-1] = {
                    "role": "user",
                    "content": last_msg["content"] + "\n\n" + RESUME_CONTEXT_TEMPLATE.format(resume_text=resume_text),
                }
            else:
                augmented_messages.append({
                    "role": "user",
                    "content": RESUME_CONTEXT_TEMPLATE.format(resume_text=resume_text),
                })
        else:
            augmented_messages = [{"role": "user", "content": RESUME_CONTEXT_TEMPLATE.format(resume_text=resume_text)}]
    else:
        augmented_messages = messages

    request = AICompletionRequest(
        surface="onboarding",
        system_prompt=system_prompt,
        messages=augmented_messages,
        metadata={"tools": ONBOARDING_TOOLS},
    )

    yield StreamEvent(event="start", data={"surface": "onboarding"})

    # Use streaming if available
    full_text = ""
    async for event in provider_router.stream(request):
        if event["event"] == "text":
            full_text += event["data"]["delta"]
            yield StreamEvent(event="text", data=event["data"])
        elif event["event"] == "tool":
            yield StreamEvent(event="tool", data=event["data"])

    yield StreamEvent(event="done", data={"message": full_text})


async def run_onboarding_workflow(
    provider_router: ProviderRouter,
    *,
    messages: list[dict[str, str]],
    resume_text: str | None = None,
) -> tuple[str, list[StreamEvent]]:
    """Non-streaming version: collects all events and returns them."""
    events: list[StreamEvent] = []
    full_text = ""
    async for event in run_onboarding_workflow_streaming(
        provider_router, messages=messages, resume_text=resume_text
    ):
        events.append(event)
        if event.event == "done":
            full_text = event.data.get("message", "")
    return full_text, events
