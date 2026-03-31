from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.seeking import SeekingResponse
from core.seeking.service import get_latest_report_by_user_id
from csv_api.config import Settings, get_settings
from csv_api.dependencies import get_current_user, get_db_session
from redis_layer.queue import enqueue_seeking_report_job


router = APIRouter(prefix="/api/v1/seeking", tags=["seeking"])


@router.get("", response_model=SeekingResponse)
async def read_seeking_report(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> SeekingResponse | JSONResponse:
    if current_user.role != "talent":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "Forbidden"})

    talent_id, report = get_latest_report_by_user_id(session, current_user.id)
    if report is None and talent_id is not None:
        try:
            await enqueue_seeking_report_job(settings.redis_url or None, talent_id)
        except Exception:
            pass

    return SeekingResponse(data=report)
