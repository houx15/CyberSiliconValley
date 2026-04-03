from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

InboxItemType = Literal["match_notification", "invite", "prechat_summary", "new_message", "system"]
InboxFilter = Literal["all", "invites", "prechats", "matches", "messages", "system"]


class InboxItemRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    item_type: InboxItemType = Field(alias="itemType")
    title: str
    content: dict[str, Any]
    read: bool
    created_at: str = Field(alias="createdAt")


class InboxListPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    items: list[InboxItemRecord]
    unread_count: int = Field(alias="unreadCount")


class InboxListResponse(BaseModel):
    data: InboxListPayload


class InboxDetailResponse(BaseModel):
    data: InboxItemRecord


class InboxMarkReadResponse(BaseModel):
    success: bool
