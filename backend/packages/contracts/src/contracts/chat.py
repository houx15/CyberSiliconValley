from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ChatRole = Literal["user", "assistant", "system"]


class ChatMessagePart(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    text: str | None = None


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: ChatRole
    content: str | None = None
    parts: list[ChatMessagePart] | None = None

    @model_validator(mode="after")
    def validate_text_payload(self) -> "ChatMessage":
        has_content = bool((self.content or "").strip())
        has_part_text = any(bool((part.text or "").strip()) for part in self.parts or [])
        if not has_content and not has_part_text:
            raise ValueError("message must include content or text parts")
        return self


class CompanionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1)
    session_type: str = Field(default="general", alias="sessionType")


class SimpleChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1)


class StreamEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str
    data: dict[str, Any]
