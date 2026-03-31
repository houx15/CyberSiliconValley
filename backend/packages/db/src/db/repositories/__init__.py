from __future__ import annotations

from db.repositories.auth import create_user, get_user_by_email, get_user_by_id
from db.repositories.jobs import create_job, get_job_by_id_for_enterprise, list_jobs_for_enterprise
from db.repositories.matching import (
    create_inbox_item,
    create_match,
    get_match_detail_for_enterprise,
    get_match_model_for_enterprise,
    list_matches_for_enterprise,
    list_matches_for_job,
    update_match_status,
)
from db.repositories.profiles import (
    create_enterprise_profile,
    create_talent_profile,
    get_enterprise_profile_by_user_id,
    get_talent_profile_by_user_id,
    update_enterprise_profile,
    update_talent_profile,
)

__all__ = [
    "create_enterprise_profile",
    "create_inbox_item",
    "create_job",
    "create_match",
    "create_talent_profile",
    "create_user",
    "get_enterprise_profile_by_user_id",
    "get_job_by_id_for_enterprise",
    "get_match_detail_for_enterprise",
    "get_match_model_for_enterprise",
    "get_talent_profile_by_user_id",
    "get_user_by_email",
    "get_user_by_id",
    "list_jobs_for_enterprise",
    "list_matches_for_enterprise",
    "list_matches_for_job",
    "update_enterprise_profile",
    "update_match_status",
    "update_talent_profile",
]
