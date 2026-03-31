from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_create_inbox_seeking_graph"
down_revision = "0003_create_jobs_and_matches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inbox_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name=op.f("fk_inbox_items_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inbox_items")),
    )
    op.create_index("inbox_items_user_read_created_idx", "inbox_items", ["user_id", "read", "created_at"], unique=False)

    op.create_table(
        "seeking_reports",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("talent_id", sa.UUID(), nullable=False),
        sa.Column("report_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["talent_id"], ["talent_profiles.id"], ondelete="CASCADE", name=op.f("fk_seeking_reports_talent_id_talent_profiles")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_seeking_reports")),
    )
    op.create_index("seeking_reports_talent_generated_idx", "seeking_reports", ["talent_id", "generated_at"], unique=False)

    op.create_table(
        "keyword_nodes",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("keyword", sa.String(length=100), nullable=False),
        sa.Column("job_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("trending", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_keyword_nodes")),
        sa.UniqueConstraint("keyword", name=op.f("uq_keyword_nodes_keyword")),
    )

    op.create_table(
        "keyword_edges",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("weight", sa.Float(), server_default=sa.text("1.0"), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["keyword_nodes.id"], ondelete="CASCADE", name=op.f("fk_keyword_edges_source_id_keyword_nodes")),
        sa.ForeignKeyConstraint(["target_id"], ["keyword_nodes.id"], ondelete="CASCADE", name=op.f("fk_keyword_edges_target_id_keyword_nodes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_keyword_edges")),
        sa.UniqueConstraint("source_id", "target_id", name="keyword_edges_source_target_unique"),
    )


def downgrade() -> None:
    op.drop_table("keyword_edges")
    op.drop_table("keyword_nodes")
    op.drop_index("seeking_reports_talent_generated_idx", table_name="seeking_reports")
    op.drop_table("seeking_reports")
    op.drop_index("inbox_items_user_read_created_idx", table_name="inbox_items")
    op.drop_table("inbox_items")
