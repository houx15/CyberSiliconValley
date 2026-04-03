from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from contracts.prechat import PreChatMessageRecord


class ConversationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    talent_id: str = Field(alias="talentId")
    enterprise_id: str = Field(alias="enterpriseId")
    job_id: str | None = Field(alias="jobId", default=None)
    pre_chat_id: str | None = Field(alias="preChatId", default=None)
    status: str
    talent_name: str = Field(alias="talentName", default="")
    company_name: str = Field(alias="companyName", default="")
    job_title: str | None = Field(alias="jobTitle", default=None)
    talent_headline: str | None = Field(alias="talentHeadline", default=None)
    last_message: str | None = Field(alias="lastMessage", default=None)
    last_message_at: str | None = Field(alias="lastMessageAt", default=None)
    created_at: str = Field(alias="createdAt", default="")


class DirectMessageRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    conversation_id: str = Field(alias="conversationId")
    sender_type: str = Field(alias="senderType")
    content: str
    created_at: str = Field(alias="createdAt")


class ConversationListResponse(BaseModel):
    conversations: list[ConversationRecord]


class ConversationDetailResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    conversation: ConversationRecord
    messages: list[DirectMessageRecord]
    pre_chat_messages: list[PreChatMessageRecord] | None = Field(alias="preChatMessages", default=None)
    has_more: bool = Field(alias="hasMore", default=False)


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=10000)

    @field_validator("content")
    @classmethod
    def content_not_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content must not be whitespace-only")
        return v


class SendMessageResponse(BaseModel):
    message: DirectMessageRecord


class PollMessagesResponse(BaseModel):
    messages: list[DirectMessageRecord]
