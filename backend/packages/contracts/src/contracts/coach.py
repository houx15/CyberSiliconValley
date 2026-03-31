from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


CoachMode = Literal["chat", "resume-review", "mock-interview", "skill-gaps"]
CoachMessageRole = Literal["user", "assistant", "system"]
StreamEventName = Literal["start", "text", "tool", "done", "error"]


class CoachMessagePart(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    text: str | None = None


class CoachMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: CoachMessageRole
    content: str | None = None
    parts: list[CoachMessagePart] | None = None

    @model_validator(mode="after")
    def validate_text_payload(self) -> "CoachMessage":
        has_content = bool((self.content or "").strip())
        has_part_text = any(bool((part.text or "").strip()) for part in self.parts or [])
        if not has_content and not has_part_text:
            raise ValueError("message must include content or text parts")
        return self


class CoachRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[CoachMessage] = Field(min_length=1)
    mode: CoachMode = "chat"


class CoachStreamEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: StreamEventName
    data: dict[str, Any]
