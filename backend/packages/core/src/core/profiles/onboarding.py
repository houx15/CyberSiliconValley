from __future__ import annotations

from typing import Any
from uuid import UUID

from contracts.auth import AuthUser
from db.repositories.profiles import (
    create_enterprise_profile,
    create_talent_profile,
    get_enterprise_profile_by_user_id,
    get_talent_profile_by_user_id,
    update_enterprise_profile,
    update_talent_profile,
)


TALENT_ALLOWED_FIELDS = frozenset({
    "display_name", "headline", "bio", "skills", "experience",
    "education", "goals", "availability", "salary_range",
    "resume_url", "profile_data",
})
ENTERPRISE_ALLOWED_FIELDS = frozenset({
    "company_name", "industry", "company_size", "website",
    "description", "ai_maturity", "profile_data", "preferences",
})


def apply_onboarding_update(
    session,
    current_user: AuthUser,
    profile_updates: dict[str, Any],
    *,
    complete: bool = False,
) -> tuple[dict[str, Any], bool]:
    user_id = UUID(current_user.id)

    # Allowlist fields to prevent mass-assignment of protected columns (id, user_id, visible, etc.)
    allowed = TALENT_ALLOWED_FIELDS if current_user.role == "talent" else ENTERPRISE_ALLOWED_FIELDS
    updates = {k: v for k, v in profile_updates.items() if k in allowed}

    if complete:
        updates["onboarding_done"] = True

    if current_user.role == "talent":
        profile = get_talent_profile_by_user_id(session, user_id)
        if profile is None:
            profile = create_talent_profile(session, user_id, **updates)
        else:
            profile = update_talent_profile(session, profile, updates)
    else:
        profile = get_enterprise_profile_by_user_id(session, user_id)
        if profile is None:
            profile = create_enterprise_profile(session, user_id, **updates)
        else:
            profile = update_enterprise_profile(session, profile, updates)

    payload = {
        column.name: getattr(profile, column.name)
        for column in profile.__table__.columns  # type: ignore[attr-defined]
    }
    return payload, bool(payload["onboarding_done"])
