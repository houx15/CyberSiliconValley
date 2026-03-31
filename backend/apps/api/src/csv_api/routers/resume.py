from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID

from contracts.auth import AuthUser
from contracts.seeking import ResumeGenerateRequest, TailoredResumeResponse
from core.seeking.service import build_fallback_resume
from csv_api.dependencies import get_current_user, get_db_session
from db.models.talent_profile import TalentProfile


router = APIRouter(prefix="/api/v1/resume", tags=["resume"])


@router.post("/generate", response_model=TailoredResumeResponse)
def generate_resume(
    payload: ResumeGenerateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TailoredResumeResponse | JSONResponse:
    profile = session.get(TalentProfile, UUID(payload.talent_id))
    if profile is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Talent profile not found"})

    if current_user.role == "talent" and str(profile.user_id) != current_user.id:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "Forbidden"})

    result = build_fallback_resume(session, payload.talent_id, payload.job_id)
    if result is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Job not found"})
    return TailoredResumeResponse(data=result)
