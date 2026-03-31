from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

Role = Literal["talent", "enterprise"]


class TalentProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    headline: str | None = None
    bio: str | None = None
    skills: list[dict[str, Any]] | None = None
    experience: list[dict[str, Any]] | None = None
    education: list[dict[str, Any]] | None = None
    goals: dict[str, Any] | None = None
    availability: str | None = None
    salary_range: dict[str, Any] | None = None
    resume_url: str | None = None
    profile_data: dict[str, Any] | None = None
    onboarding_done: bool | None = None


class EnterpriseProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: str | None = None
    industry: str | None = None
    company_size: str | None = None
    website: str | None = None
    description: str | None = None
    ai_maturity: str | None = None
    profile_data: dict[str, Any] | None = None
    preferences: dict[str, Any] | None = None
    onboarding_done: bool | None = None


class ProfileResponse(BaseModel):
    profile: dict[str, Any]


class OnboardingUpdateRequest(BaseModel):
    role: Role | None = None
    profile: dict[str, Any]
    complete: bool = False


class OnboardingResponse(BaseModel):
    profile: dict[str, Any]
    onboarding_done: bool
