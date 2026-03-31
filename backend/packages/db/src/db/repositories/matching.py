from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from db.models.job import Job
from db.models.match import Match
from db.models.enterprise_profile import EnterpriseProfile
from db.models.talent_profile import TalentProfile


def list_matches_for_job(session: Session, job_id: UUID, enterprise_id: UUID):
    statement = (
        select(
            Match.id.label("match_id"),
            Match.job_id.label("job_id"),
            Match.talent_id.label("talent_id"),
            Match.score,
            Match.breakdown,
            Match.status,
            Match.ai_reasoning.label("ai_reasoning"),
            Match.created_at.label("created_at"),
            TalentProfile.display_name.label("display_name"),
            TalentProfile.headline.label("headline"),
            TalentProfile.skills.label("skills"),
            TalentProfile.availability.label("availability"),
        )
        .join(Job, Match.job_id == Job.id)
        .outerjoin(TalentProfile, Match.talent_id == TalentProfile.id)
        .where(Match.job_id == job_id, Job.enterprise_id == enterprise_id)
        .order_by(desc(Match.score))
    )
    return session.execute(statement).mappings().all()


def list_matches_for_enterprise(session: Session, enterprise_id: UUID):
    statement = (
        select(
            Match.id.label("match_id"),
            Match.job_id.label("job_id"),
            Match.talent_id.label("talent_id"),
            Match.score,
            Match.breakdown,
            Match.status,
            Match.ai_reasoning.label("ai_reasoning"),
            Match.created_at.label("created_at"),
            Job.title.label("job_title"),
            TalentProfile.display_name.label("talent_name"),
            TalentProfile.headline.label("talent_headline"),
        )
        .join(Job, Match.job_id == Job.id)
        .outerjoin(TalentProfile, Match.talent_id == TalentProfile.id)
        .where(Job.enterprise_id == enterprise_id)
        .order_by(desc(Match.score))
    )
    return session.execute(statement).mappings().all()


def get_match_detail_for_enterprise(session: Session, match_id: UUID, enterprise_id: UUID):
    statement = (
        select(
            Match.id.label("match_id"),
            Match.job_id.label("job_id"),
            Match.talent_id.label("talent_id"),
            Match.score,
            Match.breakdown,
            Match.status,
            Match.ai_reasoning.label("ai_reasoning"),
            Match.created_at.label("created_at"),
            Job.title.label("job_title"),
            TalentProfile.display_name.label("display_name"),
            TalentProfile.display_name.label("talent_name"),
            TalentProfile.headline.label("headline"),
            TalentProfile.headline.label("talent_headline"),
            TalentProfile.skills.label("skills"),
            TalentProfile.availability.label("availability"),
        )
        .join(Job, Match.job_id == Job.id)
        .outerjoin(TalentProfile, Match.talent_id == TalentProfile.id)
        .where(Match.id == match_id, Job.enterprise_id == enterprise_id)
    )
    return session.execute(statement).mappings().one_or_none()


def get_match_model_for_enterprise(session: Session, match_id: UUID, enterprise_id: UUID) -> Match | None:
    statement = (
        select(Match)
        .join(Job, Match.job_id == Job.id)
        .where(Match.id == match_id, Job.enterprise_id == enterprise_id)
    )
    return session.execute(statement).scalar_one_or_none()


def create_match(
    session: Session,
    *,
    job_id: UUID,
    talent_id: UUID,
    score: float,
    breakdown: dict,
    status: str = "new",
    ai_reasoning: str | None = None,
) -> Match:
    match = Match(
        job_id=job_id,
        talent_id=talent_id,
        score=score,
        breakdown=breakdown,
        status=status,
        ai_reasoning=ai_reasoning,
    )
    session.add(match)
    session.flush()
    return match


def update_match_status(session: Session, match: Match, status: str) -> Match:
    match.status = status
    session.flush()
    return match


def list_recent_matches_for_talent(session: Session, talent_id: UUID, limit: int = 20):
    statement = (
        select(
            Match.score,
            Job.title.label("job_title"),
            EnterpriseProfile.company_name.label("company_name"),
        )
        .join(Job, Match.job_id == Job.id)
        .outerjoin(EnterpriseProfile, Job.enterprise_id == EnterpriseProfile.id)
        .where(Match.talent_id == talent_id)
        .order_by(desc(Match.score))
        .limit(limit)
    )
    return session.execute(statement).mappings().all()
