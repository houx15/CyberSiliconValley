from __future__ import annotations

from db.repositories.auth import create_user, get_user_by_email, get_user_by_id
from db.repositories.graph import (
    get_enterprise_name,
    get_job,
    get_match_for_talent_and_job,
    list_keyword_edges,
    list_keyword_nodes,
    list_open_jobs,
)
from db.repositories.inbox import (
    create_inbox_item,
    get_inbox_item_for_user,
    get_unread_inbox_count,
    list_inbox_items_for_user,
    mark_inbox_item_read,
)
from db.repositories.jobs import create_job, get_job_by_id_for_enterprise, list_jobs_for_enterprise
from db.repositories.matching import (
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
    get_enterprise_profile_by_id,
    get_enterprise_profile_by_user_id,
    get_talent_profile_by_id,
    get_talent_profile_by_user_id,
    update_enterprise_profile,
    update_talent_profile,
)
from db.repositories.seeking import create_seeking_report, get_latest_seeking_report_for_talent

__all__ = [
    "create_enterprise_profile",
    "create_inbox_item",
    "create_job",
    "create_match",
    "create_seeking_report",
    "create_talent_profile",
    "create_user",
    "get_enterprise_name",
    "get_enterprise_profile_by_id",
    "get_enterprise_profile_by_user_id",
    "get_inbox_item_for_user",
    "get_job_by_id_for_enterprise",
    "get_job",
    "get_latest_seeking_report_for_talent",
    "get_match_detail_for_enterprise",
    "get_match_for_talent_and_job",
    "get_match_model_for_enterprise",
    "get_talent_profile_by_id",
    "get_talent_profile_by_user_id",
    "get_unread_inbox_count",
    "get_user_by_email",
    "get_user_by_id",
    "list_inbox_items_for_user",
    "list_jobs_for_enterprise",
    "list_keyword_edges",
    "list_keyword_nodes",
    "list_matches_for_enterprise",
    "list_matches_for_job",
    "list_open_jobs",
    "mark_inbox_item_read",
    "update_enterprise_profile",
    "update_match_status",
    "update_talent_profile",
]
