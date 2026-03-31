from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GraphNodePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    keyword: str
    job_count: int = Field(alias="jobCount")
    trending: bool


class GraphEdgePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    source_id: str = Field(alias="sourceId")
    target_id: str = Field(alias="targetId")
    weight: float


class GraphDataResponse(BaseModel):
    nodes: list[GraphNodePayload]
    edges: list[GraphEdgePayload]


class ClusterJobSkill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    level: str
    required: bool


class ClusterJob(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    title: str
    company_name: str = Field(alias="companyName")
    location: str
    work_mode: str = Field(alias="workMode")
    match_score: float | None = Field(alias="matchScore")
    skills: list[ClusterJobSkill]


class KeywordJobsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keyword: str
    jobs: list[ClusterJob]


class JobDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    title: str
    description: str
    company_name: str = Field(alias="companyName")
    location: str
    work_mode: str = Field(alias="workMode")
    seniority: str
    budget_range: str = Field(alias="budgetRange")
    timeline: str
    deliverables: str
    match_score: float | None = Field(alias="matchScore")
    match_breakdown: dict[str, Any] | None = Field(alias="matchBreakdown")
    ai_reasoning: str | None = Field(alias="aiReasoning")
    skills: list[ClusterJobSkill]
