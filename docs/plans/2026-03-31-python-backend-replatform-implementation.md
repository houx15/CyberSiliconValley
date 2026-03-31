# Python Backend Replatform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current TypeScript backend with a clean Python backend based on FastAPI, PostgreSQL, Redis, `uv`, and `docker compose`, while reducing the existing Next.js app to a frontend-only client.

**Architecture:** Build a new `backend/` workspace with separate API, worker, CLI, and MCP apps over shared Python packages. Rebuild the product by backend domain slices, then refactor the frontend to consume backend APIs and delete the old backend runtime code.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, psycopg, Redis, arq, uv, Docker Compose, pytest, httpx, Next.js 16, React 19, PostgreSQL, pgvector

---

## Rewrite Rules

- [ ] Create a git archive tag or branch before deleting the old backend
- [ ] Do not duplicate the old backend code into a second live tree inside the repo
- [ ] Do not drop the current PostgreSQL tables until the Python schema, migrations, and seeds are verified
- [ ] Do not add new backend behavior to `src/app/api/**`, `src/lib/db/**`, `src/lib/jobs/**`, or backend-owned `src/lib/ai/**`
- [ ] Keep the frontend shippable only through backend API clients
- [ ] Delete old backend code as soon as the Python replacement for that slice is verified
- [ ] Prefer explicit contracts and services over generic abstractions
- [ ] Keep every task test-first where practical

---

### Task 0: Archive the current backend reference in git

**Files:**
- Modify: none

- [ ] **Step 1: Create an archive branch or tag**

Use git history, not a duplicated source tree, as the TypeScript backend reference:

```bash
git tag archive/ts-backend-pre-python-rewrite
# or
git branch archive/ts-backend-pre-python-rewrite
```

Expected: the current backend can be recovered or diffed at any time without keeping duplicate code in the active worktree.

- [ ] **Step 2: Record the archive point in the design docs**

Add the chosen tag or branch name to the cutover notes and README if useful.

- [ ] **Step 3: Commit any doc references**

```bash
git add README.md docs/plans
git commit -m "docs: record typescript backend archive reference"
```

---

