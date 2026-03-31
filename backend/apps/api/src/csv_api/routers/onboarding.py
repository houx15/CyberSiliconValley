from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.profile import OnboardingResponse, OnboardingUpdateRequest
from core.profiles.onboarding import apply_onboarding_update
from csv_api.dependencies import get_current_user, get_db_session


router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.patch("", response_model=OnboardingResponse)
def patch_onboarding(
    payload: OnboardingUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OnboardingResponse:
    profile, onboarding_done = apply_onboarding_update(
        session,
        current_user,
        payload.profile,
        complete=payload.complete,
    )
    session.commit()
    return OnboardingResponse(profile=profile, onboarding_done=onboarding_done)
