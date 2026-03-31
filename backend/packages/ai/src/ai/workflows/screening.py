from __future__ import annotations

from ai.prompts.screening import build_screening_system_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter
from contracts.screening import ScreeningStreamEvent


async def run_screening_workflow(
    provider_router: ProviderRouter,
    *,
    message: str,
    company_name: str,
    active_jobs: list[dict[str, str]],
    history: list[dict[str, str]],
) -> tuple[str, list[ScreeningStreamEvent]]:
    system_prompt = build_screening_system_prompt(company_name=company_name, active_jobs=active_jobs)
    completion = await provider_router.complete(
        AICompletionRequest(
            surface="screening",
            system_prompt=system_prompt,
            messages=[*history, {"role": "user", "content": message}],
            metadata={"company_name": company_name},
        )
    )
    events = [ScreeningStreamEvent(event="start", data={"surface": "screening"})]
    for tool_event in completion.tool_events:
        events.append(ScreeningStreamEvent(event="tool", data=tool_event))
    events.extend(
        [
            ScreeningStreamEvent(event="text", data={"delta": completion.text}),
            ScreeningStreamEvent(event="done", data={"message": completion.text}),
        ]
    )
    return completion.text, events
