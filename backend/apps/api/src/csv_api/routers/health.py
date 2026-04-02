from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from csv_api.config import get_settings
from csv_api.dependencies import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def health(session: Session = Depends(get_db_session)) -> dict[str, str]:
    settings = get_settings()
    try:
        session.execute(text("SELECT 1"))
        return {"status": "ok", "version": settings.app_version}
    except Exception:
        logger.exception("Health check failed")
        return {"status": "degraded", "version": settings.app_version}


@router.get("/ready")
def ready(session: Session = Depends(get_db_session)) -> dict[str, object]:
    settings = get_settings()
    db_status = "unknown"
    try:
        session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ready" if db_status == "ok" else "not_ready",
        "version": settings.app_version,
        "dependencies": {
            "database": {"status": db_status},
        },
    }
