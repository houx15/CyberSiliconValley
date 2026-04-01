from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionTierRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    name: str
    role: Literal["talent", "enterprise"]
    price_cents: int = Field(alias="priceCents")
    currency: str
    limits: dict[str, int | None]
    is_active: bool = Field(alias="isActive")


class UserSubscriptionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    user_id: str = Field(alias="userId")
    tier_id: str = Field(alias="tierId")
    tier_name: str = Field(alias="tierName")
    status: Literal["active", "expired", "cancelled"]
    current_period_start: str = Field(alias="currentPeriodStart")
    current_period_end: str = Field(alias="currentPeriodEnd")


class UsageData(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    matches_today: int = Field(alias="matchesToday")
    matches_limit: int = Field(alias="matchesLimit")
    pre_chats_today: int = Field(alias="preChatsToday")
    pre_chats_limit: int = Field(alias="preChatsLimit")
    coach_today: int = Field(alias="coachToday")
    coach_limit: int = Field(alias="coachLimit")


class UpgradeTierRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    tier_id: str = Field(alias="tierId")
