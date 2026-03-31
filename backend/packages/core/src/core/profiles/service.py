from __future__ import annotations

from typing import Any
from uuid import UUID

from contracts.auth import AuthUser
from db.models.enterprise_profile import EnterpriseProfile
from db.models.talent_profile import TalentProfile
from db.repositories.profiles import (
    get_enterprise_profile_by_user_id,
    get_talent_profile_by_user_id,
    update_enterprise_profile,
    update_talent_profile,
)


def _serialize_profile(profile: TalentProfile | EnterpriseProfile) -> dict[str, Any]:
    return {
        column.name: getattr(profile, column.name)
        for column in profile.__table__.columns  # type: ignore[attr-defined]
    }


def get_current_profile(session, current_user: AuthUser) -> dict[str, Any] | None:
    user_id = UUID(current_user.id)
    if current_user.role == "talent":
        profile = get_talent_profile_by_user_id(session, user_id)
    else:
        profile = get_enterprise_profile_by_user_id(session, user_id)

    if profile is None:
        return None
    return _serialize_profile(profile)


def update_current_profile(session, current_user: AuthUser, updates: dict[str, Any]) -> dict[str, Any] | None:
    user_id = UUID(current_user.id)
    if current_user.role == "talent":
        profile = get_talent_profile_by_user_id(session, user_id)
        if profile is None:
            return None
        return _serialize_profile(update_talent_profile(session, profile, updates))

    profile = get_enterprise_profile_by_user_id(session, user_id)
    if profile is None:
        return None
    return _serialize_profile(update_enterprise_profile(session, profile, updates))
