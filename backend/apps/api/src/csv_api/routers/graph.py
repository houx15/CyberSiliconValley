from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID

from contracts.graph import GraphDataResponse, JobDetail, KeywordJobsResponse
from core.graph.service import get_graph_data, get_job_detail, get_jobs_for_keyword
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_auth_service, get_db_session
from db.models.talent_profile import TalentProfile
from redis_layer.queue import enqueue_graph_refresh_job


router = APIRouter(prefix="/api/v1/graph", tags=["graph"])


def _resolve_talent_id(request: Request, session: Session, auth_service) -> str | None:
    token = request.cookies.get(auth_service.cookie_name)
    if not token:
        return None
    try:
        user = auth_service.read_token(token)
    except Exception:
        return None
    if user.role != "talent":
        return None
    talent_id = session.execute(
        select(TalentProfile.id).where(TalentProfile.user_id == UUID(user.id)).limit(1)
    ).scalar_one_or_none()
    return str(talent_id) if talent_id else None


@router.get("", response_model=GraphDataResponse)
async def read_graph(
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> GraphDataResponse:
    data = get_graph_data(session)
    if not data.nodes:
        try:
            await enqueue_graph_refresh_job(settings.redis_url or None)
        except Exception:
            pass
    return data


@router.get("/{keyword}/jobs", response_model=KeywordJobsResponse | JobDetail)
async def read_keyword_jobs(
    keyword: str,
    request: Request,
    session: Session = Depends(get_db_session),
    auth_service=Depends(get_auth_service),
) -> KeywordJobsResponse | JobDetail | JSONResponse:
    decoded_keyword = keyword
    talent_id = _resolve_talent_id(request, session, auth_service)
    job_id = request.query_params.get("jobId")

    if job_id:
        detail = get_job_detail(session, job_id, talent_id)
        if detail is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND", "message": "Job not found"})
        return detail

    jobs = get_jobs_for_keyword(session, decoded_keyword, talent_id)
    return KeywordJobsResponse(keyword=decoded_keyword, jobs=jobs)
