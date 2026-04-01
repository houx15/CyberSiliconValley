from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TalentHomeStats(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    companies_explored: int = Field(alias="companiesExplored")
    pre_chats_active: int = Field(alias="preChatsActive")
    invites_received: int = Field(alias="invitesReceived")
    matches_found: int = Field(alias="matchesFound")
    seeking_report_ready: bool = Field(alias="seekingReportReady")
