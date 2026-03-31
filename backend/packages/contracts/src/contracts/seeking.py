from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ScanSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    total_scanned: int = Field(alias="totalScanned")
    high_matches: int = Field(alias="highMatches")
    medium_matches: int = Field(alias="mediumMatches")
    period_label: str = Field(alias="periodLabel")


class SkillMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str
    matched: bool
    level: str


class HighMatchItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    match_id: str = Field(alias="matchId")
    job_id: str = Field(alias="jobId")
    job_title: str = Field(alias="jobTitle")
    company_name: str = Field(alias="companyName")
    location: str
    work_mode: str = Field(alias="workMode")
    score: float
    skill_matches: list[SkillMatch] = Field(alias="skillMatches")
    ai_assessment: str = Field(alias="aiAssessment")


class PreChatItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    inbox_item_id: str = Field(alias="inboxItemId")
    company_name: str = Field(alias="companyName")
    job_title: str = Field(alias="jobTitle")
    summary: str
    generated_at: str = Field(alias="generatedAt")


class InboundInterestItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    match_id: str = Field(alias="matchId")
    company_name: str = Field(alias="companyName")
    reason: str
    score: float
    job_id: str = Field(alias="jobId")


class SeekingReportData(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scan_summary: ScanSummary = Field(alias="scanSummary")
    high_matches: list[HighMatchItem] = Field(alias="highMatches")
    pre_chat_activity: list[PreChatItem] = Field(alias="preChatActivity")
    inbound_interest: list[InboundInterestItem] = Field(alias="inboundInterest")
    generated_at: str = Field(alias="generatedAt")


class SeekingResponse(BaseModel):
    data: SeekingReportData | None


class ResumeGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    talent_id: str = Field(alias="talentId", min_length=1)
    job_id: str = Field(alias="jobId", min_length=1)


class TailoredResumePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    markdown: str
    talent_name: str = Field(alias="talentName")
    job_title: str = Field(alias="jobTitle")
    company_name: str = Field(alias="companyName")


class TailoredResumeResponse(BaseModel):
    data: TailoredResumePayload
