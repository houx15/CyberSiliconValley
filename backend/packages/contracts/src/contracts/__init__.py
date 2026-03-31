from __future__ import annotations

from contracts.auth import AuthUser, ErrorResponse, LoginRequest, LoginResponse, Role, SessionResponse
from contracts.coach import CoachMessage, CoachMessagePart, CoachMode, CoachRequest, CoachStreamEvent
from contracts.graph import GraphDataResponse, JobDetail, KeywordJobsResponse
from contracts.inbox import InboxDetailResponse, InboxListResponse, InboxMarkReadResponse
from contracts.jobs import (
    JobCreateRequest,
    JobCreateResponse,
    JobDetailMatch,
    JobDetailResponse,
    JobListResponse,
    JobRecord,
)
from contracts.matches import (
    MatchDetail,
    MatchDetailResponse,
    MatchListItem,
    MatchListResponse,
    MatchScanQueuedResponse,
    MatchScanRequest,
    MatchStatusPatchRequest,
    MatchStatusResponse,
)
from contracts.profile import (
    EnterpriseProfilePatch,
    OnboardingResponse,
    OnboardingUpdateRequest,
    ProfileResponse,
    TalentProfilePatch,
)
from contracts.screening import ScreeningRequest, ScreeningStreamEvent
from contracts.seeking import ResumeGenerateRequest, SeekingResponse, TailoredResumeResponse

__all__ = [
    "AuthUser",
    "CoachMessage",
    "CoachMessagePart",
    "CoachMode",
    "CoachRequest",
    "CoachStreamEvent",
    "ErrorResponse",
    "EnterpriseProfilePatch",
    "GraphDataResponse",
    "InboxDetailResponse",
    "InboxListResponse",
    "InboxMarkReadResponse",
    "JobCreateRequest",
    "JobCreateResponse",
    "JobDetailMatch",
    "JobDetailResponse",
    "JobDetail",
    "JobListResponse",
    "JobRecord",
    "KeywordJobsResponse",
    "LoginRequest",
    "LoginResponse",
    "MatchDetail",
    "MatchDetailResponse",
    "MatchListItem",
    "MatchListResponse",
    "MatchScanQueuedResponse",
    "MatchScanRequest",
    "MatchStatusPatchRequest",
    "MatchStatusResponse",
    "OnboardingResponse",
    "OnboardingUpdateRequest",
    "ProfileResponse",
    "Role",
    "ScreeningRequest",
    "ScreeningStreamEvent",
    "ResumeGenerateRequest",
    "SeekingResponse",
    "SessionResponse",
    "TailoredResumeResponse",
    "TalentProfilePatch",
]
