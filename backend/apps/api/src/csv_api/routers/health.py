from __future__ import annotations

from fastapi import APIRouter

from csv_api.config import get_settings

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "version": settings.app_version,
    }


@router.get("/ready")
def ready() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ready",
        "version": settings.app_version,
        "dependencies": {
            "database": {"status": "unknown"},
            "redis": {"status": "unknown"},
        },
    }
