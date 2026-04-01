from __future__ import annotations

import json

import httpx

from csv_cli.main import build_parser, main


def _build_transport(calls: list[tuple[str, str]]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.url.path == "/api/v1/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.url.path == "/api/v1/auth/login":
            return httpx.Response(200, json={"user": {"id": "u-1", "email": "talent1@csv.dev", "role": "talent"}})
        if request.url.path == "/api/v1/profile":
            return httpx.Response(200, json={"profile": {"display_name": "Talent One", "headline": "AI Engineer"}})
        raise AssertionError(f"Unexpected request: {request.method} {request.url.path}")

    return httpx.MockTransport(handler)


def test_cli_registers_backend_facing_commands() -> None:
    parser = build_parser()
    commands = parser._subparsers._group_actions[0].choices

    assert {"seed", "init-db", "doctor", "whoami", "profile", "matches", "inbox", "graph"} <= set(commands)


def test_init_db_command_dispatches_to_bootstrap_runner(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run_init_db_command(*, admin_url: str | None, create_extension: bool) -> int:
        captured["admin_url"] = admin_url
        captured["create_extension"] = create_extension
        return 0

    monkeypatch.setattr("csv_cli.main.run_init_db_command", fake_run_init_db_command)

    exit_code = main(["init-db", "--admin-url", "postgresql+psycopg://postgres@localhost:5432/postgres"])

    assert exit_code == 0
    assert captured == {
        "admin_url": "postgresql+psycopg://postgres@localhost:5432/postgres",
        "create_extension": True,
    }


def test_doctor_command_hits_health_endpoint(monkeypatch, capsys) -> None:
    calls: list[tuple[str, str]] = []

    class FakeClient:
        def __init__(self, *, base_url: str):
            self._client = httpx.Client(base_url=base_url, transport=_build_transport(calls))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            self._client.close()

        def health(self):
            return self._client.get("/api/v1/health").json()

    monkeypatch.setattr("csv_cli.main.BackendClient", FakeClient)

    exit_code = main(["doctor", "--api-base-url", "http://api.test"])

    assert exit_code == 0
    assert calls == [("GET", "/api/v1/health")]
    assert json.loads(capsys.readouterr().out) == {"status": "ok"}


def test_profile_command_logs_in_then_reads_profile(monkeypatch, capsys) -> None:
    calls: list[tuple[str, str]] = []

    class FakeClient:
        def __init__(self, *, base_url: str):
            self._client = httpx.Client(base_url=base_url, transport=_build_transport(calls))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            self._client.close()

        def authenticate(self, *, email: str, password: str):
            assert email == "talent1@csv.dev"
            assert password == "csv2026"
            return self._client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()

        def read_profile(self):
            return self._client.get("/api/v1/profile").json()

    monkeypatch.setattr("csv_cli.main.BackendClient", FakeClient)

    exit_code = main(
        [
            "profile",
            "--api-base-url",
            "http://api.test",
            "--email",
            "talent1@csv.dev",
            "--password",
            "csv2026",
        ]
    )

    assert exit_code == 0
    assert calls == [
        ("POST", "/api/v1/auth/login"),
        ("GET", "/api/v1/profile"),
    ]
    assert json.loads(capsys.readouterr().out) == {
        "profile": {"display_name": "Talent One", "headline": "AI Engineer"}
    }
