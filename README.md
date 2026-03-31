# CSV — Cyber Silicon Valley

CSV is now a split-stack product:

- `src/` = React/Next.js frontend only
- `backend/` = FastAPI API, worker, CLI, and MCP apps
- PostgreSQL = system of record
- Redis = queue, cache, and worker coordination

The old TypeScript backend has been retired. Its archive reference is the git tag `archive/ts-backend-pre-python-rewrite`.

## Product Surface

- Public marketing and auth flows
- Talent onboarding, portrait, matches, seeking report, inbox, and coach
- Enterprise onboarding, dashboard, jobs, inbox, and AI screening
- Python worker hooks for matching, reports, graph refresh, and chat-style async work

## Repository Layout

```text
src/                     Next.js frontend
backend/apps/api         FastAPI app
backend/apps/worker      arq worker
backend/apps/cli         operator CLI
backend/apps/mcp         MCP server
backend/packages/*       shared Python contracts, db, core, ai, redis
docs/plans/              rewrite and cutover plans
```

## Local Development

### Frontend only

```bash
npm install
cp .env.example .env
npm run dev
```

This starts the frontend on `http://localhost:3000`.

### Full stack with `uv`

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn csv_api.main:app --reload --host 0.0.0.0 --port 8000
```

In another shell:

```bash
cd backend
uv run python -m csv_worker.main
```

Then seed demo data if you want a populated local stack:

```bash
cd backend
uv run python -m apps.cli.app.main seed --reset
```

### Full stack with Docker Compose

```bash
cd backend
docker compose up --build
```

This brings up:

- `frontend`
- `api`
- `worker`
- `postgres`
- `redis`

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run check
npm run backend:sync
npm run backend:test
npm run backend:migrate
npm run seed
npm run seed:reset
```

## Backend Deployment From Scratch

This is the recommended deployment shape for a single ECS host:

- Next.js frontend on `127.0.0.1:3000`
- FastAPI backend on `127.0.0.1:8000`
- Python worker as a separate PM2 process
- PostgreSQL and Redis on the same machine
- Nginx routing `/` to Next and `/api/` to FastAPI on one public origin

### 1. Install system dependencies

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.12 + uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# PostgreSQL + pgvector
sudo apt-get install -y postgresql postgresql-contrib

# Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# PM2 + Nginx
sudo npm install -g pm2
sudo apt-get install -y nginx
```

If your distro provides a separate `pgvector` package, install that as well.

### 2. Create the database

```bash
sudo -u postgres psql
```

```sql
CREATE USER csv WITH PASSWORD 'change-this-password';
CREATE DATABASE csv OWNER csv;
\c csv
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 3. Clone and install

```bash
cd ~/apps
git clone <your-repo-url> CyberSiliconValley
cd CyberSiliconValley
git checkout main
npm install
cd backend
uv sync
cd ..
```

### 4. Create environment files

Frontend:

```bash
cp .env.example .env
```

Set:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.example.com
```

Backend:

```bash
cd backend
cp .env.example .env
```

Set:

```bash
DATABASE_URL=postgresql+psycopg://csv:change-this-password@localhost:5432/csv
REDIS_URL=redis://localhost:6379/0
APP_ENV=production
APP_SECRET=$(openssl rand -hex 32)
COOKIE_DOMAIN=your-domain.example.com
FRONTEND_ORIGIN=https://your-domain.example.com
AI_PROTOCOL=anthropic
AI_BASE_URL=
AI_MODEL=claude-sonnet-4-20250514
AI_API_KEY=...
```

### 5. Run migrations

```bash
cd backend
uv run alembic upgrade head
```

### 6. Seed the demo dataset

```bash
cd backend
uv run python -m apps.cli.app.main seed --reset
```

This creates:

- 5 fixed demo login accounts
- seeded talent and enterprise profiles
- jobs and matches
- inbox fixtures
- seeking reports
- keyword graph fixtures

Fixed demo accounts use password `csv2026`:

- `talent1@csv.dev`
- `talent2@csv.dev`
- `talent3@csv.dev`
- `enterprise1@csv.dev`
- `enterprise2@csv.dev`

### 7. Build the frontend

```bash
npm run build
```

### 8. Start processes with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
```

