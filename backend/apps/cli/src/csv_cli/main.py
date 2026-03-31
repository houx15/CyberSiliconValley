from __future__ import annotations

import argparse

from csv_cli.commands.seed import run_seed_command


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="csv-cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed_parser = subparsers.add_parser("seed", help="Seed demo data into the Python backend schema")
    seed_parser.add_argument("--reset", action="store_true", help="Drop and recreate all backend tables before seeding")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "seed":
        return run_seed_command(reset=bool(args.reset))

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
