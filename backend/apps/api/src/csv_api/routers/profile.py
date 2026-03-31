from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.profile import EnterpriseProfilePatch, ProfileResponse, TalentProfilePatch
from core.profiles.service import get_current_profile, update_current_profile
from csv_api.dependencies import get_current_user, get_db_session


router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
def read_profile(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> ProfileResponse | JSONResponse:
    profile = get_current_profile(session, current_user)
    if profile is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": "Profile not found"},
        )
    return ProfileResponse(profile=profile)


@router.patch("", response_model=ProfileResponse)
def patch_profile(
    payload: TalentProfilePatch | EnterpriseProfilePatch,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> ProfileResponse | JSONResponse:
    updates = payload.model_dump(exclude_none=True)
    profile = update_current_profile(session, current_user, updates)
    if profile is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": "Profile not found"},
        )
    session.commit()
    return ProfileResponse(profile=profile)
