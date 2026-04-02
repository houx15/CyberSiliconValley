from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import anthropic

from ai.providers.router import AICompletionRequest, AICompletionResult

logger = logging.getLogger(__name__)

DEFAULT_MAX_TOKENS = 4096


@dataclass(frozen=True, slots=True)
class AnthropicProvider:
    """Provider for Anthropic-protocol APIs (Claude, etc.)."""

    api_key: str
    model: str
    base_url: str | None = None
    max_tokens: int = DEFAULT_MAX_TOKENS

    def _client(self) -> anthropic.AsyncAnthropic:
        kwargs: dict[str, Any] = {"api_key": self.api_key}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        return anthropic.AsyncAnthropic(**kwargs)

    def _build_messages(self, messages: list[dict[str, str]]) -> list[dict[str, str]]:
        cleaned: list[dict[str, str]] = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system" or not content.strip():
                continue
            cleaned.append({"role": role, "content": content})
        if not cleaned:
            cleaned.append({"role": "user", "content": "Hello"})
        return cleaned

    async def complete(self, request: AICompletionRequest) -> AICompletionResult:
        client = self._client()
        messages = self._build_messages(request.messages)

        tools_def = request.metadata.get("tools")
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": request.system_prompt,
            "messages": messages,
        }
        if tools_def:
            kwargs["tools"] = tools_def

        response = await client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_events: list[dict[str, Any]] = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_events.append({"id": block.id, "name": block.name, **block.input})

        return AICompletionResult(text="".join(text_parts), tool_events=tool_events)

    async def stream(self, request: AICompletionRequest) -> AsyncIterator[dict[str, Any]]:
        client = self._client()
        messages = self._build_messages(request.messages)

        tools_def = request.metadata.get("tools")
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": request.system_prompt,
            "messages": messages,
        }
        if tools_def:
            kwargs["tools"] = tools_def

        async with client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                    yield {"event": "text", "data": {"delta": event.delta.text}}

            final_message = await stream.get_final_message()
            for block in final_message.content:
                if block.type == "tool_use":
                    yield {"event": "tool", "data": {"id": block.id, "name": block.name, **block.input}}
