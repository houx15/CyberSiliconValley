from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.keyword_edge import KeywordEdge
from db.models.keyword_node import KeywordNode
from db.models.match import Match


def list_keyword_nodes(session: Session) -> list[KeywordNode]:
    statement = select(KeywordNode).order_by(KeywordNode.job_count)
    return list(session.execute(statement).scalars())


def list_keyword_edges(session: Session) -> list[KeywordEdge]:
    statement = select(KeywordEdge).order_by(KeywordEdge.weight)
    return list(session.execute(statement).scalars())


def list_open_jobs(session: Session) -> list[Job]:
    statement = select(Job).where(Job.status == "open")
    return list(session.execute(statement).scalars())


def get_job(session: Session, job_id: UUID) -> Job | None:
    statement = select(Job).where(Job.id == job_id)
    return session.execute(statement).scalar_one_or_none()


def get_enterprise_name(session: Session, enterprise_id: UUID | None) -> str:
    if enterprise_id is None:
        return "Unknown Company"
    statement = select(EnterpriseProfile.company_name).where(EnterpriseProfile.id == enterprise_id).limit(1)
    return session.execute(statement).scalar_one_or_none() or "Unknown Company"


def get_match_for_talent_and_job(session: Session, talent_id: UUID, job_id: UUID) -> Match | None:
    statement = select(Match).where(Match.talent_id == talent_id, Match.job_id == job_id).limit(1)
    return session.execute(statement).scalar_one_or_none()
