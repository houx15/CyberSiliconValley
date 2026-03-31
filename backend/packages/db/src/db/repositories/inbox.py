from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.orm import Session

from db.models.inbox_item import InboxItem

FILTER_TO_TYPES = {
    "all": None,
    "invites": ["invite"],
    "prechats": ["prechat_summary"],
    "matches": ["match_notification"],
    "system": ["system"],
}


def list_inbox_items_for_user(session: Session, user_id: UUID, filter_name: str = "all") -> list[InboxItem]:
    statement = select(InboxItem).where(InboxItem.user_id == user_id)
    types = FILTER_TO_TYPES[filter_name]
    if types is not None:
        statement = statement.where(InboxItem.item_type.in_(types))
    statement = statement.order_by(desc(InboxItem.created_at))
    return list(session.execute(statement).scalars())


def get_inbox_item_for_user(session: Session, item_id: UUID, user_id: UUID) -> InboxItem | None:
    statement = select(InboxItem).where(and_(InboxItem.id == item_id, InboxItem.user_id == user_id)).limit(1)
    return session.execute(statement).scalar_one_or_none()


def get_unread_inbox_count(session: Session, user_id: UUID) -> int:
    statement = select(func.count()).select_from(InboxItem).where(
        and_(InboxItem.user_id == user_id, InboxItem.read.is_(False))
    )
    return int(session.execute(statement).scalar_one())


def mark_inbox_item_read(session: Session, item_id: UUID, user_id: UUID) -> bool:
    statement = (
        update(InboxItem)
        .where(and_(InboxItem.id == item_id, InboxItem.user_id == user_id))
        .values(read=True)
        .returning(InboxItem.id)
    )
    return session.execute(statement).scalar_one_or_none() is not None


def create_inbox_item(
    session: Session,
    *,
    user_id: UUID,
    item_type: str,
    title: str | None,
    content: dict,
) -> InboxItem:
    item = InboxItem(user_id=user_id, item_type=item_type, title=title, content=content)
    session.add(item)
    session.flush()
    return item
