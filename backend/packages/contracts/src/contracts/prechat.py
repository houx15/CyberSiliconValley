from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PreChatStatus = Literal[
    "pending_talent_opt_in",
    "pending_enterprise_opt_in",
    "active",
    "ai_screening",
    "pending_talent_review",
    "completed",
    "declined",
]

SenderType = Literal["ai_hr", "ai_talent", "human_enterprise", "human_talent"]


class PreChatRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    job_id: str = Field(alias="jobId")
    talent_id: str = Field(alias="talentId")
    enterprise_id: str = Field(alias="enterpriseId")
    status: PreChatStatus
    talent_opted_in: bool = Field(alias="talentOptedIn")
    enterprise_opted_in: bool = Field(alias="enterpriseOptedIn")
    ai_summary: str | None = Field(alias="aiSummary", default=None)
    round_count: int = Field(alias="roundCount")
    max_rounds: int = Field(alias="maxRounds")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class PreChatMessageRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    pre_chat_id: str = Field(alias="preChatId")
    sender_type: SenderType = Field(alias="senderType")
    content: str
    round_number: int = Field(alias="roundNumber")
    created_at: datetime = Field(alias="createdAt")


class PreChatWithMessages(PreChatRecord):
    messages: list[PreChatMessageRecord]


class PreChatInitiateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    job_id: str = Field(alias="jobId")
    talent_id: str = Field(alias="talentId")


class PreChatHumanReplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=10000)

    @field_validator("content")
    @classmethod
    def content_not_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content must not be whitespace-only")
        return v


class PreChatSummaryResponse(BaseModel):
    summary: str | None = None
    ready: bool = False
