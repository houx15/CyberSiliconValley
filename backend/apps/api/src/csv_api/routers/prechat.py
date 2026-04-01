from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.prechat import (
    PreChatHumanReplyRequest,
    PreChatInitiateRequest,
    PreChatMessageRecord,
    PreChatRecord,
    PreChatSummaryResponse,
    PreChatWithMessages,
)
from csv_api.dependencies import get_current_user, get_db_session
from db.models.enterprise_profile import EnterpriseProfile
from db.models.pre_chat import PreChat, PreChatMessage


router = APIRouter(prefix="/api/v1/prechat", tags=["prechat"])


def _prechat_to_record(pc: PreChat) -> PreChatRecord:
    return PreChatRecord(
        id=str(pc.id),
        jobId=str(pc.job_id),
        talentId=str(pc.talent_id),
        enterpriseId=str(pc.enterprise_id),
        status=pc.status,
        talentOptedIn=pc.talent_opted_in,
        enterpriseOptedIn=pc.enterprise_opted_in,
        aiSummary=pc.ai_summary,
        roundCount=pc.round_count,
        maxRounds=pc.max_rounds,
        createdAt=pc.created_at,
        updatedAt=pc.updated_at,
    )


def _message_to_record(msg: PreChatMessage) -> PreChatMessageRecord:
    return PreChatMessageRecord(
        id=str(msg.id),
        preChatId=str(msg.pre_chat_id),
        senderType=msg.sender_type,
        content=msg.content,
        roundNumber=msg.round_number,
        createdAt=msg.created_at,
    )


@router.post("/initiate", response_model=PreChatRecord, status_code=status.HTTP_201_CREATED)
def initiate_prechat(
    payload: PreChatInitiateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord | JSONResponse:
    if current_user.role != "enterprise":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})

    profile = session.execute(
        select(EnterpriseProfile).where(EnterpriseProfile.user_id == UUID(current_user.id))
    ).scalar_one_or_none()
    if profile is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    pc = PreChat(
        job_id=UUID(payload.job_id),
        talent_id=UUID(payload.talent_id),
        enterprise_id=profile.id,
        status="pending_talent_opt_in",
    )
    session.add(pc)
    session.commit()
    session.refresh(pc)
    return _prechat_to_record(pc)


@router.post("/{prechat_id}/opt-in", response_model=PreChatRecord)
def opt_in_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord | JSONResponse:
    pc = session.get(PreChat, UUID(prechat_id))
    if pc is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    if current_user.role == "talent":
        pc.talent_opted_in = True
        if pc.enterprise_opted_in:
            pc.status = "active"
        else:
            pc.status = "pending_enterprise_opt_in"
    elif current_user.role == "enterprise":
        pc.enterprise_opted_in = True
        if pc.talent_opted_in:
            pc.status = "active"
        else:
            pc.status = "pending_talent_opt_in"

    session.commit()
    session.refresh(pc)
    return _prechat_to_record(pc)


@router.get("/{prechat_id}", response_model=PreChatWithMessages)
def get_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatWithMessages | JSONResponse:
    pc = session.get(PreChat, UUID(prechat_id))
    if pc is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    messages = (
        session.execute(
            select(PreChatMessage)
            .where(PreChatMessage.pre_chat_id == pc.id)
            .order_by(PreChatMessage.created_at)
        )
        .scalars()
        .all()
    )

    record = _prechat_to_record(pc)
    return PreChatWithMessages(
        **record.model_dump(by_alias=True),
        messages=[_message_to_record(m) for m in messages],
    )


@router.post("/{prechat_id}/human-reply", response_model=PreChatMessageRecord, status_code=status.HTTP_201_CREATED)
def human_reply(
    prechat_id: str,
    payload: PreChatHumanReplyRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatMessageRecord | JSONResponse:
    pc = session.get(PreChat, UUID(prechat_id))
    if pc is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    sender_type = "human_enterprise" if current_user.role == "enterprise" else "human_talent"
    msg = PreChatMessage(
        pre_chat_id=pc.id,
        sender_type=sender_type,
        content=payload.content,
        round_number=pc.round_count + 1,
    )
    pc.round_count += 1
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return _message_to_record(msg)


@router.get("/{prechat_id}/summary", response_model=PreChatSummaryResponse)
def get_prechat_summary(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatSummaryResponse | JSONResponse:
    pc = session.get(PreChat, UUID(prechat_id))
    if pc is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})

    summary = pc.ai_summary or "Pre-chat conversation summary is being generated."
    return PreChatSummaryResponse(summary=summary)
