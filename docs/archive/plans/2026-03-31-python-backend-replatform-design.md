# Python Backend Replatform Design

## Overview

Cyber Silicon Valley should stop using `Next.js` as a monolithic frontend-backend runtime. The current codebase mixes UI rendering, database access, auth verification, background jobs, and AI orchestration inside the same TypeScript app. That makes the frontend operationally heavy and pushes backend concerns into page code, route handlers, and shared utilities.

The target architecture is a strict split:

- `Next.js` owns the frontend only
- `FastAPI` owns all backend behavior
- `PostgreSQL` remains the system of record
- `Redis` remains the cache and job substrate
- `uv` manages Python dependencies and workspaces
- `docker compose` manages local development and the single-ECS deployment topology

This is a hard rewrite, not a compatibility bridge. The rewrite should optimize for clean technical design rather than migration cost minimization.

---

## Goals

- Make the backend a clean Python system with explicit boundaries
- Remove all database, queue, auth, and AI backend ownership from the Next.js app
- Keep the product surface intact: talent, enterprise, coach, seeking, fair graph, inbox, matching, screening, onboarding
- Keep PostgreSQL and Redis as core infrastructure
- Make local and ECS environments converge under `docker compose`
- Keep the architecture simple enough for a solo developer to reason about

## Non-Goals

- Preserve current TypeScript backend APIs or file structure for their own sake
- Maintain a dual-runtime backend during the rewrite
- Split the system into many deployable services from day one
- Add speculative infrastructure such as Kafka, Celery clusters, or service mesh

---

## Architecture Decision

### Recommended Shape

Use a modular Python backend with HTTP-first adapters:

- `frontend/` or the existing Next.js root app renders UI only
- `backend/apps/api` serves the public API via `FastAPI`
- `backend/apps/worker` runs async jobs
- `backend/apps/cli` provides the operator CLI
- `backend/apps/mcp` provides the MCP server
- shared Python packages hold contracts, domain logic, persistence, Redis integration, and AI orchestration

The backend API is the single operational boundary. The frontend, CLI, and MCP server should all consume backend capabilities through explicit service contracts rather than shared hidden state.

### Why This Shape

- It makes the frontend/backend boundary obvious
- It prevents the Next.js app from growing backend behavior again
- It keeps CLI and MCP aligned with the backend domain model without treating them as frontend features
- It keeps the single-ECS deployment simple while preserving a clean path to future horizontal decomposition

---

## Target Repository Structure

```text
csv/
├── src/                              # Next.js frontend only
│   ├── app/
│   ├── components/
│   ├── i18n/
│   ├── lib/
│   │   ├── api/                      # frontend API client wrappers only
│   │   ├── session/                  # frontend session helpers only
│   │   └── utils/
│   └── types/
├── backend/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── apps/
│   │   ├── api/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │   ├── config.py
│   │   │   │   ├── dependencies/
│   │   │   │   ├── middleware/
│   │   │   │   └── routers/
│   │   │   └── Dockerfile
│   │   ├── worker/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │   └── jobs/
│   │   │   └── Dockerfile
│   │   ├── cli/
│   │   │   └── app/
│   │   │       ├── main.py
│   │   │       └── commands/
│   │   └── mcp/
│   │       └── app/
│   │           ├── main.py
│   │           └── tools/
│   ├── packages/
│   │   ├── contracts/
│   │   │   └── src/contracts/
│   │   ├── core/
│   │   │   └── src/core/
│   │   ├── db/
│   │   │   └── src/db/
│   │   ├── ai/
│   │   │   └── src/ai/
│   │   └── redis_layer/
│   │       └── src/redis_layer/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── contract/
├── nginx.conf
└── README.md
```

---

## Backend Boundaries

### API App

`backend/apps/api` owns:

- auth endpoints
- profile endpoints
- jobs endpoints
- matches endpoints
- inbox endpoints
- seeking endpoints
- graph endpoints
- AI chat endpoints
- health and readiness endpoints

Routers must stay thin:

- validate request input
- call a domain service
- map the domain result to a response contract
- avoid SQL, Redis, provider routing, and business branching in the router layer

### Worker App

`backend/apps/worker` owns:

- report generation
- pre-chat jobs
- match scans
- graph refreshes
- embedding generation
- long-running or retryable AI tasks

The worker must not duplicate domain logic. It should import shared services and run them in background execution contexts.

### CLI App

`backend/apps/cli` is a thin operator/client surface:

- admin and demo commands
- seed commands
- diagnostic commands
- optional authenticated user actions if desired later

It should call backend APIs or shared application services through explicit entrypoints. It should not query Postgres directly from ad hoc scripts.

### MCP App

