from __future__ import annotations

from ai.prompts.prechat import build_prechat_summary_prompt
from ai.providers.router import AICompletionRequest, ProviderRouter


async def run_ai_prechat_round(
    provider_router: ProviderRouter,
    *,
    role: str,
    conversation_history: list[dict[str, str]],
    system_prompt: str,
) -> str:
    """Run one round of AI pre-chat conversation. Returns the response text."""
    request = AICompletionRequest(
        surface="prechat",
        system_prompt=system_prompt,
        messages=conversation_history,
        metadata={"role": role},
    )
    result = await provider_router.complete(request)
    return result.text


async def generate_prechat_summary(
    provider_router: ProviderRouter,
    *,
    company_name: str,
    job_title: str,
    talent_name: str,
    conversation: list[dict[str, str]],
) -> str:
    """Generate a summary of the pre-chat conversation."""
    system_prompt = build_prechat_summary_prompt(
        company_name=company_name,
        job_title=job_title,
        talent_name=talent_name,
        conversation=conversation,
    )
    request = AICompletionRequest(
        surface="prechat_summary",
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": "Please summarize this pre-chat conversation."}],
    )
    result = await provider_router.complete(request)
    return result.text
