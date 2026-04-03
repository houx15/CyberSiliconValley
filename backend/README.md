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
uv run python -m apps.cli.app.main init-db --admin-url postgresql+psycopg://postgres:your-admin-password@localhost:5432/postgres
uv run alembic upgrade head
```

`init-db` is the bootstrap step for a brand-new server. It creates the app role, creates the target database, and enables `pgvector` on that database. Use a Postgres admin URL with permission to create roles and databases.

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
uv run python -m apps.cli.app.main init-db --admin-url postgresql+psycopg://postgres:your-admin-password@localhost:5432/postgres
uv run python -m apps.cli.app.main whoami --api-base-url http://localhost:8000 --email talent1@csv.dev --password csv2026
```

## MCP

```bash
uv run python -m apps.mcp.app.main
```

## Messaging System

The platform includes a two-phase messaging system: **AI Pre-Chat** screening followed by **Direct Messaging**.

### Pre-Chat Flow

```
Enterprise initiates → ai_screening → pending_talent_review → talent accepts → completed + Conversation
                                                             → talent declines → declined
```

- All state transitions use atomic `UPDATE WHERE` + rowcount checks to prevent race conditions
- AI screening runs in the worker with short DB transactions (AI calls happen outside locks)
- Talent must explicitly accept/decline after AI screening — consent is never set on their behalf
- Enterprise can manually complete an active human pre-chat → goes to `pending_talent_review`

### Direct Messaging

- `GET /api/v1/conversations` — list user's conversations (paginated, limit 100)
- `GET /api/v1/conversations/{id}` — conversation detail with messages (newest 50, `hasMore` flag)
- `POST /api/v1/conversations/{id}/messages` — send message (validates participant, whitespace/length)
- `GET /api/v1/conversations/{id}/messages/poll?after=<iso>` — poll for new messages

### Key Design Decisions

- **Atomic transitions**: every state change uses `UPDATE WHERE ... RETURNING rowcount` — no read-modify-write
- **Worker short transactions**: AI calls run outside DB locks; each round claims ownership via guarded UPDATE
- **Prompt safety**: untrusted user data (job descriptions, profiles) placed in delimited data blocks with sanitization
- **Poll cursor**: uses `>=` with frontend dedup-by-ID to avoid losing same-timestamp messages
- **`last_message_at`**: updated via `GREATEST(COALESCE(...))` to handle NULL and prevent backward movement

## Tests

```bash
uv run pytest
```

## Docker Compose

```bash
docker compose up --build
```

This starts `frontend`, `postgres`, `redis`, a one-shot `migrate` service, then the API and worker. A fresh Compose stack applies Alembic migrations automatically before the runtime services come up.
