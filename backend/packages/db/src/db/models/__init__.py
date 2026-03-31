from __future__ import annotations

from db.base import Base
from db.models.user import User

# Import model modules here so Alembic autogenerate can discover them from one place.
__all__ = ["Base", "User"]