`backend/apps/mcp` exposes CSV actions to agent clients:

- create/read/update profile information
- inspect matches and inbox items
- ask for market graph data
- initiate backend-side AI workflows

It should be a thin adapter over the same core/backend contracts, not a separate backend.

---

## Data Layer

### Database

- PostgreSQL remains the primary datastore
- `pgvector` remains in PostgreSQL
- `SQLAlchemy 2.x` is the ORM/query layer
- `Alembic` manages migrations
- `psycopg` is the PostgreSQL driver

The rewrite should not introduce a separate vector database.

### Persistence Design

- SQLAlchemy models live in `backend/packages/db/src/db/models`
- session setup lives in `backend/packages/db/src/db/session.py`
- migrations live under `backend/packages/db/migrations`
- query code stays close to the bounded domain it serves

Avoid over-abstracted generic repositories. Use explicit repository or query modules per domain where they create clarity:

- `db/repositories/auth.py`
- `db/repositories/profiles.py`
- `db/repositories/matching.py`
- `db/repositories/inbox.py`
- `db/repositories/graph.py`

### Domain Modules

Use bounded modules for core behavior:

- `core/auth`
- `core/profiles`
- `core/jobs`
- `core/matching`
- `core/seeking`
- `core/inbox`
- `core/coach`
- `core/screening`
- `core/graph`

Rules:

- framework objects do not enter domain services
- domain services do not know about FastAPI or MCP
- SQL access does not leak into routers

---

## Redis and Background Jobs

### Redis Usage

Redis remains responsible for:

- background job queueing
- caching
- short-lived workflow state
- rate limiting
- distributed locks if needed

### Queue Choice

Use `arq`.

Why:

- Redis-native
- async-friendly
- materially simpler than Celery for this scale
- appropriate for one ECS host and clean enough to expand later

BullMQ should be retired with the TypeScript backend.

### Job Types

The first worker job families should be:

- `scan_matches`
- `generate_seeking_report`
- `run_prechat`
- `embed_profile`
- `embed_job`
- `refresh_graph`

These names should remain explicit and product-oriented rather than generic “task runner” terminology.

---

## Auth Model

The backend must own auth completely.

### Recommended Auth Shape

- credential login via backend endpoint
- backend issues `HttpOnly` signed auth cookie
- cookie is `Secure` in production
- frontend never verifies JWTs locally
- frontend reads current user/session through backend endpoints

This replaces the current pattern where:

- Next.js middleware checks auth cookies
- pages call `verifyJWT`
- API routes independently enforce auth

That pattern duplicates backend responsibility inside the frontend runtime and should be removed.

### Frontend Auth Behavior

The frontend should:

- redirect based on backend session responses
- send browser credentials on API calls
- treat auth as remote state, not local cryptographic logic

---

## API Contract Model

The public backend contract remains versioned under `/api/v1/...`.

### Contract Principles

- request and response schemas are defined in `Pydantic v2`
- contracts are explicit, stable, and product-facing
- frontend client wrappers consume these contracts
- CLI and MCP reuse the same contract layer where useful

### Initial API Surface

- `/api/v1/auth/*`
- `/api/v1/profile/*`
- `/api/v1/jobs/*`
- `/api/v1/matches/*`
- `/api/v1/inbox/*`
- `/api/v1/seeking/*`
- `/api/v1/graph/*`
- `/api/v1/coach/*`
- `/api/v1/screening/*`
- `/api/v1/resume/*`
- `/api/v1/session`
- `/api/v1/health`

### AI Streaming

For coach, screening, onboarding, and companion streaming:

- use FastAPI streaming responses or SSE
- keep streamed transport simple and browser-friendly
- persist messages on the backend
- do not rebuild a frontend-owned AI state machine

---

## AI Layer

The AI layer moves entirely into Python.

### Responsibilities

- provider routing
- system prompts
- prompt assembly
- chat persistence orchestration
- tool execution
- structured extraction and report generation

### Proposed Package

`backend/packages/ai/src/ai/`

- `providers/`
- `prompts/`
- `workflows/`
- `streaming/`

### Design Rules

- prompts are versioned code assets, not scattered string fragments
- provider selection is centralized
- AI workflows return typed results or typed stream events
- backend owns prompt evolution and message persistence

---

## Frontend Refactor Rules

The Next.js app must be reduced to a frontend-only role.

### What Must Leave the Frontend

The following backend-heavy areas should be removed or emptied from the Next.js app during the rewrite:

- `src/app/api/internal/**`
- `src/app/api/v1/**`
- `src/lib/db/**`
- `src/lib/jobs/**`
- `src/lib/auth/**` except minimal frontend session utilities if still needed
- backend-heavy portions of `src/lib/ai/**`
- server pages that directly import DB or backend auth code

