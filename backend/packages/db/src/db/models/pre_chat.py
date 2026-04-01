from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

PreChatStatus = Literal[
    "pending_talent_opt_in",
    "pending_enterprise_opt_in",
    "active",
    "completed",
    "declined",
]


class PreChat(Base):
    __tablename__ = "pre_chats"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    job_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    talent_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("talent_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    enterprise_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("enterprise_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[PreChatStatus] = mapped_column(
        String(30), nullable=False, server_default=text("'pending_talent_opt_in'")
    )
    talent_opted_in: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    enterprise_opted_in: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    ai_summary: Mapped[str | None] = mapped_column(Text)
    round_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    max_rounds: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("10"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class PreChatMessage(Base):
    __tablename__ = "pre_chat_messages"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    pre_chat_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("pre_chats.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, server_default=func.now())
