from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.jobs import JobCreateRequest, JobCreateResponse, JobDetailResponse, JobListResponse
from core.jobs.service import create_enterprise_job, get_enterprise_job_detail, list_enterprise_jobs
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_current_user, get_db_session
from redis_layer.queue import enqueue_match_scan_job


router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def _forbidden_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "FORBIDDEN", "message": "Enterprise access required"},
    )


def _missing_profile_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "NOT_FOUND", "message": "Enterprise profile not found"},
    )


@router.get("", response_model=JobListResponse)
def list_jobs(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> JobListResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    jobs = list_enterprise_jobs(session, current_user)
    if jobs is None:
        return _missing_profile_response()
    return JobListResponse(jobs=jobs)


@router.post("", response_model=JobCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> JobCreateResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    job = create_enterprise_job(session, current_user, payload)
    if job is None:
        return _missing_profile_response()

    session.commit()

    try:
        await enqueue_match_scan_job(settings.redis_url or None, job.id)
    except Exception:
        pass

    return JobCreateResponse(job=job)


@router.get("/{job_id}", response_model=JobDetailResponse)
def read_job_detail(
    job_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> JobDetailResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    payload = get_enterprise_job_detail(session, current_user, job_id)
    if payload is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": "Job not found"},
        )

    job, matches = payload
    return JobDetailResponse(job=job, matches=matches)
