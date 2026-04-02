from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
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
from db.models.job import Job
from db.models.pre_chat import PreChat, PreChatMessage
from db.models.talent_profile import TalentProfile


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


def _verify_prechat_access(pc: PreChat, current_user: AuthUser, session: Session) -> None:
    """Verify the current user is a participant in this pre-chat."""
    if current_user.role == "talent":
        talent = session.execute(
            select(TalentProfile.id).where(TalentProfile.user_id == UUID(current_user.id))
        ).scalar_one_or_none()
        if talent is None or talent != pc.talent_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")
    elif current_user.role == "enterprise":
        enterprise = session.execute(
            select(EnterpriseProfile.id).where(EnterpriseProfile.user_id == UUID(current_user.id))
        ).scalar_one_or_none()
        if enterprise is None or enterprise != pc.enterprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")


def _load_prechat(session: Session, prechat_id: str) -> PreChat:
    """Load a PreChat by ID, raising 422 on bad UUID or 404 if missing."""
    try:
        pc_uuid = UUID(prechat_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid prechat ID")
    pc = session.get(PreChat, pc_uuid)
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PreChat not found")
    return pc


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

    # Verify the job belongs to this enterprise
    job = session.execute(
        select(Job).where(Job.id == UUID(payload.job_id), Job.enterprise_id == profile.id)
    ).scalar_one_or_none()
    if job is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "JOB_NOT_FOUND"})

    pc = PreChat(
        job_id=job.id,
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
) -> PreChatRecord:
    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    if current_user.role == "talent":
        pc.talent_opted_in = True
        pc.status = "active" if pc.enterprise_opted_in else "pending_enterprise_opt_in"
    elif current_user.role == "enterprise":
        pc.enterprise_opted_in = True
        pc.status = "active" if pc.talent_opted_in else "pending_talent_opt_in"

    session.commit()
    session.refresh(pc)
    return _prechat_to_record(pc)


@router.get("/{prechat_id}", response_model=PreChatWithMessages)
def get_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatWithMessages:
    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

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
) -> PreChatMessageRecord:
    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    sender_type = "human_enterprise" if current_user.role == "enterprise" else "human_talent"

    # Atomic round_count increment to avoid race conditions
    session.execute(
        update(PreChat).where(PreChat.id == pc.id).values(round_count=PreChat.round_count + 1)
    )
    session.flush()
    session.refresh(pc)

    msg = PreChatMessage(
        pre_chat_id=pc.id,
        sender_type=sender_type,
        content=payload.content,
        round_number=pc.round_count,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return _message_to_record(msg)


@router.get("/{prechat_id}/summary", response_model=PreChatSummaryResponse)
def get_prechat_summary(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatSummaryResponse:
    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    summary = pc.ai_summary or "Pre-chat conversation summary is being generated."
    return PreChatSummaryResponse(summary=summary)
