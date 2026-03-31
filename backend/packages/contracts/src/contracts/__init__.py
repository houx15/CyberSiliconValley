from __future__ import annotations

from contracts.auth import AuthUser, ErrorResponse, LoginRequest, LoginResponse, Role, SessionResponse
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

__all__ = [
    "AuthUser",
    "ErrorResponse",
    "EnterpriseProfilePatch",
    "JobCreateRequest",
    "JobCreateResponse",
    "JobDetailMatch",
    "JobDetailResponse",
    "JobListResponse",
    "JobRecord",
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
    "SessionResponse",
    "TalentProfilePatch",
]
