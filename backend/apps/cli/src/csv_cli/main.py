from __future__ import annotations

import argparse
import json
import os
import sys

from csv_cli.backend import BackendApiError, BackendClient
from csv_cli.commands.init_db import run_init_db_command
from csv_cli.commands.seed import run_seed_command


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="csv-cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed_parser = subparsers.add_parser("seed", help="Seed demo data into the Python backend schema")
    seed_parser.add_argument("--reset", action="store_true", help="Drop and recreate all backend tables before seeding")

    init_db_parser = subparsers.add_parser(
        "init-db",
        help="Create the database role, database, and optional extensions",
    )
    init_db_parser.add_argument("--admin-url", default=None, help="Postgres admin URL used for role/database creation")
    init_db_parser.add_argument(
        "--skip-vector",
        action="store_true",
        help="Skip CREATE EXTENSION IF NOT EXISTS vector on the target database",
    )

    doctor_parser = subparsers.add_parser("doctor", help="Check backend health")
    doctor_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")

    whoami_parser = subparsers.add_parser("whoami", help="Log in and print the current backend session")
    whoami_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")
    whoami_parser.add_argument("--email", default=None, help="Login email")
    whoami_parser.add_argument("--password", default=None, help="Login password")

    profile_parser = subparsers.add_parser("profile", help="Log in and print the current profile")
    profile_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")
    profile_parser.add_argument("--email", default=None, help="Login email")
    profile_parser.add_argument("--password", default=None, help="Login password")

    matches_parser = subparsers.add_parser("matches", help="Log in and list enterprise matches")
    matches_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")
    matches_parser.add_argument("--email", default=None, help="Login email")
    matches_parser.add_argument("--password", default=None, help="Login password")

    inbox_parser = subparsers.add_parser("inbox", help="Log in and list inbox items")
    inbox_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")
    inbox_parser.add_argument("--email", default=None, help="Login email")
    inbox_parser.add_argument("--password", default=None, help="Login password")
    inbox_parser.add_argument(
        "--filter",
        default="all",
        choices=["all", "invites", "prechats", "matches", "system"],
        help="Inbox filter",
    )

    graph_parser = subparsers.add_parser("graph", help="Read opportunity graph data")
    graph_parser.add_argument("--api-base-url", default=None, help="Backend API base URL")
    graph_parser.add_argument("--keyword", default=None, help="Keyword to inspect")
    graph_parser.add_argument("--job-id", default=None, help="Optional job ID for keyword detail lookup")

    return parser


def _print_json(payload: object) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))


def _resolve_credentials(args: argparse.Namespace) -> tuple[str, str]:
    email = args.email or os.getenv("CSV_EMAIL")
    password = args.password or os.getenv("CSV_PASSWORD")
    if not email or not password:
        raise ValueError("Credentials are required. Pass --email/--password or set CSV_EMAIL and CSV_PASSWORD.")
    return email, password


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "seed":
        return run_seed_command(reset=bool(args.reset))

    if args.command == "init-db":
        return run_init_db_command(admin_url=args.admin_url, create_extension=not bool(args.skip_vector))

    try:
        with BackendClient(base_url=getattr(args, "api_base_url", None)) as client:
            if args.command == "doctor":
                _print_json(client.health())
                return 0

            if args.command == "whoami":
                email, password = _resolve_credentials(args)
                client.authenticate(email=email, password=password)
                _print_json(client.read_session())
                return 0

            if args.command == "profile":
                email, password = _resolve_credentials(args)
                client.authenticate(email=email, password=password)
                _print_json(client.read_profile())
                return 0

            if args.command == "matches":
                email, password = _resolve_credentials(args)
                client.authenticate(email=email, password=password)
                _print_json(client.list_matches())
                return 0

            if args.command == "inbox":
                email, password = _resolve_credentials(args)
                client.authenticate(email=email, password=password)
                _print_json(client.list_inbox(filter_value=args.filter))
                return 0

            if args.command == "graph":
                if args.keyword:
                    _print_json(client.read_keyword_jobs(keyword=args.keyword, job_id=args.job_id))
                else:
                    _print_json(client.read_graph())
                return 0
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except BackendApiError as exc:
        print(f"Backend error ({exc.status_code}): {exc}", file=sys.stderr)
        return 1

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
