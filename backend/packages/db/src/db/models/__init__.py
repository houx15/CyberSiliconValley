from __future__ import annotations

from db.base import Base
from db.models.enterprise_profile import EnterpriseProfile
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.match import Match
from db.models.talent_profile import TalentProfile
from db.models.user import User

# Import model modules here so Alembic autogenerate can discover them from one place.
__all__ = ["Base", "EnterpriseProfile", "InboxItem", "Job", "Match", "TalentProfile", "User"]
