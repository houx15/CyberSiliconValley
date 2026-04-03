from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Row, asc, desc, func, select, update
from sqlalchemy.orm import Session

from db.models.conversation import Conversation, DirectMessage
from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.pre_chat import PreChat, PreChatMessage
from db.models.talent_profile import TalentProfile


def create_conversation(
    session: Session,
    *,
    talent_id: UUID,
    enterprise_id: UUID,
    job_id: UUID | None = None,
    pre_chat_id: UUID | None = None,
) -> Conversation:
    conv = Conversation(
        talent_id=talent_id,
        enterprise_id=enterprise_id,
        job_id=job_id,
        pre_chat_id=pre_chat_id,
    )
    session.add(conv)
    session.flush()
    session.refresh(conv)
    return conv


def list_conversations_for_user(session: Session, user_id: UUID, role: str) -> list[Row]:
    """List conversations for a user with denormalized display data.

    Returns rows with: (Conversation, talent_name, company_name, job_title, last_msg_content).
    """
    # Subquery for latest message content
    last_msg_sub = (
        select(
            DirectMessage.conversation_id,
            DirectMessage.content,
            func.row_number()
            .over(partition_by=DirectMessage.conversation_id, order_by=[desc(DirectMessage.created_at), desc(DirectMessage.id)])
            .label("rn"),
        )
        .subquery()
    )
    last_msg = select(last_msg_sub.c.conversation_id, last_msg_sub.c.content).where(last_msg_sub.c.rn == 1).subquery()

    stmt = (
        select(
            Conversation,
            func.coalesce(TalentProfile.display_name, "Candidate").label("talent_name"),
            func.coalesce(EnterpriseProfile.company_name, "Company").label("company_name"),
            Job.title.label("job_title"),
            TalentProfile.headline.label("talent_headline"),
            last_msg.c.content.label("last_message"),
        )
        .join(TalentProfile, Conversation.talent_id == TalentProfile.id)
        .join(EnterpriseProfile, Conversation.enterprise_id == EnterpriseProfile.id)
        .outerjoin(Job, Conversation.job_id == Job.id)
        .outerjoin(last_msg, Conversation.id == last_msg.c.conversation_id)
    )

    if role == "talent":
        stmt = stmt.where(TalentProfile.user_id == user_id)
    else:
        stmt = stmt.where(EnterpriseProfile.user_id == user_id)

    stmt = stmt.order_by(desc(func.coalesce(Conversation.last_message_at, Conversation.created_at))).limit(100)
    return list(session.execute(stmt).all())


def get_conversation(session: Session, conversation_id: UUID) -> Conversation | None:
    return session.get(Conversation, conversation_id)


def get_conversation_with_display(session: Session, conversation_id: UUID) -> Row | None:
    """Get a single conversation with display names."""
    stmt = (
        select(
            Conversation,
            func.coalesce(TalentProfile.display_name, "Candidate").label("talent_name"),
            func.coalesce(EnterpriseProfile.company_name, "Company").label("company_name"),
            Job.title.label("job_title"),
            TalentProfile.headline.label("talent_headline"),
        )
        .join(TalentProfile, Conversation.talent_id == TalentProfile.id)
        .join(EnterpriseProfile, Conversation.enterprise_id == EnterpriseProfile.id)
        .outerjoin(Job, Conversation.job_id == Job.id)
        .where(Conversation.id == conversation_id)
    )
    return session.execute(stmt).one_or_none()


def list_messages(
    session: Session,
    conversation_id: UUID,
    *,
    limit: int = 50,
    before: datetime | None = None,
) -> list[DirectMessage]:
    # Subquery: get the newest `limit` messages, then re-sort ascending
    inner = (
        select(DirectMessage.id)
        .where(DirectMessage.conversation_id == conversation_id)
    )
    if before:
        inner = inner.where(DirectMessage.created_at < before)
    inner = inner.order_by(desc(DirectMessage.created_at), desc(DirectMessage.id)).limit(limit).subquery()

    stmt = (
        select(DirectMessage)
        .where(DirectMessage.id.in_(select(inner.c.id)))
        .order_by(asc(DirectMessage.created_at), asc(DirectMessage.id))
    )
    return list(session.execute(stmt).scalars())


def list_new_messages(
    session: Session,
    conversation_id: UUID,
    after: datetime,
) -> list[DirectMessage]:
    # Uses >= (not >) to avoid losing same-timestamp messages; frontend deduplicates by ID
    stmt = (
        select(DirectMessage)
        .where(DirectMessage.conversation_id == conversation_id, DirectMessage.created_at >= after)
        .order_by(DirectMessage.created_at, DirectMessage.id)
        .limit(200)
    )
    return list(session.execute(stmt).scalars())


def create_direct_message(
    session: Session,
    *,
    conversation_id: UUID,
    sender_user_id: UUID,
    sender_type: str,
    content: str,
) -> DirectMessage:
    msg = DirectMessage(
        conversation_id=conversation_id,
        sender_user_id=sender_user_id,
        sender_type=sender_type,
        content=content,
    )
    session.add(msg)
    session.flush()
    session.refresh(msg)

    # Atomically advance last_message_at (handles NULL for first message, never moves backward)
    session.execute(
        update(Conversation)
        .where(Conversation.id == conversation_id)
        .values(last_message_at=func.greatest(
            func.coalesce(Conversation.last_message_at, msg.created_at),
            msg.created_at,
        ))
    )

    return msg


def load_prechat_messages(session: Session, pre_chat_id: UUID) -> list[PreChatMessage]:
    """Load pre-chat messages for display in conversation timeline."""
    stmt = (
        select(PreChatMessage)
        .where(PreChatMessage.pre_chat_id == pre_chat_id)
        .order_by(PreChatMessage.round_number, PreChatMessage.id)
    )
    return list(session.execute(stmt).scalars())


def verify_conversation_access(session: Session, conversation: Conversation, user_id: UUID, role: str) -> bool:
    """Check if the user is a participant in this conversation."""
    if role == "talent":
        profile_id = session.execute(
            select(TalentProfile.id).where(TalentProfile.user_id == user_id)
        ).scalar_one_or_none()
        return profile_id is not None and profile_id == conversation.talent_id
    else:
        profile_id = session.execute(
            select(EnterpriseProfile.id).where(EnterpriseProfile.user_id == user_id)
        ).scalar_one_or_none()
        return profile_id is not None and profile_id == conversation.enterprise_id
