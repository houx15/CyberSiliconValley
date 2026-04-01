from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

JobStatus = Literal["open", "reviewing", "filled", "closed"]
WorkMode = Literal["remote", "onsite", "hybrid"]


class StructuredJobSkill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    level: str
    required: bool


class StructuredJobBudget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min: float | None = None
    max: float | None = None
    currency: str


class StructuredJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    skills: list[StructuredJobSkill]
    seniority: str
    timeline: str
    deliverables: list[str]
    budget: StructuredJobBudget
    work_mode: WorkMode = Field(alias="workMode")
    location: str | None = None
    focus_category: str | None = Field(default=None, alias="focusCategory")


class JobCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str = Field(min_length=1)
    description: str | None = None
    structured: StructuredJobPayload
    auto_match: bool = Field(default=True, alias="autoMatch")
    auto_prechat: bool = Field(default=False, alias="autoPrechat")


class JobParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1)


class JobRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    enterprise_id: str = Field(alias="enterpriseId")
    title: str
    description: str | None = None
    structured: StructuredJobPayload
    status: JobStatus
    auto_match: bool = Field(alias="autoMatch")
    auto_prechat: bool = Field(alias="autoPrechat")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class JobListItem(JobRecord):
    match_count: int = Field(alias="matchCount")
    shortlisted_count: int = Field(alias="shortlistedCount")


class JobListResponse(BaseModel):
    jobs: list[JobListItem]


class JobCreateResponse(BaseModel):
    job: JobRecord


class JobDetailResponse(BaseModel):
    job: JobRecord
    matches: list["JobDetailMatch"]


class JobDetailMatch(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    match_id: str = Field(alias="matchId")
    talent_id: str = Field(alias="talentId")
    score: float
    breakdown: dict[str, Any]
    status: str
    ai_reasoning: str | None = Field(alias="aiReasoning", default=None)
    created_at: datetime = Field(alias="createdAt")
    display_name: str | None = Field(alias="displayName", default=None)
    headline: str | None = None
    skills: list[dict[str, Any]] = Field(default_factory=list)
    availability: str | None = None
