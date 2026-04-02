"""
Unit tests for the AI provider infrastructure.

These tests verify contracts, routing, and SSE formatting
without requiring real LLM API keys or a database.
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import pytest

from ai.providers.router import (
    AICompletionRequest,
    AICompletionResult,
    DeterministicProvider,
    ProviderRouter,
)
from ai.streaming.sse import event_to_sse_payload


# ── DeterministicProvider ──


@pytest.mark.anyio
async def test_deterministic_provider_coach_surface():
    provider = DeterministicProvider()
    request = AICompletionRequest(
        surface="coach",
        system_prompt="You are a coach.",
        messages=[{"role": "user", "content": "help me with resume"}],
        metadata={"profile_name": "Alice"},
    )
    result = await provider.complete(request)
    assert isinstance(result, AICompletionResult)
    assert "Alice" in result.text
    assert result.tool_events == []


@pytest.mark.anyio
async def test_deterministic_provider_default_surface():
    provider = DeterministicProvider()
    request = AICompletionRequest(
        surface="screening",
        system_prompt="You screen candidates.",
        messages=[{"role": "user", "content": "find ML engineers"}],
        metadata={"company_name": "TechCorp"},
    )
    result = await provider.complete(request)
    assert "TechCorp" in result.text


@pytest.mark.anyio
async def test_deterministic_provider_empty_messages():
    provider = DeterministicProvider()
    request = AICompletionRequest(
        surface="coach",
        system_prompt="test",
        messages=[],
        metadata={"profile_name": "Bob"},
    )
    result = await provider.complete(request)
    assert isinstance(result.text, str)


# ── ProviderRouter ──


@pytest.mark.anyio
async def test_router_falls_back_to_deterministic():
    router = ProviderRouter()
    request = AICompletionRequest(
        surface="coach",
        system_prompt="test",
        messages=[{"role": "user", "content": "hello"}],
    )
    result = await router.complete(request)
    assert isinstance(result, AICompletionResult)
    assert len(result.text) > 0


@pytest.mark.anyio
async def test_router_uses_custom_provider():
    class MockProvider:
        async def complete(self, request: AICompletionRequest) -> AICompletionResult:
            return AICompletionResult(text="mock response", tool_events=[{"name": "test_tool"}])

    router = ProviderRouter(provider=MockProvider())
    request = AICompletionRequest(
        surface="test",
        system_prompt="test",
        messages=[{"role": "user", "content": "hi"}],
    )
    result = await router.complete(request)
    assert result.text == "mock response"
    assert len(result.tool_events) == 1


@pytest.mark.anyio
async def test_router_stream_without_streaming_provider():
    """Router.stream() should work even if provider only has complete()."""
    router = ProviderRouter()  # DeterministicProvider, no stream()
    request = AICompletionRequest(
        surface="coach",
        system_prompt="test",
        messages=[{"role": "user", "content": "hello"}],
        metadata={"profile_name": "TestUser"},
    )
    events = []
    async for event in router.stream(request):
        events.append(event)
    assert len(events) >= 1
    assert any(e["event"] == "text" for e in events)


@pytest.mark.anyio
async def test_router_stream_with_streaming_provider():
    """Router.stream() should delegate to provider.stream() when available."""

    class StreamingMock:
        async def complete(self, request):
            return AICompletionResult(text="fallback")

        async def stream(self, request) -> AsyncIterator[dict[str, Any]]:
            yield {"event": "text", "data": {"delta": "chunk1"}}
            yield {"event": "text", "data": {"delta": "chunk2"}}
            yield {"event": "tool", "data": {"name": "my_tool", "arg": "val"}}

    router = ProviderRouter(provider=StreamingMock())
    request = AICompletionRequest(
        surface="test",
        system_prompt="test",
        messages=[{"role": "user", "content": "hi"}],
    )
    events = []
    async for event in router.stream(request):
        events.append(event)
    assert len(events) == 3
    assert events[0] == {"event": "text", "data": {"delta": "chunk1"}}
    assert events[2] == {"event": "tool", "data": {"name": "my_tool", "arg": "val"}}


# ── SSE Formatting ──


def test_sse_payload_from_dict():
    event = {"event": "text", "data": {"delta": "hello"}}
    payload = event_to_sse_payload(event)
    assert payload.startswith("event: text\n")
    assert "data: " in payload
    data_line = [l for l in payload.strip().split("\n") if l.startswith("data: ")][0]
    parsed = json.loads(data_line.removeprefix("data: "))
    assert parsed == {"delta": "hello"}


def test_sse_payload_ends_with_double_newline():
    event = {"event": "done", "data": {"message": "bye"}}
    payload = event_to_sse_payload(event)
    assert payload.endswith("\n\n")


# ── AICompletionRequest ──


def test_request_defaults():
    req = AICompletionRequest(
        surface="test",
        system_prompt="sys",
        messages=[{"role": "user", "content": "hi"}],
    )
    assert req.metadata == {}
    assert req.surface == "test"


def test_request_with_tools():
    tools = [{"name": "my_tool", "description": "does stuff", "input_schema": {"type": "object"}}]
    req = AICompletionRequest(
        surface="test",
        system_prompt="sys",
        messages=[{"role": "user", "content": "hi"}],
        metadata={"tools": tools},
    )
    assert req.metadata["tools"] == tools


# ── AICompletionResult ──


def test_result_defaults():
    result = AICompletionResult(text="hello")
    assert result.tool_events == []


def test_result_with_tools():
    result = AICompletionResult(
        text="analysis",
        tool_events=[{"name": "reveal_profile_field", "field": "displayName", "value": "Alice"}],
    )
    assert len(result.tool_events) == 1
    assert result.tool_events[0]["name"] == "reveal_profile_field"
