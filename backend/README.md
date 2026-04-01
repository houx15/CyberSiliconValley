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
uv run uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run the worker

```bash
uv run python -m apps.worker.app.main
```

## Database

```bash
uv run alembic upgrade head
```

## Seed demo data

```bash
uv run python -m apps.cli.app.main seed --reset
```

Core backend env keys in `backend/.env`:

```bash
DATABASE_URL=postgresql+psycopg://csv:password@localhost:5432/csv
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
APP_SECRET=change-me
COOKIE_DOMAIN=localhost
FRONTEND_ORIGIN=http://localhost:3000
AI_PROTOCOL=anthropic
AI_BASE_URL=
AI_MODEL=claude-sonnet-4-20250514
AI_API_KEY=
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
