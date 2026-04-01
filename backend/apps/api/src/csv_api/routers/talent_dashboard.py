from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.talent_dashboard import TalentHomeStats
from csv_api.dependencies import get_current_user, get_db_session
from db.models.match import Match
from db.models.pre_chat import PreChat
from db.models.seeking_report import SeekingReport
from db.models.talent_profile import TalentProfile


router = APIRouter(prefix="/api/v1/talent", tags=["talent-dashboard"])


@router.get("/home-stats", response_model=TalentHomeStats)
def home_stats(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TalentHomeStats | JSONResponse:
    if current_user.role != "talent":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})

    profile = session.execute(
        select(TalentProfile).where(TalentProfile.user_id == UUID(current_user.id))
    ).scalar_one_or_none()
    if profile is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    matches_found = session.execute(
        select(func.count()).select_from(Match).where(Match.talent_id == profile.id)
    ).scalar() or 0

    invites = session.execute(
        select(func.count()).select_from(Match).where(
            Match.talent_id == profile.id, Match.status == "invited"
        )
    ).scalar() or 0

    prechats_active = session.execute(
        select(func.count()).select_from(PreChat).where(
            PreChat.talent_id == profile.id, PreChat.status == "active"
        )
    ).scalar() or 0

    # Count unique enterprise_ids from matches as "companies explored"
    companies = session.execute(
        select(func.count(func.distinct(PreChat.enterprise_id))).where(
            PreChat.talent_id == profile.id
        )
    ).scalar() or 0

    seeking_ready = session.execute(
        select(SeekingReport).where(SeekingReport.talent_id == profile.id).limit(1)
    ).scalar_one_or_none() is not None

    return TalentHomeStats(
        companiesExplored=companies,
        preChatsActive=prechats_active,
        invitesReceived=invites,
        matchesFound=matches_found,
        seekingReportReady=seeking_ready,
    )
