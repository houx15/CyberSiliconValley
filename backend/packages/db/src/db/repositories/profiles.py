from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.enterprise_profile import EnterpriseProfile
from db.models.talent_profile import TalentProfile


def get_talent_profile_by_id(session: Session, talent_id: UUID) -> TalentProfile | None:
    statement = select(TalentProfile).where(TalentProfile.id == talent_id)
    return session.execute(statement).scalar_one_or_none()


def get_enterprise_profile_by_id(session: Session, enterprise_id: UUID) -> EnterpriseProfile | None:
    statement = select(EnterpriseProfile).where(EnterpriseProfile.id == enterprise_id)
    return session.execute(statement).scalar_one_or_none()


def get_talent_profile_by_user_id(session: Session, user_id: UUID) -> TalentProfile | None:
    statement = select(TalentProfile).where(TalentProfile.user_id == user_id)
    return session.execute(statement).scalar_one_or_none()


def get_enterprise_profile_by_user_id(session: Session, user_id: UUID) -> EnterpriseProfile | None:
    statement = select(EnterpriseProfile).where(EnterpriseProfile.user_id == user_id)
    return session.execute(statement).scalar_one_or_none()


def create_talent_profile(session: Session, user_id: UUID, **values: Any) -> TalentProfile:
    profile = TalentProfile(user_id=user_id, **values)
    session.add(profile)
    session.flush()
    return profile


def create_enterprise_profile(session: Session, user_id: UUID, **values: Any) -> EnterpriseProfile:
    profile = EnterpriseProfile(user_id=user_id, **values)
    session.add(profile)
    session.flush()
    return profile


def update_talent_profile(session: Session, profile: TalentProfile, updates: dict[str, Any]) -> TalentProfile:
    for field, value in updates.items():
        setattr(profile, field, value)
    session.flush()
    return profile


def update_enterprise_profile(
    session: Session, profile: EnterpriseProfile, updates: dict[str, Any]
) -> EnterpriseProfile:
    for field, value in updates.items():
        setattr(profile, field, value)
    session.flush()
    return profile
