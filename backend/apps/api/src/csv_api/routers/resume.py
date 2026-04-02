from __future__ import annotations

import json

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID

from ai.providers.router import ProviderRouter
from ai.workflows.resume_gen import generate_tailored_resume
from contracts.auth import AuthUser
from contracts.seeking import ResumeGenerateRequest, TailoredResumeResponse
from core.seeking.service import build_fallback_resume
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from db.models.talent_profile import TalentProfile
from db.repositories.graph import get_enterprise_name, get_job


router = APIRouter(prefix="/api/v1/resume", tags=["resume"])


@router.post("/generate", response_model=TailoredResumeResponse)
async def generate_resume(
    payload: ResumeGenerateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
) -> TailoredResumeResponse | JSONResponse:
    profile = session.get(TalentProfile, UUID(payload.talent_id))
    if profile is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Talent profile not found"})

    if current_user.role == "talent" and str(profile.user_id) != current_user.id:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "Forbidden"})

    job = get_job(session, UUID(payload.job_id))
    if job is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Job not found"})

    company_name = get_enterprise_name(session, job.enterprise_id)

    # Try LLM-powered generation, fall back to template
    if provider_router.provider is not None:
        profile_json = json.dumps({
            "displayName": profile.display_name,
            "headline": profile.headline,
            "bio": profile.bio,
            "skills": profile.skills or [],
            "experience": profile.experience or [],
            "education": profile.education or [],
        }, ensure_ascii=False, default=str)

        try:
            markdown = await generate_tailored_resume(
                provider_router,
                profile_json=profile_json,
                job_title=job.title,
                company_name=company_name,
                job_description=job.description or str(job.structured or {}),
            )
            from contracts.seeking import TailoredResumePayload
            return TailoredResumeResponse(data=TailoredResumePayload(
                markdown=markdown,
                talent_name=profile.display_name or "",
                job_title=job.title,
                company_name=company_name,
            ))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("LLM resume generation failed, falling back to template")

    # Fallback to template-based resume
    result = build_fallback_resume(session, payload.talent_id, payload.job_id)
    if result is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Could not generate resume"})
    return TailoredResumeResponse(data=result)
