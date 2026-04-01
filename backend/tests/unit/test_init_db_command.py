from __future__ import annotations

from collections import deque

from csv_cli.commands.init_db import build_bootstrap_config, run_init_db_command


def test_build_bootstrap_config_derives_admin_database_from_target_url() -> None:
    config = build_bootstrap_config("postgresql+psycopg://csv:secret@db.internal:5432/csv")

    assert config.role_name == "csv"
    assert config.role_password == "secret"
    assert config.database_name == "csv"
    assert config.admin_dsn == "postgresql://csv:secret@db.internal:5432/postgres"
    assert config.target_dsn == "postgresql://csv:secret@db.internal:5432/csv"
    assert config.create_extension is True


def test_run_init_db_command_bootstraps_role_database_and_vector(monkeypatch, capsys) -> None:
    fetch_results = deque(
        [
            None,
            None,
        ]
    )
    executed: list[tuple[str, str, object | None]] = []

    class FakeCursor:
        def __init__(self, label: str) -> None:
            self.label = label

        def __enter__(self) -> FakeCursor:
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def execute(self, query, params=None) -> None:
            executed.append((self.label, str(query), params))

        def fetchone(self):
            return fetch_results.popleft()

    class FakeConnection:
        def __init__(self, label: str) -> None:
            self.label = label

        def __enter__(self) -> FakeConnection:
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def cursor(self) -> FakeCursor:
            return FakeCursor(self.label)

    connections: list[tuple[str, bool]] = []

    def fake_connect(dsn: str, *, autocommit: bool):
        connections.append((dsn, autocommit))
        if dsn.endswith("/postgres"):
            return FakeConnection("admin")
        if dsn.endswith("/csv"):
            return FakeConnection("target")
        raise AssertionError(f"Unexpected DSN: {dsn}")

    monkeypatch.setattr("csv_cli.commands.init_db.get_database_url", lambda: "postgresql+psycopg://csv:secret@db.internal:5432/csv")
    monkeypatch.setattr("csv_cli.commands.init_db.psycopg.connect", fake_connect)

    exit_code = run_init_db_command(admin_url=None, create_extension=True)

    assert exit_code == 0
    assert connections == [
        ("postgresql://csv:secret@db.internal:5432/postgres", True),
        ("postgresql://csv:secret@db.internal:5432/csv", True),
    ]
    assert len(executed) == 5
    assert executed[0] == ("admin", "SELECT 1 FROM pg_roles WHERE rolname = %s", ("csv",))
    assert executed[1][0] == "admin"
    assert "CREATE ROLE" in executed[1][1]
    assert executed[1][2] == ("secret",)
    assert executed[2] == ("admin", "SELECT 1 FROM pg_database WHERE datname = %s", ("csv",))
    assert executed[3][0] == "admin"
    assert "CREATE DATABASE" in executed[3][1]
    assert executed[4] == ("target", "CREATE EXTENSION IF NOT EXISTS vector", None)
    assert "Init DB complete" in capsys.readouterr().out
