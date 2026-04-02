from __future__ import annotations

from collections.abc import AsyncIterator

from ai.prompts.screening import build_screening_system_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.screening import ScreeningStreamEvent


async def run_screening_workflow_streaming(
    provider_router: ProviderRouter,
    *,
    message: str,
    company_name: str,
    active_jobs: list[dict[str, str]],
    history: list[dict[str, str]],
) -> AsyncIterator[ScreeningStreamEvent]:
    """Run screening with real LLM streaming."""
    system_prompt = build_screening_system_prompt(company_name=company_name, active_jobs=active_jobs)
    request = AICompletionRequest(
        surface="screening",
        system_prompt=system_prompt,
        messages=[*history, {"role": "user", "content": message}],
        metadata={"company_name": company_name},
    )

    yield ScreeningStreamEvent(event="start", data={"surface": "screening"})

    full_text = ""
    async for event in provider_router.stream(request):
        if event["event"] == "text":
            full_text += event["data"]["delta"]
            yield ScreeningStreamEvent(event="text", data=event["data"])
        elif event["event"] == "tool":
            yield ScreeningStreamEvent(event="tool", data=event["data"])

    yield ScreeningStreamEvent(event="done", data={"message": full_text})


async def run_screening_workflow(
    provider_router: ProviderRouter,
    *,
    message: str,
    company_name: str,
    active_jobs: list[dict[str, str]],
    history: list[dict[str, str]],
) -> tuple[str, list[ScreeningStreamEvent]]:
    """Non-streaming backward compat."""
    events: list[ScreeningStreamEvent] = []
    full_text = ""
    async for event in run_screening_workflow_streaming(
        provider_router,
        message=message,
        company_name=company_name,
        active_jobs=active_jobs,
        history=history,
    ):
        events.append(event)
        if event.event == "done":
            full_text = event.data.get("message", "")
    return full_text, events
