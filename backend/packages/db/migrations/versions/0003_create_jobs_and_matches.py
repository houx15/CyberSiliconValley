from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_create_jobs_and_matches"
down_revision = "0002_create_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("enterprise_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("structured", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'open'"), nullable=False),
        sa.Column("auto_match", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("auto_prechat", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["enterprise_id"],
            ["enterprise_profiles.id"],
            ondelete="CASCADE",
            name=op.f("fk_jobs_enterprise_id_enterprise_profiles"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_jobs")),
    )
    op.create_index("jobs_status_created_at_idx", "jobs", ["status", "created_at"], unique=False)

    op.create_table(
        "matches",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("talent_id", sa.UUID(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'new'"), nullable=False),
        sa.Column("ai_reasoning", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE", name=op.f("fk_matches_job_id_jobs")),
        sa.ForeignKeyConstraint(
            ["talent_id"],
            ["talent_profiles.id"],
            ondelete="CASCADE",
            name=op.f("fk_matches_talent_id_talent_profiles"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_matches")),
        sa.UniqueConstraint("job_id", "talent_id", name="matches_job_talent_unique"),
    )
    op.create_index("matches_job_id_idx", "matches", ["job_id"], unique=False)
    op.create_index("matches_score_idx", "matches", ["score"], unique=False)
    op.create_index("matches_talent_id_idx", "matches", ["talent_id"], unique=False)


def downgrade() -> None:
    op.drop_index("matches_talent_id_idx", table_name="matches")
    op.drop_index("matches_score_idx", table_name="matches")
    op.drop_index("matches_job_id_idx", table_name="matches")
    op.drop_table("matches")
    op.drop_index("jobs_status_created_at_idx", table_name="jobs")
    op.drop_table("jobs")
