from __future__ import annotations

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
)
from core.jobs.service import create_enterprise_job, get_enterprise_job_detail, list_enterprise_jobs
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_current_user, get_db_session
from ai.streaming.sse import stream_events_as_sse
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
def parse_job(
    payload: JobParseRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if current_user.role != "enterprise":
        return _forbidden_response()

    structured = _build_structured_job(payload.message)
    events = [
        StreamEvent(event="start", data={"surface": "jobs.parse"}),
        StreamEvent(event="tool", data={"name": "structure_job", "structured": structured}),
        StreamEvent(
            event="text",
            data={"delta": f'I structured this role as "{structured["title"]}". Review the draft before publishing.'},
        ),
        StreamEvent(
            event="done",
            data={"message": f'I structured this role as "{structured["title"]}". Review the draft before publishing.'},
        ),
    ]
    return stream_events_as_sse(events)


def _build_structured_job(message: str) -> dict[str, object]:
    normalized = message.strip()
    lower = normalized.lower()

    title = "AI Product Builder"
    if "rag" in lower:
        title = "RAG Engineer"
    elif "ml" in lower or "machine learning" in lower:
        title = "Machine Learning Engineer"
    elif "data" in lower:
        title = "Data Platform Engineer"
    elif "frontend" in lower:
        title = "Frontend Engineer"

    skills: list[dict[str, object]] = []
    for skill_name in ("Python", "LLM", "RAG", "Evaluation", "TypeScript", "SQL"):
        if skill_name.lower() in lower:
            skills.append(
                {
                    "name": skill_name,
                    "level": "advanced" if skill_name in {"Python", "TypeScript"} else "intermediate",
                    "required": True,
                }
            )

    if not skills:
        skills = [
            {"name": "Python", "level": "advanced", "required": True},
            {"name": "LLM Applications", "level": "intermediate", "required": True},
            {"name": "System Design", "level": "intermediate", "required": False},
        ]

    work_mode = "remote"
    if "hybrid" in lower:
        work_mode = "hybrid"
    elif "onsite" in lower or "on-site" in lower:
        work_mode = "onsite"

    seniority = "Mid"
    if "lead" in lower or "staff" in lower:
        seniority = "Lead"
    elif "senior" in lower:
        seniority = "Senior"
    elif "junior" in lower:
        seniority = "Junior"

    return {
        "title": title,
        "description": normalized,
        "skills": skills,
        "seniority": seniority,
        "timeline": "Open to discuss",
        "deliverables": [
            "Ship a production-ready pilot",
            "Translate ambiguous business goals into scoped AI workstreams",
        ],
        "budget": {"currency": "USD"},
        "workMode": work_mode,
    }
