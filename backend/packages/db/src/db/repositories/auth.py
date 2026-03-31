from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.user import Role, User


def get_user_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return session.execute(statement).scalar_one_or_none()


def get_user_by_id(session: Session, user_id: UUID) -> User | None:
    statement = select(User).where(User.id == user_id)
    return session.execute(statement).scalar_one_or_none()


def create_user(
    session: Session,
    *,
    email: str,
    password_hash: str,
    role: Role,
) -> User:
    user = User(email=email, password_hash=password_hash, role=role)
    session.add(user)
    session.flush()
    return user
