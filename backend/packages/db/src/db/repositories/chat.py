from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import asc, select
from sqlalchemy.orm import Session

from db.models.chat_message import ChatMessage
from db.models.chat_session import ChatSession


def get_or_create_chat_session(session: Session, *, user_id: UUID, session_type: str) -> ChatSession:
    statement = select(ChatSession).where(ChatSession.user_id == user_id, ChatSession.session_type == session_type).limit(1)
    existing = session.execute(statement).scalar_one_or_none()
    if existing is not None:
        return existing

    chat_session = ChatSession(user_id=user_id, session_type=session_type)
    session.add(chat_session)
    session.flush()
    return chat_session


def load_chat_history(session: Session, *, session_id: UUID) -> list[ChatMessage]:
    statement = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(asc(ChatMessage.created_at))
    return list(session.execute(statement).scalars())


def save_chat_message(
    session: Session,
    *,
    session_id: UUID,
    role: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> ChatMessage:
    message = ChatMessage(session_id=session_id, role=role, content=content, message_metadata=metadata or {})
    session.add(message)
    session.flush()
    return message


def get_chat_session_context(session: Session, *, session_id: UUID) -> dict[str, Any]:
    statement = select(ChatSession.context).where(ChatSession.id == session_id).limit(1)
    context = session.execute(statement).scalar_one_or_none()
    return context or {}


def update_chat_session_context(session: Session, *, session_id: UUID, context: dict[str, Any]) -> None:
    chat_session = session.get(ChatSession, session_id)
    if chat_session is None:
        return
    chat_session.context = context
    session.flush()
