from __future__ import annotations

from uuid import UUID

from contracts.inbox import InboxItemRecord
from db.repositories.inbox import get_inbox_item_for_user, get_unread_inbox_count, list_inbox_items_for_user, mark_inbox_item_read as mark_inbox_item_read_repo


def _serialize_item(item) -> InboxItemRecord:
    return InboxItemRecord(
        id=str(item.id),
        item_type=item.item_type,
        title=item.title or "",
        content=item.content or {},
        read=bool(item.read),
        created_at=item.created_at.isoformat(),
    )


def list_inbox_items(session, user_id: str, filter_name: str) -> tuple[list[InboxItemRecord], int]:
    user_uuid = UUID(user_id)
    items = list_inbox_items_for_user(session, user_uuid, filter_name)
    unread_count = get_unread_inbox_count(session, user_uuid)
    return [_serialize_item(item) for item in items], unread_count


def get_inbox_item(session, item_id: str, user_id: str) -> InboxItemRecord | None:
    item = get_inbox_item_for_user(session, UUID(item_id), UUID(user_id))
    if item is None:
        return None
    return _serialize_item(item)


def mark_inbox_item_read(session, item_id: str, user_id: str) -> bool:
    return mark_inbox_item_read_repo(session, UUID(item_id), UUID(user_id))
