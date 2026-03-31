from __future__ import annotations

from uuid import UUID

from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session

from db.models.job import Job
from db.models.match import Match


def create_job(
    session: Session,
    *,
    enterprise_id: UUID,
    title: str,
    description: str | None,
    structured: dict,
    auto_match: bool,
    auto_prechat: bool,
) -> Job:
    job = Job(
        enterprise_id=enterprise_id,
        title=title,
        description=description,
        structured=structured,
        auto_match=auto_match,
        auto_prechat=auto_prechat,
    )
    session.add(job)
    session.flush()
    return job


def list_jobs_for_enterprise(session: Session, enterprise_id: UUID):
    shortlisted_case = case((Match.status == "shortlisted", 1))
    statement = (
        select(
            Job,
            func.count(Match.id).label("match_count"),
            func.count(shortlisted_case).label("shortlisted_count"),
        )
        .outerjoin(Match, Match.job_id == Job.id)
        .where(Job.enterprise_id == enterprise_id)
        .group_by(Job.id)
        .order_by(desc(Job.created_at))
    )
    return session.execute(statement).all()


def get_job_by_id_for_enterprise(session: Session, job_id: UUID, enterprise_id: UUID) -> Job | None:
    statement = select(Job).where(Job.id == job_id, Job.enterprise_id == enterprise_id)
    return session.execute(statement).scalar_one_or_none()
