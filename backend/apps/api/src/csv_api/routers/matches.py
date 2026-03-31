from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.matches import (
    MatchDetailResponse,
    MatchListResponse,
    MatchScanQueuedResponse,
    MatchScanRequest,
    MatchStatusPatchRequest,
    MatchStatusResponse,
)
from core.jobs.service import get_enterprise_job_detail
from core.matching.service import get_enterprise_match_detail, list_enterprise_matches, update_enterprise_match
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_current_user, get_db_session
from redis_layer.queue import enqueue_match_scan_job


router = APIRouter(prefix="/api/v1/matches", tags=["matches"])


def _forbidden_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "FORBIDDEN", "message": "Enterprise access required"},
    )


def _not_found_response(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "NOT_FOUND", "message": message},
    )


@router.get("", response_model=MatchListResponse)
def list_matches(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MatchListResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    matches = list_enterprise_matches(session, current_user)
    if matches is None:
        return _not_found_response("Enterprise profile not found")
    return MatchListResponse(matches=matches)


@router.post("/scan", response_model=MatchScanQueuedResponse)
async def scan_matches(
    payload: MatchScanRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> MatchScanQueuedResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    job_payload = get_enterprise_job_detail(session, current_user, payload.job_id)
    if job_payload is None:
        return _not_found_response("Job not found")

    queued = await enqueue_match_scan_job(settings.redis_url or None, payload.job_id)
    return MatchScanQueuedResponse(
        message="Match scan queued",
        queue_job_id=getattr(queued, "job_id", None),
    )


@router.get("/{match_id}", response_model=MatchDetailResponse)
def read_match(
    match_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MatchDetailResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    match = get_enterprise_match_detail(session, current_user, match_id)
    if match is None:
        return _not_found_response("Match not found")
    return MatchDetailResponse(match=match)


@router.patch("/{match_id}", response_model=MatchStatusResponse)
def patch_match(
    match_id: str,
    payload: MatchStatusPatchRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MatchStatusResponse | JSONResponse:
    if current_user.role != "enterprise":
        return _forbidden_response()

    match = update_enterprise_match(session, current_user, match_id, payload.status)
    if match is None:
        return _not_found_response("Match not found")

    session.commit()
    return MatchStatusResponse(match=match)
