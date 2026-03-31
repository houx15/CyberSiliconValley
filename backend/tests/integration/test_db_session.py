from __future__ import annotations

import os

import pytest
from sqlalchemy import text

from db.session import create_engine_from_url, create_session_factory, session_scope


DATABASE_URL = os.getenv("DATABASE_URL")


pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is required")


def _create_test_table(engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS csv_session_test (
                    id integer PRIMARY KEY,
                    note text NOT NULL
                )
                """
            )
        )
        connection.execute(text("DELETE FROM csv_session_test"))


def _drop_test_table(engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS csv_session_test"))


def test_engine_and_session_factory_execute_select_one() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    session_factory = create_session_factory(engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1

    with session_factory() as session:
        assert session.execute(text("SELECT 1")).scalar_one() == 1


def test_session_scope_rolls_back_on_error() -> None:
    engine = create_engine_from_url(DATABASE_URL)
    session_factory = create_session_factory(engine)
    _create_test_table(engine)

    try:
        with pytest.raises(RuntimeError):
            with session_scope(session_factory) as session:
                session.execute(
                    text(
                        "INSERT INTO csv_session_test (id, note) VALUES (:id, :note)"
                    ),
                    {"id": 1, "note": "rolled back"},
                )
                raise RuntimeError("boom")

        with engine.connect() as connection:
            count = connection.execute(
                text("SELECT count(*) FROM csv_session_test")
            ).scalar_one()
        assert count == 0
    finally:
        _drop_test_table(engine)
