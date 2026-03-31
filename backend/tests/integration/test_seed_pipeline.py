from __future__ import annotations

import os

import pytest
from sqlalchemy import func, select

from csv_cli.commands.seed import run_seed_command
from db.base import Base
from db.models.enterprise_profile import EnterpriseProfile
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.keyword_edge import KeywordEdge
from db.models.keyword_node import KeywordNode
from db.models.match import Match
from db.models.seeking_report import SeekingReport
from db.models.talent_profile import TalentProfile
from db.models.user import User
from db.session import create_engine_from_url, create_session_factory, session_scope


DATABASE_URL = os.getenv("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is required")


def _table_count(session, model) -> int:
    return int(session.execute(select(func.count()).select_from(model)).scalar_one())


@pytest.fixture(autouse=True)
def clean_seed_schema() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    Base.metadata.drop_all(engine, checkfirst=True)
    Base.metadata.create_all(engine, checkfirst=True)
    try:
        yield
    finally:
        Base.metadata.drop_all(engine, checkfirst=True)
        engine.dispose()


def test_seed_pipeline_creates_demo_dataset() -> None:
    run_seed_command(reset=True)

    engine = create_engine_from_url(DATABASE_URL)
    session_factory = create_session_factory(engine)

    try:
        with session_scope(session_factory) as session:
            assert _table_count(session, User) >= 65
            assert _table_count(session, TalentProfile) >= 50
            assert _table_count(session, EnterpriseProfile) >= 15
            assert _table_count(session, Job) >= 30
            assert _table_count(session, Match) >= 100
            assert _table_count(session, KeywordNode) >= 40
            assert _table_count(session, KeywordEdge) >= 40
            assert _table_count(session, InboxItem) >= 40
            assert _table_count(session, SeekingReport) >= 3

            seeded_demo_emails = {
                row[0]
                for row in session.execute(
                    select(User.email).where(
                        User.email.in_(
                            [
                                "talent1@csv.dev",
                                "talent2@csv.dev",
                                "talent3@csv.dev",
                                "enterprise1@csv.dev",
                                "enterprise2@csv.dev",
                            ]
                        )
                    )
                ).all()
            }
            assert seeded_demo_emails == {
                "talent1@csv.dev",
                "talent2@csv.dev",
                "talent3@csv.dev",
                "enterprise1@csv.dev",
                "enterprise2@csv.dev",
            }

            demo_match_counts = dict(
                session.execute(
                    select(User.email, func.count(Match.id))
                    .join(TalentProfile, TalentProfile.user_id == User.id)
                    .join(Match, Match.talent_id == TalentProfile.id)
                    .where(
                        User.email.in_(
                            [
                                "talent1@csv.dev",
                                "talent2@csv.dev",
                                "talent3@csv.dev",
                            ]
                        ),
                        Match.score >= 80,
                    )
                    .group_by(User.email)
                ).all()
            )
            assert set(demo_match_counts) == {
                "talent1@csv.dev",
                "talent2@csv.dev",
                "talent3@csv.dev",
            }
            assert all(count >= 3 for count in demo_match_counts.values())
    finally:
        engine.dispose()
