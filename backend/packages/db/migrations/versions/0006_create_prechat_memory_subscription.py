from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_create_prechat_memory_subscription"
down_revision = "0005_create_chat_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- pre_chats ---
    op.create_table(
        "pre_chats",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("talent_id", sa.UUID(), nullable=False),
        sa.Column("enterprise_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default=sa.text("'pending_talent_opt_in'"), nullable=False),
        sa.Column("talent_opted_in", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("enterprise_opted_in", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("round_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("max_rounds", sa.Integer(), server_default=sa.text("10"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE", name=op.f("fk_pre_chats_job_id_jobs")),
        sa.ForeignKeyConstraint(["talent_id"], ["talent_profiles.id"], ondelete="CASCADE", name=op.f("fk_pre_chats_talent_id_talent_profiles")),
        sa.ForeignKeyConstraint(["enterprise_id"], ["enterprise_profiles.id"], ondelete="CASCADE", name=op.f("fk_pre_chats_enterprise_id_enterprise_profiles")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pre_chats")),
    )
    op.create_index("pre_chats_enterprise_status_idx", "pre_chats", ["enterprise_id", "status"])
    op.create_index("pre_chats_talent_status_idx", "pre_chats", ["talent_id", "status"])

    # --- pre_chat_messages ---
    op.create_table(
        "pre_chat_messages",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("pre_chat_id", sa.UUID(), nullable=False),
        sa.Column("sender_type", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("round_number", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["pre_chat_id"], ["pre_chats.id"], ondelete="CASCADE", name=op.f("fk_pre_chat_messages_pre_chat_id_pre_chats")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pre_chat_messages")),
    )
    op.create_index("pre_chat_messages_chat_created_idx", "pre_chat_messages", ["pre_chat_id", "created_at"])

    # --- memory_spaces ---
    op.create_table(
        "memory_spaces",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=False),
        sa.Column("scope_ref_id", sa.String(length=255), nullable=True),
        sa.Column("entries", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_memory_spaces")),
    )
    op.create_index("memory_spaces_owner_scope_idx", "memory_spaces", ["owner_id", "scope_type", "scope_ref_id"], unique=True)

    # --- subscription_tiers ---
    op.create_table(
        "subscription_tiers",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default=sa.text("'CNY'"), nullable=False),
        sa.Column("limits", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subscription_tiers")),
    )

    # --- user_subscriptions ---
    op.create_table(
        "user_subscriptions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tier_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name=op.f("fk_user_subscriptions_user_id_users")),
        sa.ForeignKeyConstraint(["tier_id"], ["subscription_tiers.id"], ondelete="CASCADE", name=op.f("fk_user_subscriptions_tier_id_subscription_tiers")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_subscriptions")),
    )
    op.create_index("user_subscriptions_user_status_idx", "user_subscriptions", ["user_id", "status"])

    # --- Add visible column to profiles ---
    op.add_column("talent_profiles", sa.Column("visible", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("enterprise_profiles", sa.Column("visible", sa.Boolean(), server_default=sa.text("true"), nullable=False))


def downgrade() -> None:
    op.drop_column("enterprise_profiles", "visible")
    op.drop_column("talent_profiles", "visible")

    op.drop_index("user_subscriptions_user_status_idx", table_name="user_subscriptions")
    op.drop_table("user_subscriptions")
    op.drop_table("subscription_tiers")

    op.drop_index("memory_spaces_owner_scope_idx", table_name="memory_spaces")
    op.drop_table("memory_spaces")

    op.drop_index("pre_chat_messages_chat_created_idx", table_name="pre_chat_messages")
    op.drop_table("pre_chat_messages")
    op.drop_index("pre_chats_enterprise_status_idx", table_name="pre_chats")
    op.drop_index("pre_chats_talent_status_idx", table_name="pre_chats")
    op.drop_table("pre_chats")
