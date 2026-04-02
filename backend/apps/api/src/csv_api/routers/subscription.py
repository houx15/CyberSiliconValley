from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.subscription_contracts import (
    SubscriptionTierRecord,
    UpgradeTierRequest,
    UsageData,
    UserSubscriptionRecord,
)
from csv_api.dependencies import get_current_user, get_db_session
from db.models.subscription import SubscriptionTier, UserSubscription


router = APIRouter(prefix="/api/v1/subscription", tags=["subscription"])


@router.get("/tiers", response_model=list[SubscriptionTierRecord])
def list_tiers(
    role: str = "talent",
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> list[SubscriptionTierRecord]:
    tiers = (
        session.execute(
            select(SubscriptionTier).where(
                SubscriptionTier.role == role,
                SubscriptionTier.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    return [
        SubscriptionTierRecord(
            id=str(t.id),
            name=t.name,
            role=t.role,
            priceCents=t.price_cents,
            currency=t.currency,
            limits=t.limits,
            isActive=t.is_active,
        )
        for t in tiers
    ]


@router.get("/current")
def current_subscription(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> UserSubscriptionRecord | None:
    sub = session.execute(
        select(UserSubscription).where(
            UserSubscription.user_id == UUID(current_user.id),
            UserSubscription.status == "active",
        )
    ).scalar_one_or_none()
    if sub is None:
        return None

    tier = session.get(SubscriptionTier, sub.tier_id)
    tier_name = tier.name if tier else "Unknown"

    return UserSubscriptionRecord(
        id=str(sub.id),
        userId=str(sub.user_id),
        tierId=str(sub.tier_id),
        tierName=tier_name,
        status=sub.status,
        currentPeriodStart=sub.current_period_start.isoformat(),
        currentPeriodEnd=sub.current_period_end.isoformat(),
    )


@router.get("/usage", response_model=UsageData)
def get_usage(
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> UsageData:
    from datetime import datetime, timezone
    from db.models.match import Match
    from db.models.pre_chat import PreChat
    from db.models.chat_session import ChatSession
    from db.models.chat_message import ChatMessage

    user_id = UUID(current_user.id)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Count today's matches (via profile)
    matches_today = 0
    prechats_today = 0
    coach_today = 0

    try:
        matches_today = session.execute(
            select(func.count(Match.id)).where(Match.created_at >= today_start)
        ).scalar_one() or 0
    except Exception:
        pass

    try:
        prechats_today = session.execute(
            select(func.count(PreChat.id)).where(PreChat.created_at >= today_start)
        ).scalar_one() or 0
    except Exception:
        pass

    try:
        # Count coach messages sent today by this user
        coach_session = session.execute(
            select(ChatSession.id).where(
                ChatSession.user_id == user_id,
                ChatSession.session_type == "coach",
            )
        ).scalar_one_or_none()
        if coach_session:
            coach_today = session.execute(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.session_id == coach_session,
                    ChatMessage.role == "user",
                    ChatMessage.created_at >= today_start,
                )
            ).scalar_one() or 0
    except Exception:
        pass

    return UsageData(
        matchesToday=matches_today,
        matchesLimit=50,
        preChatsToday=prechats_today,
        preChatsLimit=10,
        coachToday=coach_today,
        coachLimit=20,
    )


@router.post("/upgrade", response_model=UserSubscriptionRecord)
def upgrade_tier(
    payload: UpgradeTierRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> UserSubscriptionRecord | JSONResponse:
    tier = session.get(SubscriptionTier, UUID(payload.tier_id))
    if tier is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "TIER_NOT_FOUND"})

    # Deactivate existing
    existing = session.execute(
        select(UserSubscription).where(
            UserSubscription.user_id == UUID(current_user.id),
            UserSubscription.status == "active",
        )
    ).scalar_one_or_none()
    if existing:
        existing.status = "expired"

    now = datetime.utcnow()
    sub = UserSubscription(
        user_id=UUID(current_user.id),
        tier_id=tier.id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)

    return UserSubscriptionRecord(
        id=str(sub.id),
        userId=str(sub.user_id),
        tierId=str(sub.tier_id),
        tierName=tier.name,
        status=sub.status,
        currentPeriodStart=sub.current_period_start.isoformat(),
        currentPeriodEnd=sub.current_period_end.isoformat(),
    )
