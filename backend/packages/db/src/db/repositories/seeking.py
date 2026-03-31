from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from db.models.seeking_report import SeekingReport
from db.models.talent_profile import TalentProfile


def get_talent_profile_by_id(session: Session, talent_id: UUID) -> TalentProfile | None:
    statement = select(TalentProfile).where(TalentProfile.id == talent_id)
    return session.execute(statement).scalar_one_or_none()


def get_talent_profile_by_user_id(session: Session, user_id: UUID) -> TalentProfile | None:
    statement = select(TalentProfile).where(TalentProfile.user_id == user_id)
    return session.execute(statement).scalar_one_or_none()


def get_latest_seeking_report_for_talent(session: Session, talent_id: UUID) -> SeekingReport | None:
    statement = (
        select(SeekingReport)
        .where(SeekingReport.talent_id == talent_id)
        .order_by(desc(SeekingReport.generated_at))
        .limit(1)
    )
    return session.execute(statement).scalar_one_or_none()


def create_seeking_report(session: Session, *, talent_id: UUID, report_data: dict) -> SeekingReport:
    report = SeekingReport(talent_id=talent_id, report_data=report_data)
    session.add(report)
    session.flush()
    return report
