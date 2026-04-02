"""
Unit tests for Pydantic request/response contracts.

Ensures frontend payloads are accepted by backend models.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from contracts.chat import ChatMessage, CompanionRequest, SimpleChatRequest, StreamEvent
from contracts.coach import CoachMessage, CoachRequest, CoachStreamEvent


# ── SimpleChatRequest ──


def test_simple_chat_valid():
    req = SimpleChatRequest(message="hello")
    assert req.message == "hello"


def test_simple_chat_empty_rejected():
    with pytest.raises(ValidationError):
        SimpleChatRequest(message="")


# ── CompanionRequest (frontend buddy page) ──


def test_companion_request_minimal():
    """Frontend sends: { messages: [{role, content}] }"""
    req = CompanionRequest(
        messages=[{"role": "user", "content": "hi"}],
    )
    assert req.session_type == "general"
    assert req.persona is None
    assert req.function_mode is None


def test_companion_request_full():
    """Frontend buddy sends: { messages, persona, functionMode, sessionType }"""
    req = CompanionRequest(
        messages=[{"role": "user", "content": "update my skills"}],
        persona="buddy",
        functionMode="profile",
        sessionType="general",
    )
    assert req.persona == "buddy"
    assert req.function_mode == "profile"
    assert req.session_type == "general"


def test_companion_request_camel_case_aliases():
    """Frontend uses camelCase, backend maps to snake_case."""
    data = {
        "messages": [{"role": "user", "content": "test"}],
        "sessionType": "home",
        "functionMode": "analysis",
    }
    req = CompanionRequest(**data)
    assert req.session_type == "home"
    assert req.function_mode == "analysis"


def test_companion_request_empty_messages_rejected():
    with pytest.raises(ValidationError):
        CompanionRequest(messages=[])


# ── CoachRequest (frontend coach page) ──


def test_coach_request_minimal():
    """Frontend sends: { mode, messages: [{role, content}] }"""
    req = CoachRequest(
        mode="chat",
        messages=[{"role": "user", "content": "help me"}],
    )
    assert req.mode == "chat"
    assert req.coach_id is None


def test_coach_request_with_coach_id():
    """Frontend coach page sends coachId."""
    req = CoachRequest(
        mode="chat",
        coachId="technical",
        messages=[{"role": "user", "content": "system design tips"}],
    )
    assert req.coach_id == "technical"


def test_coach_request_with_resume_review_mode():
    req = CoachRequest(
        mode="resume-review",
        messages=[{"role": "user", "content": "review my resume"}],
    )
    assert req.mode == "resume-review"


def test_coach_request_invalid_mode_rejected():
    with pytest.raises(ValidationError):
        CoachRequest(
            mode="invalid-mode",
            messages=[{"role": "user", "content": "test"}],
        )


def test_coach_request_empty_messages_rejected():
    with pytest.raises(ValidationError):
        CoachRequest(mode="chat", messages=[])


# ── ChatMessage ──


def test_chat_message_with_content():
    msg = ChatMessage(role="user", content="hello")
    assert msg.content == "hello"


def test_chat_message_with_parts():
    msg = ChatMessage(
        role="user",
        parts=[{"type": "text", "text": "hello from parts"}],
    )
    assert msg.parts[0].text == "hello from parts"


def test_chat_message_empty_rejected():
    with pytest.raises(ValidationError):
        ChatMessage(role="user", content="", parts=[])


def test_chat_message_whitespace_only_rejected():
    with pytest.raises(ValidationError):
        ChatMessage(role="user", content="   ")


# ── StreamEvent ──


def test_stream_event_text():
    event = StreamEvent(event="text", data={"delta": "chunk"})
    assert event.event == "text"
    assert event.data["delta"] == "chunk"


def test_stream_event_tool():
    event = StreamEvent(
        event="tool",
        data={"name": "reveal_profile_field", "field": "displayName", "value": "Alice"},
    )
    assert event.data["name"] == "reveal_profile_field"


def test_stream_event_done():
    event = StreamEvent(event="done", data={"message": "complete"})
    assert event.data["message"] == "complete"


# ── CoachStreamEvent ──


def test_coach_stream_event_valid_types():
    for event_type in ("start", "text", "tool", "done", "error"):
        event = CoachStreamEvent(event=event_type, data={"test": True})
        assert event.event == event_type
