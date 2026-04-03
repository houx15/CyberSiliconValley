from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.conversations import (
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationRecord,
    DirectMessageRecord,
    PollMessagesResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from contracts.prechat import PreChatMessageRecord
from csv_api.dependencies import get_current_user, get_db_session
from db.models.enterprise_profile import EnterpriseProfile
from db.models.talent_profile import TalentProfile
from db.repositories.conversations import (
    create_direct_message,
    get_conversation_with_display,
    list_conversations_for_user,
    list_messages,
    list_new_messages,
    load_prechat_messages,
    verify_conversation_access,
)
from db.repositories.inbox import create_inbox_item


router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])


def _conv_row_to_record(row) -> ConversationRecord:
    conv = row[0]  # Conversation model
    return ConversationRecord(
        id=str(conv.id),
        talentId=str(conv.talent_id),
        enterpriseId=str(conv.enterprise_id),
        jobId=str(conv.job_id) if conv.job_id else None,
        preChatId=str(conv.pre_chat_id) if conv.pre_chat_id else None,
        status=conv.status,
        talentName=row.talent_name or "",
        companyName=row.company_name or "",
        jobTitle=row.job_title,
        talentHeadline=getattr(row, "talent_headline", None),
        lastMessage=getattr(row, "last_message", None),
        lastMessageAt=conv.last_message_at.isoformat() if conv.last_message_at else None,
        createdAt=conv.created_at.isoformat(),
    )


def _dm_to_record(msg) -> DirectMessageRecord:
    return DirectMessageRecord(
        id=str(msg.id),
        conversationId=str(msg.conversation_id),
        senderType=msg.sender_type,
        content=msg.content,
        createdAt=msg.created_at.isoformat(),
    )


def _prechat_msg_to_record(msg) -> PreChatMessageRecord:
    return PreChatMessageRecord(
        id=str(msg.id),
        preChatId=str(msg.pre_chat_id),
        senderType=msg.sender_type,
        content=msg.content,
        roundNumber=msg.round_number,
        createdAt=msg.created_at.isoformat() if msg.created_at else "",
    )


@router.get("", response_model=ConversationListResponse)
def list_conversations(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> ConversationListResponse:
    rows = list_conversations_for_user(session, UUID(current_user.id), current_user.role)
    return ConversationListResponse(
        conversations=[_conv_row_to_record(row) for row in rows],
    )


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> ConversationDetailResponse:
    try:
        conv_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid conversation ID")

    row = get_conversation_with_display(session, conv_uuid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv = row[0]
    if not verify_conversation_access(session, conv, UUID(current_user.id), current_user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")

    page_size = 50
    messages = list_messages(session, conv_uuid, limit=page_size + 1)
    has_more = len(messages) > page_size
    if has_more:
        messages = messages[:page_size]
    dm_records = [_dm_to_record(m) for m in messages]

    # Include pre-chat messages if conversation originated from a pre-chat
    pc_records = None
    if conv.pre_chat_id:
        pc_messages = load_prechat_messages(session, conv.pre_chat_id)
        pc_records = [_prechat_msg_to_record(m) for m in pc_messages]

    return ConversationDetailResponse(
        conversation=_conv_row_to_record(row),
        messages=dm_records,
        preChatMessages=pc_records,
        hasMore=has_more,
    )


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> SendMessageResponse:
    try:
        conv_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid conversation ID")

    row = get_conversation_with_display(session, conv_uuid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv = row[0]
    if not verify_conversation_access(session, conv, UUID(current_user.id), current_user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")

    if conv.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conversation is not active")

    sender_type = "human_enterprise" if current_user.role == "enterprise" else "human_talent"
    msg = create_direct_message(
        session,
        conversation_id=conv_uuid,
        sender_user_id=UUID(current_user.id),
        sender_type=sender_type,
        content=payload.content,
    )

    # Create inbox notification for the other party
    if current_user.role == "enterprise":
        recipient_user_id = session.execute(
            select(TalentProfile.user_id).where(TalentProfile.id == conv.talent_id)
        ).scalar_one_or_none()
        sender_name = row.company_name or "Company"
    else:
        recipient_user_id = session.execute(
            select(EnterpriseProfile.user_id).where(EnterpriseProfile.id == conv.enterprise_id)
        ).scalar_one_or_none()
        sender_name = row.talent_name or "Candidate"

    if recipient_user_id:
        create_inbox_item(
            session,
            user_id=recipient_user_id,
            item_type="new_message",
            title=f"{sender_name} 发来新消息",
            content={
                "conversationId": str(conv_uuid),
                "senderName": sender_name,
                "preview": payload.content[:100],
            },
        )

    session.commit()

    return SendMessageResponse(message=_dm_to_record(msg))


@router.get("/{conversation_id}/messages/poll", response_model=PollMessagesResponse)
def poll_messages(
    conversation_id: str,
    after: str = Query(..., description="ISO timestamp to poll messages after"),
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PollMessagesResponse:
    try:
        conv_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid conversation ID")

    row = get_conversation_with_display(session, conv_uuid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv = row[0]
    if not verify_conversation_access(session, conv, UUID(current_user.id), current_user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")

    try:
        after_dt = datetime.fromisoformat(after)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid timestamp format")

    messages = list_new_messages(session, conv_uuid, after_dt)
    return PollMessagesResponse(messages=[_dm_to_record(m) for m in messages])
