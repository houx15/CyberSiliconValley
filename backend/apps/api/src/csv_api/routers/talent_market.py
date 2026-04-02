"""Talent market browse for enterprise users."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from csv_api.dependencies import get_current_user, get_db_session
from db.models.match import Match
from db.models.pre_chat import PreChat
from db.models.talent_profile import TalentProfile

router = APIRouter(prefix="/api/v1/talent-market", tags=["talent-market"])


@router.get("")
def list_talent_market(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    """List visible talent profiles for enterprise browsing."""
    stmt = (
        select(TalentProfile)
        .where(TalentProfile.visible.is_(True), TalentProfile.onboarding_done.is_(True))
        .order_by(desc(TalentProfile.updated_at))
        .limit(100)
    )
    profiles = list(session.execute(stmt).scalars())

    talents = []
    for p in profiles:
        # Derive contact status if enterprise has interacted
        status = _talent_status(session, p.id, UUID(current_user.id))

        skills = [s.get("name", "") for s in (p.skills or [])]
        experience_years = _estimate_experience_years(p.experience or [])

        talents.append({
            "id": str(p.id),
            "name": p.display_name or "",
            "title": p.headline or "",
            "location": "",  # not in current model
            "skills": skills[:6],
            "matchScore": 0,  # real scoring requires job context
            "experience": f"{experience_years} 年" if experience_years else "",
            "status": status,
        })

    return {"talents": talents}


def _talent_status(session: Session, talent_id, enterprise_user_id) -> str:
    """Check if enterprise has any pre-chat or match interaction with this talent."""
    prechat = session.execute(
        select(PreChat.status).where(PreChat.talent_id == talent_id).limit(1)
    ).scalar_one_or_none()
    if prechat == "active":
        return "pre_chat"
    if prechat in ("completed",):
        return "contacted"
    return "available"


def _estimate_experience_years(experience: list[dict]) -> int:
    """Rough estimate from experience entries count."""
    if not experience:
        return 0
    return max(1, len(experience) * 2)
