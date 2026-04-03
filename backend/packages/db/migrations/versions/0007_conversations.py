from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_conversations"
down_revision = "0006_prechat_mem_sub"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("talent_id", sa.UUID(), nullable=False),
        sa.Column("enterprise_id", sa.UUID(), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=True),
        sa.Column("pre_chat_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["talent_id"], ["talent_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["enterprise_id"], ["enterprise_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pre_chat_id"], ["pre_chats.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("pre_chat_id", name="uq_conversations_pre_chat_id"),
    )
    op.create_index("ix_conversations_talent_status", "conversations", ["talent_id", "status"])
    op.create_index("ix_conversations_enterprise_status", "conversations", ["enterprise_id", "status"])

    op.create_table(
        "direct_messages",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("sender_user_id", sa.UUID(), nullable=False),
        sa.Column("sender_type", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_direct_messages_conversation_created", "direct_messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_table("direct_messages")
    op.drop_table("conversations")
