from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from contracts.auth import AuthUser
from contracts.matches import MatchDetail, MatchListItem, MatchStatus
from db.models.job import Job
from db.models.talent_profile import TalentProfile
from db.repositories.inbox import create_inbox_item
from db.repositories.matching import (
    get_match_detail_for_enterprise,
    get_match_model_for_enterprise,
    list_matches_for_enterprise,
    update_match_status,
)
from db.repositories.profiles import get_enterprise_profile_by_user_id


def _require_enterprise_profile(session, current_user: AuthUser):
    return get_enterprise_profile_by_user_id(session, UUID(current_user.id))


def list_enterprise_matches(session, current_user: AuthUser) -> list[MatchListItem] | None:
    profile = _require_enterprise_profile(session, current_user)
    if profile is None:
        return None
    rows = list_matches_for_enterprise(session, profile.id)
    return [MatchListItem(**dict(row)) for row in rows]


def get_enterprise_match_detail(session, current_user: AuthUser, match_id: str) -> MatchDetail | None:
    profile = _require_enterprise_profile(session, current_user)
    if profile is None:
        return None
    row = get_match_detail_for_enterprise(session, UUID(match_id), profile.id)
    if row is None:
        return None
    return MatchDetail(**dict(row))


def update_enterprise_match(session, current_user: AuthUser, match_id: str, status: MatchStatus) -> MatchDetail | None:
    profile = _require_enterprise_profile(session, current_user)
    if profile is None:
        return None
    match = get_match_model_for_enterprise(session, UUID(match_id), profile.id)
    if match is None:
        return None
    update_match_status(session, match, status)
    if status == "invited":
        talent_profile = session.execute(
            select(TalentProfile).where(TalentProfile.id == match.talent_id)
        ).scalar_one_or_none()
        job = session.execute(select(Job).where(Job.id == match.job_id)).scalar_one_or_none()
        if talent_profile is not None:
            create_inbox_item(
                session,
                user_id=talent_profile.user_id,
                item_type="invite",
                title=f"You've been invited to apply: {job.title if job is not None else 'a position'}",
                content={
                    "jobId": str(match.job_id),
                    "jobTitle": job.title if job is not None else None,
                    "matchId": str(match.id),
                    "score": match.score,
                },
            )
    row = get_match_detail_for_enterprise(session, match.id, profile.id)
    if row is None:
        return None
    return MatchDetail(**dict(row))
