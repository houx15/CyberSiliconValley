from __future__ import annotations

from fastapi import FastAPI

from csv_api.config import get_settings
from csv_api.routers.auth import router as auth_router
from csv_api.routers.health import router as health_router
from csv_api.routers.onboarding import router as onboarding_router
from csv_api.routers.profile import router as profile_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(onboarding_router)
    app.state.settings = settings
    return app


app = create_app()
