from __future__ import annotations

from ai.providers.router import AICompletionRequest, ProviderRouter


SUMMARY_SYSTEM_PROMPT = """\
You are summarizing a pre-screening conversation between an AI representing a talent \
and an AI representing an enterprise on Cyber Silicon Valley.

Produce a concise summary (3-5 sentences) covering:
1. Key topics discussed
2. Whether there is mutual interest
3. Any next steps or action items
4. Overall compatibility assessment

Respond in the same language as the conversation.
"""


async def generate_prechat_summary(
    provider_router: ProviderRouter,
    *,
    messages: list[dict[str, str]],
    talent_name: str = "Talent",
    company_name: str = "Company",
    job_title: str = "Role",
) -> str:
    """Generate an AI summary of a prechat conversation."""
    conversation_text = "\n".join(
        f"[{msg.get('sender_type', msg.get('role', 'unknown'))}]: {msg.get('content', '')}"
        for msg in messages
    )
    result = await provider_router.complete(
        AICompletionRequest(
            surface="prechat_summary",
            system_prompt=SUMMARY_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    f"Summarize this pre-chat between {talent_name} and {company_name} "
                    f"for the {job_title} role:\n\n{conversation_text}"
                ),
            }],
        )
    )
    return result.text
