from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MatchStatus = Literal["new", "viewed", "shortlisted", "invited", "applied", "rejected"]


class MatchScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    job_id: str = Field(alias="jobId", min_length=1)


class MatchStatusPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MatchStatus


class MatchListItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    match_id: str = Field(alias="matchId")
    job_id: str = Field(alias="jobId")
    talent_id: str = Field(alias="talentId")
    score: float
    breakdown: dict[str, Any]
    status: MatchStatus
    ai_reasoning: str | None = Field(alias="aiReasoning", default=None)
    created_at: datetime = Field(alias="createdAt")
    job_title: str | None = Field(alias="jobTitle", default=None)
    talent_name: str | None = Field(alias="talentName", default=None)
    talent_headline: str | None = Field(alias="talentHeadline", default=None)


class MatchDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    match_id: str = Field(alias="matchId")
    job_id: str = Field(alias="jobId")
    talent_id: str = Field(alias="talentId")
    score: float
    breakdown: dict[str, Any]
    status: MatchStatus
    ai_reasoning: str | None = Field(alias="aiReasoning", default=None)
    created_at: datetime = Field(alias="createdAt")
    job_title: str | None = Field(alias="jobTitle", default=None)
    talent_name: str | None = Field(alias="talentName", default=None)
    talent_headline: str | None = Field(alias="talentHeadline", default=None)
    display_name: str | None = Field(alias="displayName", default=None)
    headline: str | None = None
    skills: list[dict[str, Any]] = Field(default_factory=list)
    availability: str | None = None


class MatchListResponse(BaseModel):
    matches: list[MatchListItem]


class MatchDetailResponse(BaseModel):
    match: MatchDetail


class MatchStatusResponse(BaseModel):
    match: MatchDetail


class MatchScanQueuedResponse(BaseModel):
    message: str
    queue_job_id: str | None = Field(alias="queueJobId", default=None)
