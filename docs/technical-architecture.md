# CSV MVP — Current Technical Architecture

## Purpose

This document describes the live architecture for Cyber Silicon Valley after the Python backend cutover. It replaces the earlier Next.js fullstack architecture.

## System Shape

- `frontend/` contains the Next.js frontend only.
- `backend/` contains the Python backend workspace.
- Frontend and backend communicate over HTTP APIs.
- Background work runs in a separate Python worker process.
- PostgreSQL is the system of record.
- Redis is used for queueing, caching, and worker coordination.

## Stack

### Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16 App Router | UI only. No backend business logic in `frontend/src/app/api/**`. |
| Language | TypeScript | Shared frontend types and UI logic. |
| Styling | Tailwind CSS 4 | With shadcn/ui components where useful. |
| Data access | `frontend/src/lib/api/**` | Frontend talks to FastAPI over HTTP and SSE. |

### Backend

| Layer | Choice | Notes |
|-------|--------|-------|
| API | FastAPI | Main HTTP API in `backend/apps/api`. |
| Worker | arq + Redis | Background jobs in `backend/apps/worker`. |
| CLI | Python CLI | Operational commands in `backend/apps/cli`. |
| MCP | Python MCP server | Agent-facing tools in `backend/apps/mcp`. |
| ORM | SQLAlchemy | Database access and models. |
| Migrations | Alembic | Root command path is `backend/alembic.ini`. |
| Package/runtime | uv | Local dev, sync, and run workflow. |

### Data and Infrastructure

| Layer | Choice | Notes |
|-------|--------|-------|
| Database | PostgreSQL + pgvector | Core relational data and embeddings. |
| Queue / cache | Redis | Shared by API and worker. |
| Deployment shape | Split stack | Frontend on `3000`, API on `8000`, worker separate. |
| Reverse proxy | Nginx | Routes `/` to frontend and `/api/` to FastAPI. |

## Repository Structure

```text
frontend/                    Next.js frontend
backend/apps/api             FastAPI application
backend/apps/worker          arq worker application
backend/apps/cli             Python CLI entrypoints
backend/apps/mcp             Python MCP server
backend/packages/*           shared Python packages
docs/archive/                historical plans and legacy architecture
```

## Runtime Boundaries

### Frontend

- Runs as its own Node.js process or container.
- Uses `frontend/src/lib/api/client.ts` and related clients to call backend APIs.
- Must not connect directly to PostgreSQL or Redis.
- Must not reintroduce backend behavior into Next.js route handlers.

### API

- Runs as `uv run uvicorn apps.api.app.main:app`.
- Owns auth, domain APIs, and HTTP streaming endpoints.
- Reads runtime configuration from environment variables, with `backend/.env` supported for local `uv run` workflows.

### Worker

- Runs as `uv run python -m apps.worker.app.main`.
- Consumes Redis-backed jobs and performs async work.
- Does not serve frontend traffic.

### CLI

- Runs as `uv run python -m apps.cli.app.main ...`.
- Handles seeding and operator tasks.

## Local Development

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Backend

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn apps.api.app.main:app --reload --host 0.0.0.0 --port 8000
```

In another shell:

```bash
cd backend
uv run python -m apps.worker.app.main
```

Optional seed:

```bash
cd backend
uv run python -m apps.cli.app.main seed --reset
```

## Docker Model

The container model is split by runtime responsibility:

- `frontend`: Next.js container
- `backend`: FastAPI container
- `worker`: Python worker container
- `postgres`: PostgreSQL dependency
- `redis`: Redis dependency

The current compose file is `backend/docker-compose.yml`.

## Non-Goals

The following are legacy patterns and should not be reintroduced:

- Next.js API routes as the primary backend
- direct frontend database access
- PM2-based monorepo process management
- BullMQ / Node worker infrastructure
- TypeScript backend source of truth
