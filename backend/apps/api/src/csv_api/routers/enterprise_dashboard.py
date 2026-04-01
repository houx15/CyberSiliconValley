from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.enterprise_dashboard import WorkbenchStats
from csv_api.dependencies import get_current_user, get_db_session
from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.match import Match
from db.models.pre_chat import PreChat
from db.models.talent_profile import TalentProfile


router = APIRouter(prefix="/api/v1/enterprise", tags=["enterprise-dashboard"])


@router.get("/workbench-stats", response_model=WorkbenchStats)
def workbench_stats(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> WorkbenchStats | JSONResponse:
    if current_user.role != "enterprise":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})

    profile = session.execute(
        select(EnterpriseProfile).where(EnterpriseProfile.user_id == UUID(current_user.id))
    ).scalar_one_or_none()
    if profile is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    job_ids = session.execute(
        select(Job.id).where(Job.enterprise_id == profile.id)
    ).scalars().all()

    active_opps = session.execute(
        select(func.count()).select_from(Job).where(Job.enterprise_id == profile.id, Job.status == "open")
    ).scalar() or 0

    total_matches = 0
    shortlisted = 0
    invited = 0
    if job_ids:
        total_matches = session.execute(
            select(func.count()).select_from(Match).where(Match.job_id.in_(job_ids))
        ).scalar() or 0
        shortlisted = session.execute(
            select(func.count()).select_from(Match).where(
                Match.job_id.in_(job_ids), Match.status == "shortlisted"
            )
        ).scalar() or 0
        invited = session.execute(
            select(func.count()).select_from(Match).where(
                Match.job_id.in_(job_ids), Match.status == "invited"
            )
        ).scalar() or 0

    prechat_completed = session.execute(
        select(func.count()).select_from(PreChat).where(
            PreChat.enterprise_id == profile.id, PreChat.status == "completed"
        )
    ).scalar() or 0

    talent_pool = session.execute(
        select(func.count()).select_from(TalentProfile)
    ).scalar() or 0

    return WorkbenchStats(
        resumesScanned=talent_pool,
        preliminaryMatches=total_matches,
        preChatCompleted=prechat_completed,
        invitesSent=invited,
        invitesAccepted=shortlisted,
        interviewsScheduled=0,
        activeOpportunities=active_opps,
        talentPoolSize=talent_pool,
    )
