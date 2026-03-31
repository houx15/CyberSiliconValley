from __future__ import annotations

from contracts.auth import AuthUser, ErrorResponse, LoginRequest, LoginResponse, Role, SessionResponse
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
    "LoginRequest",
    "LoginResponse",
    "OnboardingResponse",
    "OnboardingUpdateRequest",
    "ProfileResponse",
    "Role",
    "SessionResponse",
    "TalentProfilePatch",
]
