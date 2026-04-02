from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import openai

from ai.providers.router import AICompletionRequest, AICompletionResult

logger = logging.getLogger(__name__)

DEFAULT_MAX_TOKENS = 4096


@dataclass(frozen=True, slots=True)
class OpenAICompatProvider:
    """Provider for OpenAI-compatible APIs (OpenAI, DeepSeek, Ollama, vLLM, Azure, etc.)."""

    api_key: str
    model: str
    base_url: str = "https://api.openai.com/v1"
    max_tokens: int = DEFAULT_MAX_TOKENS

    def _client(self) -> openai.AsyncOpenAI:
        return openai.AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    def _build_messages(
        self, system_prompt: str, messages: list[dict[str, str]]
    ) -> list[dict[str, str]]:
        result: list[dict[str, str]] = []
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system" or not content.strip():
                continue
            result.append({"role": role, "content": content})
        if len(result) <= 1:
            result.append({"role": "user", "content": "Hello"})
        return result

    def _build_tools(self, tools_def: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Convert our Anthropic-style tool defs to OpenAI function-calling format."""
        openai_tools = []
        for tool in tools_def:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {}),
                },
            })
        return openai_tools

    async def complete(self, request: AICompletionRequest) -> AICompletionResult:
        client = self._client()
        messages = self._build_messages(request.system_prompt, request.messages)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": messages,
        }
        tools_def = request.metadata.get("tools")
        if tools_def:
            kwargs["tools"] = self._build_tools(tools_def)

        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        text = choice.message.content or ""

        tool_events: list[dict[str, Any]] = []
        for call in choice.message.tool_calls or []:
            if call.type == "function":
                try:
                    args = json.loads(call.function.arguments or "{}")
                except json.JSONDecodeError:
                    logger.warning("Malformed tool call arguments: %s", call.function.arguments)
                    args = {}
                tool_events.append({"id": call.id, "name": call.function.name, **args})

        return AICompletionResult(text=text, tool_events=tool_events)

    async def stream(self, request: AICompletionRequest) -> AsyncIterator[dict[str, Any]]:
        client = self._client()
        messages = self._build_messages(request.system_prompt, request.messages)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": messages,
            "stream": True,
        }
        tools_def = request.metadata.get("tools")
        if tools_def:
            kwargs["tools"] = self._build_tools(tools_def)

        tool_calls_buffer: dict[int, dict[str, str]] = {}

        async for chunk in await client.chat.completions.create(**kwargs):
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta is None:
                continue

            if delta.content:
                yield {"event": "text", "data": {"delta": delta.content}}

            for tc in delta.tool_calls or []:
                idx = tc.index
                if idx not in tool_calls_buffer:
                    tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                buf = tool_calls_buffer[idx]
                if tc.id:
                    buf["id"] = tc.id
                if tc.function and tc.function.name:
                    buf["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    buf["arguments"] += tc.function.arguments

        for buf in tool_calls_buffer.values():
            try:
                args = json.loads(buf["arguments"])
            except json.JSONDecodeError:
                args = {}
            yield {"event": "tool", "data": {"id": buf["id"], "name": buf["name"], **args}}
