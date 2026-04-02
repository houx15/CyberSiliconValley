from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from csv_api.config import get_settings
from csv_api.routers.auth import router as auth_router
from csv_api.routers.coach import router as coach_router
from csv_api.routers.companion import router as companion_router
from csv_api.routers.enterprise_dashboard import router as enterprise_dashboard_router
from csv_api.routers.enterprise_onboarding import router as enterprise_onboarding_router
from csv_api.routers.graph import router as graph_router
from csv_api.routers.health import router as health_router
from csv_api.routers.inbox import router as inbox_router
from csv_api.routers.jobs import router as jobs_router
from csv_api.routers.matches import router as matches_router
from csv_api.routers.memory import router as memory_router
from csv_api.routers.onboarding import router as onboarding_router
from csv_api.routers.prechat import router as prechat_router
from csv_api.routers.profile import router as profile_router
from csv_api.routers.resume import router as resume_router
from csv_api.routers.screening import router as screening_router
from csv_api.routers.seeking import router as seeking_router
from csv_api.routers.subscription import router as subscription_router
from csv_api.routers.talent_dashboard import router as talent_dashboard_router
from csv_api.routers.talent_ai import router as talent_ai_router
from csv_api.routers.talent_market import router as talent_market_router
from csv_api.routers.upload import router as upload_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(coach_router)
    app.include_router(companion_router)
    app.include_router(profile_router)
    app.include_router(onboarding_router)
    app.include_router(enterprise_onboarding_router)
    app.include_router(enterprise_dashboard_router)
    app.include_router(jobs_router)
    app.include_router(matches_router)
    app.include_router(inbox_router)
    app.include_router(seeking_router)
    app.include_router(graph_router)
    app.include_router(resume_router)
    app.include_router(screening_router)
    app.include_router(prechat_router)
    app.include_router(memory_router)
    app.include_router(subscription_router)
    app.include_router(talent_ai_router)
    app.include_router(talent_dashboard_router)
    app.include_router(talent_market_router)
    app.include_router(upload_router)
    app.state.settings = settings
    return app


app = create_app()