### Task 1: Scaffold the Python workspace

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/uv.lock`
- Create: `backend/.python-version`
- Create: `backend/.env.example`
- Create: `backend/README.md`

- [ ] **Step 1: Create the workspace files**

Create `backend/pyproject.toml` with a uv workspace that defines:

- shared dependencies
- workspace members for `apps/api`, `apps/worker`, `apps/cli`, `apps/mcp`
- local package sources under `packages/*`

- [ ] **Step 2: Add core dependencies**

Include:

- `fastapi`
- `uvicorn`
- `pydantic`
- `sqlalchemy`
- `alembic`
- `psycopg[binary]`
- `redis`
- `arq`
- `httpx`
- `pytest`
- `pytest-asyncio`
- `anyio`
- `ruff`
- `mypy`

- [ ] **Step 3: Add backend env template**

Create `backend/.env.example` with:

- `DATABASE_URL`
- `REDIS_URL`
- `APP_ENV`
- `APP_SECRET`
- `COOKIE_DOMAIN`
- `FRONTEND_ORIGIN`
- AI provider keys

- [ ] **Step 4: Add backend README**

Document:

- `uv sync`
- `docker compose up`
- `alembic upgrade head`
- `pytest`

- [ ] **Step 5: Verify workspace resolution**

Run:

```bash
cd backend
uv sync
```

Expected: environment resolves and lockfile is generated without import errors.

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/.python-version backend/.env.example backend/README.md
git commit -m "feat: scaffold python backend workspace"
```

---

### Task 2: Add Docker Compose orchestration

**Files:**
- Create: `backend/docker-compose.yml`
- Create: `backend/apps/api/Dockerfile`
- Create: `backend/apps/worker/Dockerfile`
- Modify: `README.md`

- [ ] **Step 1: Write compose services**

Create services for:

- `frontend`
- `backend`
- `worker`
- `postgres`
- `redis`

- [ ] **Step 2: Add health checks**

Add compose health checks for:

- Postgres readiness
- Redis ping
- backend `/api/v1/health`

- [ ] **Step 3: Add Dockerfiles**

Create Dockerfiles for `apps/api` and `apps/worker` using `uv`-based install steps.

- [ ] **Step 4: Document compose workflow**

Update `README.md` to prefer:

```bash
cd backend
docker compose up --build
```

- [ ] **Step 5: Verify containers boot**

Run:

```bash
cd backend
docker compose up -d postgres redis
docker compose ps
```

Expected: `postgres` and `redis` are healthy.

- [ ] **Step 6: Commit**

```bash
git add backend/docker-compose.yml backend/apps/api/Dockerfile backend/apps/worker/Dockerfile README.md
git commit -m "feat: add backend docker compose stack"
```

---

### Task 3: Create shared Python packages and import boundaries

**Files:**
- Create: `backend/packages/contracts/src/contracts/__init__.py`
- Create: `backend/packages/core/src/core/__init__.py`
- Create: `backend/packages/db/src/db/__init__.py`
- Create: `backend/packages/ai/src/ai/__init__.py`
- Create: `backend/packages/redis_layer/src/redis_layer/__init__.py`
- Create: `backend/tests/unit/.gitkeep`
- Create: `backend/tests/integration/.gitkeep`
- Create: `backend/tests/contract/.gitkeep`

- [ ] **Step 1: Create package skeletons**

Create the shared packages and minimal `pyproject.toml` package definitions if the workspace layout requires them.

- [ ] **Step 2: Add import smoke tests**

Create a lightweight import test:

```python
def test_workspace_packages_import():
    import contracts  # noqa: F401
    import core  # noqa: F401
    import db  # noqa: F401
```

- [ ] **Step 3: Run smoke tests**

Run:

```bash
cd backend
uv run pytest backend/tests/unit -q
```

Expected: package imports succeed.

- [ ] **Step 4: Commit**

```bash
git add backend/packages backend/tests
git commit -m "feat: add shared backend package skeleton"
```

---

### Task 4: Build API app bootstrap and health endpoints

**Files:**
- Create: `backend/apps/api/app/main.py`
- Create: `backend/apps/api/app/config.py`
- Create: `backend/apps/api/app/routers/health.py`
- Create: `backend/apps/api/app/dependencies/__init__.py`
- Create: `backend/tests/integration/test_health.py`

- [ ] **Step 1: Write failing health test**

Create `backend/tests/integration/test_health.py` for:

- `/api/v1/health`
- `/api/v1/ready`

- [ ] **Step 2: Implement FastAPI app bootstrap**

Create:

- app factory
- versioned API router prefix
- basic settings loader

- [ ] **Step 3: Implement health handlers**

Return:

- app status
- version
- dependency readiness summary shape

- [ ] **Step 4: Run integration tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_health.py -q
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/api/app backend/tests/integration/test_health.py
git commit -m "feat: bootstrap fastapi app with health endpoints"
```

---

### Task 5: Add SQLAlchemy, Alembic, and database session plumbing

**Files:**
- Create: `backend/packages/db/src/db/base.py`
- Create: `backend/packages/db/src/db/session.py`
- Create: `backend/packages/db/src/db/models/__init__.py`
- Create: `backend/packages/db/alembic.ini`
- Create: `backend/packages/db/migrations/env.py`
- Create: `backend/tests/integration/test_db_session.py`

- [ ] **Step 1: Write DB connectivity test**

Test:

- session creation
- simple `SELECT 1`
- transaction rollback behavior

- [ ] **Step 2: Implement session factory**

Add:

- engine creation
- sync or async session strategy
- request-scoped session helper

- [ ] **Step 3: Wire Alembic**

Create working migration config pointing at the SQLAlchemy metadata.

- [ ] **Step 4: Run DB test**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_db_session.py -q
```

Expected: DB integration test passes against compose Postgres.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/db backend/tests/integration/test_db_session.py
git commit -m "feat: add sqlalchemy session and alembic setup"
```

---

### Task 6: Add Redis and arq worker bootstrap

**Files:**
- Create: `backend/packages/redis_layer/src/redis_layer/queue.py`
- Create: `backend/packages/redis_layer/src/redis_layer/cache.py`
- Create: `backend/apps/worker/app/main.py`
- Create: `backend/apps/worker/app/jobs/ping.py`
- Create: `backend/tests/integration/test_worker_ping.py`

- [ ] **Step 1: Write failing worker ping test**

Test:

- enqueue job
- worker processes job
- result is observable

- [ ] **Step 2: Implement Redis helpers**

Add:

- Redis client factory
- arq config
- queue helper

- [ ] **Step 3: Implement worker bootstrap**

Create a minimal worker entry and one `ping` job.

- [ ] **Step 4: Run worker integration test**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_worker_ping.py -q
```

Expected: job is processed successfully.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/redis_layer backend/apps/worker/app backend/tests/integration/test_worker_ping.py
git commit -m "feat: add redis queue and worker bootstrap"
```

---

### Task 7: Implement auth domain and session endpoints

**Files:**
- Create: `backend/packages/contracts/src/contracts/auth.py`
- Create: `backend/packages/core/src/core/auth/service.py`
- Create: `backend/packages/db/src/db/models/user.py`
- Create: `backend/packages/db/src/db/repositories/auth.py`
- Create: `backend/apps/api/app/routers/auth.py`
- Create: `backend/tests/integration/test_auth_api.py`
- Modify: `backend/packages/db/migrations/*`

- [ ] **Step 1: Write failing auth API tests**

Cover:

- login success
- login failure
- session read
- logout

- [ ] **Step 2: Implement auth contracts and service**

Add:

- credential validation
- password hash verification
- signed auth cookie issuing
- current session reader

- [ ] **Step 3: Implement auth persistence**

Add `users` model and auth repository methods.

- [ ] **Step 4: Add migration and seed fixture**

Create migration for `users` and a test fixture user.

- [ ] **Step 5: Run auth tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_auth_api.py -q
```

Expected: auth tests pass with cookie-based session flow.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/contracts/src/contracts/auth.py backend/packages/core/src/core/auth backend/packages/db/src/db/models/user.py backend/packages/db/src/db/repositories/auth.py backend/apps/api/app/routers/auth.py backend/tests/integration/test_auth_api.py backend/packages/db/migrations
git commit -m "feat: implement backend auth and session endpoints"
```

---

### Task 8: Implement profile and onboarding backend slice

**Files:**
- Create: `backend/packages/contracts/src/contracts/profile.py`
- Create: `backend/packages/core/src/core/profiles/service.py`
- Create: `backend/packages/core/src/core/profiles/onboarding.py`
- Create: `backend/packages/db/src/db/models/talent_profile.py`
- Create: `backend/packages/db/src/db/models/enterprise_profile.py`
- Create: `backend/packages/db/src/db/repositories/profiles.py`
- Create: `backend/apps/api/app/routers/profile.py`
- Create: `backend/apps/api/app/routers/onboarding.py`
- Create: `backend/tests/integration/test_profile_api.py`

- [ ] **Step 1: Write failing profile/onboarding tests**

Cover:

- get current profile
- update profile
- onboarding extract/update flow shape

- [ ] **Step 2: Implement profile contracts and services**

Add talent and enterprise profile operations.

- [ ] **Step 3: Implement DB models and repository**

Map current core profile tables cleanly in SQLAlchemy.

- [ ] **Step 4: Implement API routers**

Expose profile read/write and onboarding endpoints.

- [ ] **Step 5: Run profile tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_profile_api.py -q
```

Expected: profile and onboarding contract tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/contracts/src/contracts/profile.py backend/packages/core/src/core/profiles backend/packages/db/src/db/models/talent_profile.py backend/packages/db/src/db/models/enterprise_profile.py backend/packages/db/src/db/repositories/profiles.py backend/apps/api/app/routers/profile.py backend/apps/api/app/routers/onboarding.py backend/tests/integration/test_profile_api.py
git commit -m "feat: implement profile and onboarding backend slice"
```

---

### Task 9: Implement jobs and matching backend slice

**Files:**
- Create: `backend/packages/contracts/src/contracts/jobs.py`
- Create: `backend/packages/contracts/src/contracts/matches.py`
- Create: `backend/packages/core/src/core/jobs/service.py`
- Create: `backend/packages/core/src/core/matching/service.py`
- Create: `backend/packages/db/src/db/models/job.py`
- Create: `backend/packages/db/src/db/models/match.py`
- Create: `backend/packages/db/src/db/repositories/jobs.py`
- Create: `backend/packages/db/src/db/repositories/matching.py`
- Create: `backend/apps/api/app/routers/jobs.py`
- Create: `backend/apps/api/app/routers/matches.py`
- Create: `backend/tests/integration/test_jobs_matches_api.py`

- [ ] **Step 1: Write failing jobs/matches tests**

Cover:

- create/list jobs
- fetch job detail
- list matches
- fetch match detail

- [ ] **Step 2: Implement contracts, models, and services**

Add clean job and match slice behavior.

- [ ] **Step 3: Implement API routers**

Expose the routes under `/api/v1/jobs` and `/api/v1/matches`.

- [ ] **Step 4: Add background scan trigger**

Queue a worker job for match scan from the API boundary.

- [ ] **Step 5: Run tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_jobs_matches_api.py -q
```

Expected: jobs and matches slice passes integration coverage.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/contracts/src/contracts/jobs.py backend/packages/contracts/src/contracts/matches.py backend/packages/core/src/core/jobs backend/packages/core/src/core/matching backend/packages/db/src/db/models/job.py backend/packages/db/src/db/models/match.py backend/packages/db/src/db/repositories/jobs.py backend/packages/db/src/db/repositories/matching.py backend/apps/api/app/routers/jobs.py backend/apps/api/app/routers/matches.py backend/tests/integration/test_jobs_matches_api.py
git commit -m "feat: implement jobs and matching backend slice"
```

---

### Task 10: Implement inbox, seeking, resume, and graph backend slices

**Files:**
- Create: `backend/packages/contracts/src/contracts/inbox.py`
- Create: `backend/packages/contracts/src/contracts/seeking.py`
- Create: `backend/packages/contracts/src/contracts/graph.py`
- Create: `backend/packages/core/src/core/inbox/service.py`
- Create: `backend/packages/core/src/core/seeking/service.py`
- Create: `backend/packages/core/src/core/graph/service.py`
- Create: `backend/packages/db/src/db/models/inbox_item.py`
- Create: `backend/packages/db/src/db/models/seeking_report.py`
- Create: `backend/packages/db/src/db/models/keyword_node.py`
- Create: `backend/packages/db/src/db/models/keyword_edge.py`
- Create: `backend/apps/api/app/routers/inbox.py`
- Create: `backend/apps/api/app/routers/seeking.py`
- Create: `backend/apps/api/app/routers/graph.py`
- Create: `backend/apps/api/app/routers/resume.py`
- Create: `backend/tests/integration/test_inbox_seeking_graph_api.py`

- [ ] **Step 1: Write failing integration tests**

Cover:

- inbox list/detail
- seeking report fetch
- tailored resume generation endpoint shape
- graph overview and keyword jobs

- [ ] **Step 2: Implement contracts, models, and services**

Add inbox, seeking, resume, and graph logic.

- [ ] **Step 3: Implement worker hooks**

Queue:

- seeking report generation
- graph refresh

- [ ] **Step 4: Run integration tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_inbox_seeking_graph_api.py -q
```

Expected: API slice passes end-to-end integration tests.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/contracts/src/contracts/inbox.py backend/packages/contracts/src/contracts/seeking.py backend/packages/contracts/src/contracts/graph.py backend/packages/core/src/core/inbox backend/packages/core/src/core/seeking backend/packages/core/src/core/graph backend/packages/db/src/db/models/inbox_item.py backend/packages/db/src/db/models/seeking_report.py backend/packages/db/src/db/models/keyword_node.py backend/packages/db/src/db/models/keyword_edge.py backend/apps/api/app/routers/inbox.py backend/apps/api/app/routers/seeking.py backend/apps/api/app/routers/graph.py backend/apps/api/app/routers/resume.py backend/tests/integration/test_inbox_seeking_graph_api.py
git commit -m "feat: implement inbox seeking resume and graph backend slices"
```

---

### Task 11: Implement AI provider layer, coach, and screening APIs

**Files:**
- Create: `backend/packages/contracts/src/contracts/coach.py`
- Create: `backend/packages/contracts/src/contracts/screening.py`
- Create: `backend/packages/ai/src/ai/providers/router.py`
- Create: `backend/packages/ai/src/ai/prompts/*.py`
- Create: `backend/packages/ai/src/ai/workflows/coach.py`
- Create: `backend/packages/ai/src/ai/workflows/screening.py`
- Create: `backend/packages/ai/src/ai/streaming/sse.py`
- Create: `backend/apps/api/app/routers/coach.py`
- Create: `backend/apps/api/app/routers/screening.py`
- Create: `backend/tests/integration/test_ai_streaming_api.py`

- [ ] **Step 1: Write failing streaming/API tests**

Cover:

- coach request validation
- screening request validation
- stream response contract shape

- [ ] **Step 2: Implement AI router and prompt modules**

Move prompt ownership out of `src/lib/ai/prompts/**` into Python prompt modules.

- [ ] **Step 3: Implement coach and screening workflows**

Keep message persistence and prompt assembly in backend services.

- [ ] **Step 4: Implement streaming API routers**

Use SSE or streaming responses with typed event structure.

- [ ] **Step 5: Run AI integration tests**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_ai_streaming_api.py -q
```

Expected: stream endpoints satisfy contract tests without frontend coupling.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/contracts/src/contracts/coach.py backend/packages/contracts/src/contracts/screening.py backend/packages/ai/src/ai backend/apps/api/app/routers/coach.py backend/apps/api/app/routers/screening.py backend/tests/integration/test_ai_streaming_api.py
git commit -m "feat: implement ai provider layer coach and screening apis"
```

---

### Task 12: Implement Python seed pipeline and demo fixtures

**Files:**
- Create: `backend/apps/cli/app/commands/seed.py`
- Create: `backend/packages/core/src/core/seed/*.py`
- Create: `backend/tests/integration/test_seed_pipeline.py`
- Modify: `README.md`

- [ ] **Step 1: Write failing seed integration test**

Cover:

- user creation
- profile creation
- jobs creation
- graph/report/demo fixture creation

- [ ] **Step 2: Implement seed command**

Add CLI commands such as:

```bash
uv run python -m apps.cli.app.main seed
uv run python -m apps.cli.app.main seed --reset
```

- [ ] **Step 3: Run seed test**

Run:

```bash
cd backend
uv run pytest backend/tests/integration/test_seed_pipeline.py -q
```

Expected: seed command produces the expected demo dataset.

- [ ] **Step 4: Update README**

Document the new seed flow and remove old `npm run seed` guidance.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/cli/app/commands/seed.py backend/packages/core/src/core/seed README.md backend/tests/integration/test_seed_pipeline.py
git commit -m "feat: implement python seed pipeline"
```

---

### Task 13: Refactor frontend auth and API access

**Files:**
- Create: `src/lib/api/client.ts`
- Create: `src/lib/session/current-user.ts`
- Modify: `src/lib/api/inbox.ts`
- Modify: `src/lib/api/seeking.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/middleware.ts`
- Delete: `src/lib/auth/index.ts`
- Delete: `src/lib/auth/middleware.ts`
- Delete: `src/app/api/v1/auth/login/route.ts`

- [ ] **Step 1: Write failing frontend contract tests**

Add tests around:

- login form posting to backend
- session fetch
- authenticated API client behavior

- [ ] **Step 2: Implement backend-backed frontend API client**

Create a shared fetch wrapper that:

- uses same-origin `/api`
- sends credentials
- normalizes API errors

- [ ] **Step 3: Remove frontend-side JWT logic**

Replace middleware/session logic with backend session checks only.

- [ ] **Step 4: Run targeted frontend tests**

Run:

```bash
npm run test -- src/lib/api/__tests__ src/lib/auth/__tests__
```

Expected: updated frontend tests pass without local JWT verification.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/client.ts src/lib/session/current-user.ts src/lib/api/inbox.ts src/lib/api/seeking.ts src/app/(auth)/login/page.tsx src/middleware.ts
git rm src/lib/auth/index.ts src/lib/auth/middleware.ts src/app/api/v1/auth/login/route.ts
git commit -m "refactor: move frontend auth and api access to backend clients"
```

---

### Task 14: Refactor frontend feature pages off direct backend imports

**Files:**
- Modify: `src/app/(talent)/talent/home/page.tsx`
- Modify: `src/app/(talent)/talent/seeking/page.tsx`
- Modify: `src/app/(talent)/talent/fair/page.tsx`
- Modify: `src/app/(talent)/talent/coach/page.tsx`
- Modify: `src/app/(enterprise)/enterprise/dashboard/page.tsx`
- Modify: `src/app/(enterprise)/enterprise/jobs/page.tsx`
- Modify: `src/app/(enterprise)/enterprise/screening/page.tsx`
- Modify: `src/app/(enterprise)/enterprise/inbox/page.tsx`
- Modify: `src/app/(talent)/talent/inbox/page.tsx`

- [ ] **Step 1: Write or update page-level tests**

Ensure each page can render from mocked API clients instead of DB/auth imports.

- [ ] **Step 2: Remove `drizzle-orm`, DB, and auth imports from pages**

Move all page data loading to frontend API wrappers.

- [ ] **Step 3: Run targeted frontend tests**

Run:

```bash
npm run test -- src/app/(talent)/talent src/app/(enterprise)/enterprise
```

Expected: pages render against mocked API clients only.

- [ ] **Step 4: Commit**

```bash
git add src/app/(talent)/talent src/app/(enterprise)/enterprise
git commit -m "refactor: remove direct backend imports from frontend pages"
```

---

### Task 15: Delete the old TypeScript backend runtime

**Files:**
- Delete: `src/app/api/internal/**`
- Delete: `src/app/api/v1/**`
- Delete: `src/lib/db/**`
- Delete: `src/lib/jobs/**`
- Delete: backend-owned `src/lib/ai/**`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `ecosystem.config.js`

- [ ] **Step 1: Remove dead runtime files**

Delete the old backend directories once the Python replacements are verified and the git archive tag/branch exists.

- [ ] **Step 2: Update frontend package scripts**

Keep only frontend-relevant scripts in the root `package.json`.

- [ ] **Step 3: Update process management docs**

Replace PM2 Node worker guidance with the new compose/backend process model.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run typecheck
npm run test
cd backend && uv run pytest
cd backend && docker compose config
```

Expected: frontend and backend verify independently with no TypeScript backend runtime left.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md ecosystem.config.js
git rm -r src/app/api src/lib/db src/lib/jobs
git commit -m "refactor: remove legacy typescript backend runtime"
```

---

### Task 16: Add MCP app and CLI parity over the Python backend

**Files:**
- Create: `backend/apps/cli/app/main.py`
- Create: `backend/apps/mcp/app/main.py`
- Create: `backend/apps/mcp/app/tools/*.py`
- Create: `backend/tests/contract/test_cli_contract.py`
- Create: `backend/tests/contract/test_mcp_contract.py`

- [ ] **Step 1: Write failing contract tests**

Cover:

- CLI command wiring
- MCP tool registration
- backend API interaction shape

- [ ] **Step 2: Implement thin adapters**

Keep them thin and backend-facing rather than DB-facing.

- [ ] **Step 3: Run contract tests**

Run:

```bash
cd backend
uv run pytest backend/tests/contract -q
```

Expected: CLI and MCP satisfy their thin-adapter contract tests.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/cli/app/main.py backend/apps/mcp/app backend/tests/contract
git commit -m "feat: add cli and mcp adapters over python backend"
```

---

### Task 17: Final deployment verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `docs/plans/2026-03-31-python-backend-cutover-checklist.md`

- [ ] **Step 1: Write deployment checklist**

Document:

- compose startup
- migrations
- seed
- health checks
- smoke endpoints
- rollback approach
- legacy archive tag/branch reference

- [ ] **Step 2: Update shared instructions**

Add backend development expectations to `AGENTS.md`.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm run typecheck
npm run test
cd backend && uv run pytest
cd backend && docker compose up -d
curl -I http://localhost:3000
curl http://localhost:8000/api/v1/health
```

Expected: both apps boot and respond correctly.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md docs/plans/2026-03-31-python-backend-cutover-checklist.md
git commit -m "docs: finalize python backend deployment guidance"
```

---

## Deletion Checklist

- [ ] Remove `src/app/api/internal/**`
- [ ] Remove `src/app/api/v1/**`
- [ ] Remove `src/lib/db/**`
- [ ] Remove `src/lib/jobs/**`
- [ ] Remove backend-owned `src/lib/ai/**`
- [ ] Remove backend auth ownership from `src/lib/auth/**`
- [ ] Remove old Node deployment assumptions from `README.md` and `ecosystem.config.js`

---

## Verification Checklist

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `cd backend && uv run pytest`
- [ ] `cd backend && docker compose config`
- [ ] `cd backend && docker compose up -d`
- [ ] backend health endpoint responds
- [ ] frontend renders using backend APIs only
- [ ] seed pipeline runs in Python
- [ ] worker processes a real queued job

---

Plan complete and saved to `docs/plans/2026-03-31-python-backend-replatform-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
