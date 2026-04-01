from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WorkbenchStats(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    resumes_scanned: int = Field(alias="resumesScanned")
    preliminary_matches: int = Field(alias="preliminaryMatches")
    pre_chat_completed: int = Field(alias="preChatCompleted")
    invites_sent: int = Field(alias="invitesSent")
    invites_accepted: int = Field(alias="invitesAccepted")
    interviews_scheduled: int = Field(alias="interviewsScheduled")
    active_opportunities: int = Field(alias="activeOpportunities")
    talent_pool_size: int = Field(alias="talentPoolSize")