### What Stays

- page/layout rendering
- client and server UI composition
- component state
- i18n
- frontend API clients in `src/lib/api`
- lightweight route guards based on backend session fetches

### Frontend Data Access Rule

Treat the backend as if it were a third-party service:

- no direct Postgres access
- no direct Redis access
- no business logic in page loaders
- no local JWT verification

---

## Local Development and Deployment

### Local Development

`docker compose` should run:

- `frontend`
- `backend`
- `worker`
- `postgres`
- `redis`

This becomes the default development model for backend work. The frontend may still run locally outside Docker when convenient, but the supported stack must be compose-first.

### ECS Deployment

The current deployment target remains a single ECS machine.

That is acceptable if the system is containerized cleanly:

- reverse proxy routes `/` to Next.js
- reverse proxy routes `/api` to FastAPI
- worker runs as a separate process/container
- Postgres and Redis can remain on-box initially

Future move to separate services should be operational, not architectural:

- backend already isolated
- worker already isolated
- frontend already isolated

---

## Rewrite Strategy

Because nothing is publicly launched yet, the correct strategy is a hard rewrite.

Before code deletion starts, preserve the current TypeScript backend as a reference point in git:

- create the archive tag `archive/ts-backend-pre-python-rewrite` before removing old backend files
- do not duplicate the old backend into a second on-disk copy inside the active repo
- use git history as the reference source during the rewrite

This keeps the working tree clean and avoids making the current TypeScript build problem worse by retaining duplicate backend trees under new folders.

### Phase 1: Freeze the TypeScript Backend

Stop adding backend behavior to:

- `src/app/api/**`
- `src/lib/db/**`
- `src/lib/jobs/**`
- `src/lib/auth/**`
- backend-owned `src/lib/ai/**`

Frontend-only work may continue if it does not deepen the old architecture.

Do not drop the existing PostgreSQL tables at this stage. The current schema remains the best behavioral reference for:

- API/domain reconstruction
- seed fixture parity
- model naming and relationship review

Table drops should happen only after the Python schema, migrations, seed pipeline, and smoke tests are in place.

### Phase 2: Scaffold the Python Platform

Create:

- `backend/pyproject.toml`
- `backend/apps/api`
- `backend/apps/worker`
- `backend/apps/cli`
- `backend/apps/mcp`
- shared packages
- compose stack
- health checks

The first proof point is not a product feature. It is a running backend with DB, Redis, migration support, worker connectivity, and auth skeleton.

### Phase 3: Rebuild by Product Domain

Rebuild backend features domain-by-domain:

1. auth + session
2. profiles + onboarding extraction
3. jobs
4. matches
5. inbox + seeking
6. coach + screening
7. graph/fair
8. seed/demo pipeline

This avoids framework-layer progress that produces no usable product slices.

### Phase 4: Refactor the Frontend

As each backend domain lands:

- replace frontend direct imports with API clients
- remove corresponding TypeScript backend files
- keep pages and UI behavior intact where possible

### Phase 5: Delete the Old Backend

After parity:

- remove `src/app/api/**`
- remove backend runtime code from `src/lib`
- remove Node worker/runtime scripts
- update docs, PM2/Docker, and deployment commands
- only then retire or replace the legacy PostgreSQL schema as part of the Python cutover

---

## Risks

### 1. Frontend/Backend Untangling

Current pages and routes mix rendering with backend access. Untangling this will touch many files. That is expected. The rewrite should not try to preserve these patterns.

### 2. AI Streaming Regression

Chat and streaming UX are easy to degrade during a language/runtime rewrite. Streaming transport and message persistence need early proof, not late cleanup.

### 3. Auth Boundary Drift

If cookies, proxying, and session checks are handled late, the frontend will start re-growing backend logic. Auth must be settled near the beginning.

### 4. Seed and Demo Quality

Seed scripts are part of the product demo surface. They must be rebuilt intentionally in Python, not copied as an afterthought.

---

## Success Criteria

- `docker compose up` starts the full product stack
- Next.js contains no direct DB/Redis/backend ownership
- FastAPI owns all API, auth, AI orchestration, and persistence-facing workflows
- worker runs independently and processes Redis-backed jobs
- seed and demo workflows run from Python
- ECS deployment becomes a straightforward containerized flow

---

## Implementation Guidance

- prefer explicit modules over clever abstractions
- keep routers thin
- keep domain services readable
- keep contracts typed and stable
- keep infrastructure boring
- delete old backend code aggressively once the new slices are ready

The point of this rewrite is not “move TypeScript to Python.” The point is to restore a clean system boundary so the frontend is just a frontend and the backend is actually a backend.