Expected processes:

- `csv-web`
- `csv-api`
- `csv-worker`

### 9. Configure Nginx

Copy the provided config and edit the domain names and TLS certificate paths:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/csv
sudo ln -sf /etc/nginx/sites-available/csv /etc/nginx/sites-enabled/csv
sudo nginx -t
sudo systemctl reload nginx
```

The important routing rule is:

- `/` -> `127.0.0.1:3000`
- `/api/` -> `127.0.0.1:8000/api/`

### 10. Smoke test the deployment

```bash
pm2 status
pm2 logs csv-web --lines 20
pm2 logs csv-api --lines 20
pm2 logs csv-worker --lines 20

curl -I http://127.0.0.1:3000
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/ready
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"talent1@csv.dev","password":"csv2026"}'
```

If Nginx is live, also verify the public origin:

```bash
curl -I https://your-domain.example.com
curl https://your-domain.example.com/api/v1/health
```

## Subsequent Deploys

Use the deploy script:

```bash
./scripts/deploy.sh
```

Manual equivalent:

```bash
git pull origin main
npm install
cd backend
uv sync
uv run alembic upgrade head
cd ..
npm run build
pm2 restart ecosystem.config.js
```

## Rollback Notes

- Keep the previous deployment directory until the new stack passes smoke tests.
- The legacy TypeScript backend reference is `archive/ts-backend-pre-python-rewrite`.
- Treat that archive as a code reference, not a schema-compatible hot rollback once the Python migrations and seed reset have been applied.
- If a fresh deploy fails before cutover, restore the previous app directory and PM2 processes instead of mixing runtimes.

## More Detail

- Backend workspace guide: `backend/README.md`
- Cutover checklist: `docs/plans/2026-03-31-python-backend-cutover-checklist.md`
- Rewrite design: `docs/plans/2026-03-31-python-backend-replatform-design.md`

Expected: JSON response with `{"user":{"id":"...","email":"talent1@csv.dev","role":"talent"}}` and a `Set-Cookie` header.

### Troubleshooting

**"Cannot connect to database"**: Check `DATABASE_URL` in `.env`. Verify PostgreSQL is running: `sudo systemctl status postgresql`

**"Redis connection refused"**: Check `REDIS_URL` in `.env`. Verify Redis is running: `sudo systemctl status redis-server`

**"Port 3000 already in use"**: Kill existing process: `pm2 kill` then restart.

**Build fails with type errors**: Run `npm run typecheck` to see the specific errors.

**Backend health check fails**: Run `cd backend && uv run pytest tests/integration/test_health.py -q`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/login/       # Login page
│   ├── (talent)/talent/    # Talent-side pages
│   ├── (enterprise)/enterprise/  # Enterprise-side pages
├── components/
│   ├── layout/             # Sidebar nav, companion bar
│   └── ui/                 # shadcn/ui components
├── lib/api/                # Frontend HTTP and SSE clients
├── i18n/                   # Bilingual strings (en + zh)
└── types/                  # Shared TypeScript types

backend/
├── apps/api/               # FastAPI application
├── apps/worker/            # arq worker
├── apps/cli/               # Python CLI
└── packages/               # contracts, db, core, ai, redis
```

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| talent1@csv.dev | csv2026 | Talent |
| talent2@csv.dev | csv2026 | Talent |
| talent3@csv.dev | csv2026 | Talent |
| enterprise1@csv.dev | csv2026 | Enterprise |
| enterprise2@csv.dev | csv2026 | Enterprise |

These are created by the Python seed command:

```bash
cd backend
uv run python -m apps.cli.app.main seed
```
