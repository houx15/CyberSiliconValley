from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["talent", "enterprise"]


class TalentProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    display_name: str | None = Field(default=None, alias="displayName")
    headline: str | None = None
    bio: str | None = None
    skills: list[dict[str, Any]] | None = None
    experience: list[dict[str, Any]] | None = None
    education: list[dict[str, Any]] | None = None
    goals: dict[str, Any] | None = None
    availability: str | None = None
    salary_range: dict[str, Any] | None = Field(default=None, alias="salaryRange")
    resume_url: str | None = Field(default=None, alias="resumeUrl")
    profile_data: dict[str, Any] | None = Field(default=None, alias="profileData")
    onboarding_done: bool | None = Field(default=None, alias="onboardingDone")


class EnterpriseProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    company_name: str | None = Field(default=None, alias="companyName")
    industry: str | None = None
    company_size: str | None = Field(default=None, alias="companySize")
    website: str | None = None
    description: str | None = None
    ai_maturity: str | None = Field(default=None, alias="aiMaturity")
    profile_data: dict[str, Any] | None = Field(default=None, alias="profileData")
    preferences: dict[str, Any] | None = None
    onboarding_done: bool | None = Field(default=None, alias="onboardingDone")


class ProfileResponse(BaseModel):
    profile: dict[str, Any]


class OnboardingUpdateRequest(BaseModel):
    role: Role | None = None
    profile: dict[str, Any]
    complete: bool = False


class OnboardingResponse(BaseModel):
    profile: dict[str, Any]
    onboarding_done: bool
