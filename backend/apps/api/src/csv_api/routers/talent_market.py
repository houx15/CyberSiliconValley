"""Talent market browse for enterprise users."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from csv_api.dependencies import get_current_user, get_db_session
from db.models.pre_chat import PreChat
from db.models.talent_profile import TalentProfile
from db.repositories.profiles import get_enterprise_profile_by_user_id

router = APIRouter(prefix="/api/v1/talent-market", tags=["talent-market"])


@router.get("")
def list_talent_market(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    """List visible talent profiles for enterprise browsing."""
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Enterprise access required")

    enterprise_profile = get_enterprise_profile_by_user_id(session, UUID(current_user.id))

    stmt = (
        select(TalentProfile)
        .where(TalentProfile.visible.is_(True), TalentProfile.onboarding_done.is_(True))
        .order_by(desc(TalentProfile.updated_at))
        .limit(100)
    )
    profiles = list(session.execute(stmt).scalars())

    talents = []
    for p in profiles:
        status_val = _talent_status(session, p.id, enterprise_profile.id if enterprise_profile else None)
        skills = [s.get("name", "") for s in (p.skills or [])]
        experience_years = _estimate_experience_years(p.experience or [])

        talents.append({
            "id": str(p.id),
            "name": p.display_name or "",
            "title": p.headline or "",
            "location": "",
            "skills": skills[:6],
            "matchScore": 0,
            "experience": f"{experience_years} 年" if experience_years else "",
            "status": status_val,
        })

    return {"talents": talents}


def _talent_status(session: Session, talent_id, enterprise_id) -> str:
    """Check if THIS enterprise has any pre-chat interaction with this talent."""
    if enterprise_id is None:
        return "available"
    prechat = session.execute(
        select(PreChat.status).where(
            PreChat.talent_id == talent_id,
            PreChat.enterprise_id == enterprise_id,
        ).limit(1)
    ).scalar_one_or_none()
    if prechat == "active":
        return "pre_chat"
    if prechat in ("completed",):
        return "contacted"
    return "available"


def _estimate_experience_years(experience: list[dict]) -> int:
    if not experience:
        return 0
    return max(1, len(experience) * 2)
