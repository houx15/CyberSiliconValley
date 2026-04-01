from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ScopeType = Literal["talent_global", "enterprise_job", "enterprise_global"]


class MemoryEntryPayload(BaseModel):
    key: str
    value: str
    updated_at: str = Field(alias="updatedAt")


class MemorySpaceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    owner_id: str = Field(alias="ownerId")
    scope_type: ScopeType = Field(alias="scopeType")
    scope_ref_id: str | None = Field(alias="scopeRefId", default=None)
    entries: list[MemoryEntryPayload]


class MemorySpaceUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[MemoryEntryPayload]
