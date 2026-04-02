from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.chat import StreamEvent
from contracts.jobs import (
    JobCreateRequest,
    JobCreateResponse,
    JobDetailResponse,
    JobListResponse,
    JobParseRequest,
    JobUpdateRequest,
)
from core.jobs.service import create_enterprise_job, get_enterprise_job_detail, list_enterprise_jobs
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_ai_provider_router, get_current_user, get_db_session
from ai.prompts.job_parse import JOB_PARSE_SYSTEM_PROMPT, JOB_PARSE_TOOLS
from ai.providers.router import AICompletionRequest, ProviderRouter
from ai.streaming.sse import stream_async_events_as_sse
from db.repositories.jobs import get_job_by_id_for_enterprise
from db.repositories.profiles import get_enterprise_profile_by_user_id
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


@router.post("/parse")
async def parse_job(
    payload: JobParseRequest,
    current_user: AuthUser = Depends(get_current_user),
    provider_router: ProviderRouter = Depends(get_ai_provider_router),
):
    if current_user.role != "enterprise":
        return _forbidden_response()

    if provider_router.provider is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "AI_NOT_CONFIGURED", "message": "AI provider is not configured. Set AI_API_KEY."},
        )

    request = AICompletionRequest(
        surface="jobs.parse",
        system_prompt=JOB_PARSE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": payload.message}],
        metadata={"tools": JOB_PARSE_TOOLS},
    )

    async def generate():
        yield StreamEvent(event="start", data={"surface": "jobs.parse"})
        full_text = ""
        async for event in provider_router.stream(request):
            if event["event"] == "text":
                full_text += event["data"]["delta"]
                yield StreamEvent(event="text", data=event["data"])
            elif event["event"] == "tool":
                yield StreamEvent(event="tool", data=event["data"])
        yield StreamEvent(event="done", data={"message": full_text})

    return stream_async_events_as_sse(generate())


@router.patch("/{job_id}")
def update_job(
    job_id: str,
    payload: JobUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    if current_user.role != "enterprise":
        return _forbidden_response()

    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"error": "Invalid job ID"})

    profile = get_enterprise_profile_by_user_id(session, UUID(current_user.id))
    if profile is None:
        return _missing_profile_response()

    job = get_job_by_id_for_enterprise(session, job_uuid, profile.id)
    if job is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": "Job not found"},
        )

    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(job, field, value)
    session.commit()

    return {"job": {"id": str(job.id), "title": job.title, "status": job.status}}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    if current_user.role != "enterprise":
        return _forbidden_response()

    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"error": "Invalid job ID"})

    profile = get_enterprise_profile_by_user_id(session, UUID(current_user.id))
    if profile is None:
        return _missing_profile_response()

    job = get_job_by_id_for_enterprise(session, job_uuid, profile.id)
    if job is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": "Job not found"},
        )

    session.delete(job)
    session.commit()
