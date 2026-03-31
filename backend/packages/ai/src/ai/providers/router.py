from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class AICompletionRequest:
    surface: str
    system_prompt: str
    messages: list[dict[str, str]]
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AICompletionResult:
    text: str
    tool_events: list[dict[str, Any]] = field(default_factory=list)


class AIProvider(Protocol):
    async def complete(self, request: AICompletionRequest) -> AICompletionResult: ...


@dataclass(frozen=True, slots=True)
class DeterministicProvider:
    async def complete(self, request: AICompletionRequest) -> AICompletionResult:
        latest_user_message = ""
        for message in reversed(request.messages):
            if message.get("role") == "user":
                latest_user_message = message.get("content", "").strip()
                break

        profile_name = str(request.metadata.get("profile_name") or "your profile")
        company_name = str(request.metadata.get("company_name") or "your team")

        if request.surface == "coach":
            text = (
                f"For {profile_name}, tighten the next revision around measurable outcomes. "
                f"Start with the strongest evidence from: {latest_user_message or 'your recent experience'}."
            )
        else:
            text = (
                f"For {company_name}, start by narrowing the search to candidates aligned with: "
                f"{latest_user_message or 'the active role requirements'}."
            )

        return AICompletionResult(text=text)


@dataclass(frozen=True, slots=True)
class ProviderRouter:
    provider: AIProvider | None = None

    async def complete(self, request: AICompletionRequest) -> AICompletionResult:
        provider = self.provider or DeterministicProvider()
        return await provider.complete(request)
