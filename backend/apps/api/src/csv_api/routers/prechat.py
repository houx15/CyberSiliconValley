from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, select, update
from sqlalchemy.exc import IntegrityError
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
from csv_api.config import get_settings
from csv_api.dependencies import get_current_user, get_db_session
from db.models.enterprise_profile import EnterpriseProfile
from db.models.job import Job
from db.models.pre_chat import PreChat, PreChatMessage
from db.models.talent_profile import TalentProfile
from db.repositories.conversations import create_conversation
from redis_layer.queue import enqueue_ai_prechat_job


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
async def initiate_prechat(
    payload: PreChatInitiateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord:
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only enterprise can initiate pre-chat")

    profile = session.execute(
        select(EnterpriseProfile).where(EnterpriseProfile.user_id == UUID(current_user.id))
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enterprise profile not found")

    # Validate job_id UUID
    try:
        job_uuid = UUID(payload.job_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid job ID format")

    # Verify the job belongs to this enterprise
    job = session.execute(
        select(Job).where(Job.id == job_uuid, Job.enterprise_id == profile.id)
    ).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    # Validate talent_id UUID and existence
    try:
        talent_uuid = UUID(payload.talent_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid talent ID format")

    talent = session.execute(
        select(TalentProfile).where(TalentProfile.id == talent_uuid)
    ).scalar_one_or_none()
    if talent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Talent not found")

    # If job has auto_prechat enabled, start AI screening (talent reviews after)
    if job.auto_prechat:
        pc = PreChat(
            job_id=job.id,
            talent_id=talent_uuid,
            enterprise_id=profile.id,
            status="ai_screening",
            talent_opted_in=False,
            enterprise_opted_in=True,
        )
        session.add(pc)
        session.commit()
        session.refresh(pc)
        settings = get_settings()
        try:
            await enqueue_ai_prechat_job(settings.redis_url or None, str(pc.id))
        except Exception:
            # Revert to pending — enterprise_opted_in stays True (enterprise already initiated)
            pc.status = "pending_talent_opt_in"
            session.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to enqueue AI screening job, please retry",
            )
        return _prechat_to_record(pc)

    pc = PreChat(
        job_id=job.id,
        talent_id=talent_uuid,
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

    allowed = ("pending_talent_opt_in", "pending_enterprise_opt_in")

    if current_user.role == "talent":
        # Atomic: set talent_opted_in=True and derive status from current DB state
        result = session.execute(
            update(PreChat)
            .where(PreChat.id == pc.id, PreChat.status.in_(allowed))
            .values(
                talent_opted_in=True,
                status=case(
                    (PreChat.enterprise_opted_in == True, "active"),  # noqa: E712
                    else_="pending_enterprise_opt_in",
                ),
            )
        )
    elif current_user.role == "enterprise":
        result = session.execute(
            update(PreChat)
            .where(PreChat.id == pc.id, PreChat.status.in_(allowed))
            .values(
                enterprise_opted_in=True,
                status=case(
                    (PreChat.talent_opted_in == True, "active"),  # noqa: E712
                    else_="pending_talent_opt_in",
                ),
            )
        )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid role")

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot opt in when pre-chat is '{pc.status}'",
        )

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
            .order_by(PreChatMessage.round_number, PreChatMessage.id)
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

    # Atomic check + increment: full eligibility guard in WHERE clause
    result = session.execute(
        update(PreChat)
        .where(
            PreChat.id == pc.id,
            PreChat.status == "active",
            PreChat.talent_opted_in == True,  # noqa: E712
            PreChat.enterprise_opted_in == True,  # noqa: E712
            PreChat.round_count < PreChat.max_rounds,
        )
        .values(round_count=PreChat.round_count + 1)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot send: pre-chat is not active, opt-ins missing, or max rounds reached",
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

    return PreChatSummaryResponse(
        summary=pc.ai_summary,
        ready=pc.ai_summary is not None,
    )


@router.post("/{prechat_id}/start-ai", response_model=PreChatRecord)
async def start_ai_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord:
    """Manually trigger AI-to-AI pre-chat for an existing PreChat."""
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only enterprise can start AI screening")

    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    if pc.round_count >= pc.max_rounds:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Maximum rounds already reached")

    # Atomic transition: only move to ai_screening from a valid starting status
    prior_status = pc.status
    prior_enterprise_opted_in = pc.enterprise_opted_in
    result = session.execute(
        update(PreChat)
        .where(
            PreChat.id == pc.id,
            PreChat.status.in_(("pending_talent_opt_in", "pending_enterprise_opt_in")),
        )
        .values(status="ai_screening", enterprise_opted_in=True)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pre-chat is '{pc.status}', cannot start AI screening",
        )
    session.commit()
    session.refresh(pc)

    settings = get_settings()
    try:
        await enqueue_ai_prechat_job(settings.redis_url or None, str(pc.id))
    except Exception:
        # Revert both status and enterprise_opted_in to pre-transition values
        session.execute(
            update(PreChat)
            .where(PreChat.id == pc.id)
            .values(status=prior_status, enterprise_opted_in=prior_enterprise_opted_in)
        )
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to enqueue AI screening job, please retry",
        )

    return _prechat_to_record(pc)


@router.post("/{prechat_id}/complete", response_model=PreChatRecord)
def complete_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord:
    """Manually complete a pre-chat early — transitions to pending_talent_review."""
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only enterprise can complete")

    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    # Atomic transition: only complete from active
    result = session.execute(
        update(PreChat)
        .where(PreChat.id == pc.id, PreChat.status == "active")
        .values(status="pending_talent_review")
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pre-chat is '{pc.status}', can only complete from 'active'",
        )

    session.commit()
    session.refresh(pc)
    return _prechat_to_record(pc)


@router.post("/{prechat_id}/talent-accept", response_model=PreChatRecord)
def talent_accept_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord:
    """Talent accepts the pre-chat result — creates a Conversation for human follow-up."""
    if current_user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only talent can accept")

    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    # Atomic transition: only accept from pending_talent_review
    result = session.execute(
        update(PreChat)
        .where(PreChat.id == pc.id, PreChat.status == "pending_talent_review")
        .values(status="completed", talent_opted_in=True)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pre-chat is '{pc.status}', expected 'pending_talent_review'",
        )

    try:
        create_conversation(
            session,
            talent_id=pc.talent_id,
            enterprise_id=pc.enterprise_id,
            job_id=pc.job_id,
            pre_chat_id=pc.id,
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conversation already created for this pre-chat",
        )

    session.refresh(pc)
    return _prechat_to_record(pc)


@router.post("/{prechat_id}/talent-decline", response_model=PreChatRecord)
def talent_decline_prechat(
    prechat_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PreChatRecord:
    """Talent declines the pre-chat — no Conversation is created."""
    if current_user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only talent can decline")

    pc = _load_prechat(session, prechat_id)
    _verify_prechat_access(pc, current_user, session)

    # Atomic transition: only decline from pending_talent_review
    result = session.execute(
        update(PreChat)
        .where(PreChat.id == pc.id, PreChat.status == "pending_talent_review")
        .values(status="declined")
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pre-chat is '{pc.status}', expected 'pending_talent_review'",
        )

    session.commit()
    session.refresh(pc)
    return _prechat_to_record(pc)
