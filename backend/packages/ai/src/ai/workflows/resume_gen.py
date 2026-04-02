from __future__ import annotations

from ai.prompts.resume_gen import RESUME_GEN_SYSTEM_PROMPT
from ai.providers.router import AICompletionRequest, ProviderRouter


async def generate_tailored_resume(
    provider_router: ProviderRouter,
    *,
    profile_json: str,
    job_title: str,
    company_name: str,
    job_description: str,
) -> str:
    """Generate a tailored resume using LLM."""
    system_prompt = RESUME_GEN_SYSTEM_PROMPT.format(
        profile_json=profile_json,
        job_title=job_title,
        company_name=company_name,
        job_description=job_description,
    )
    result = await provider_router.complete(
        AICompletionRequest(
            surface="resume_gen",
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": f"Generate a tailored resume for the {job_title} role at {company_name}."}],
        )
    )
    return result.text
