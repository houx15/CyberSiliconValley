# CSV Python Backend

This directory contains the production backend for CSV:

- `apps/api` = FastAPI app
- `apps/worker` = arq worker
- `apps/cli` = operator CLI
- `apps/mcp` = MCP server
- `packages/*` = shared contracts, db, core, ai, and redis layers

## Setup

```bash
cp .env.example .env
uv sync
```

## Run the API

```bash
uv run uvicorn csv_api.main:app --reload --host 0.0.0.0 --port 8000
```

## Run the worker

```bash
uv run python -m csv_worker.main
```

## Database

```bash
uv run alembic upgrade head
```

## Seed demo data

```bash
uv run python -m apps.cli.app.main seed --reset
```

## CLI

```bash
uv run python -m apps.cli.app.main doctor --api-base-url http://localhost:8000
uv run python -m apps.cli.app.main whoami --api-base-url http://localhost:8000 --email talent1@csv.dev --password csv2026
```

## MCP

```bash
uv run python -m apps.mcp.app.main
```

## Tests

```bash
uv run pytest
```

## Docker Compose

```bash
docker compose up --build
```
