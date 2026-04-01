# Python Backend Cutover Checklist

This checklist is for the final server redeploy after the rewrite is merged to `main`.

## Reference Points

- Active stack: Next.js frontend in `src/` + Python backend in `backend/`
- Legacy backend archive tag: `archive/ts-backend-pre-python-rewrite`
- Deploy target: one ECS host with PostgreSQL, Redis, Next.js, FastAPI, worker, and Nginx

## Preflight

- Confirm PostgreSQL is running
- Confirm Redis is running
- Confirm Node.js, Python 3.12+, `uv`, PM2, and Nginx are installed
- Keep the previous app directory available until smoke tests pass
- Keep untracked server-only env files outside git

## Fresh Deploy

### 1. Pull the merged code

```bash
cd ~/apps/CyberSiliconValley
git fetch origin
git checkout main
git pull --ff-only origin main
```

### 2. Install dependencies

```bash
npm install
cd backend
uv sync
cd ..
```

### 3. Create or update environment files

Frontend `.env`:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.example.com
NODE_ENV=production
```

Backend `backend/.env`:

```bash
DATABASE_URL=postgresql+psycopg://csv:password@localhost:5432/csv
REDIS_URL=redis://localhost:6379/0
APP_ENV=production
APP_SECRET=...
COOKIE_DOMAIN=your-domain.example.com
FRONTEND_ORIGIN=https://your-domain.example.com
AI_PROTOCOL=anthropic
AI_BASE_URL=
AI_MODEL=claude-sonnet-4-20250514
AI_API_KEY=...
```

### 4. Migrate the database

```bash
cd backend
uv run alembic upgrade head
```

### 5. Seed the demo data if this is a fresh environment

```bash
cd backend
uv run python -m apps.cli.app.main seed --reset
```

### 6. Build the frontend

```bash
cd ~/apps/CyberSiliconValley
npm run build
```

### 7. Start the processes

```bash
pm2 start ecosystem.config.js
pm2 save
```

Expected PM2 apps:

- `csv-web`
- `csv-api`
- `csv-worker`

### 8. Enable reverse proxy

- `/` should proxy to `127.0.0.1:3000`
- `/api/` should proxy to `127.0.0.1:8000/api/`

Use the repo `nginx.conf` as the template.

## Health Checks

Run all of these before considering the cutover done:

```bash
pm2 status
pm2 logs csv-web --lines 30
pm2 logs csv-api --lines 30
pm2 logs csv-worker --lines 30

curl -I http://127.0.0.1:3000
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/ready
curl https://your-domain.example.com/api/v1/health
```

Authentication smoke test:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"talent1@csv.dev","password":"csv2026"}'
```

## Product Smoke Flows

- Log in as a talent user
- Open `/talent`
- Open `/talent/matches`
- Open `/talent/inbox`
- Open `/talent/seeking`
- Open `/talent/coach`
- Log in as an enterprise user
- Open `/enterprise`
- Open `/enterprise/jobs`
- Open `/enterprise/inbox`
- Open `/enterprise/fair`

## Worker Checks

- Publish or update a job and confirm the worker remains healthy
- Verify no crash loop in `pm2 logs csv-worker`
- If using seeded data only, confirm the worker process starts cleanly and remains idle

## Rollback Guidance

- If the new deploy fails before traffic switch, stop the new PM2 processes and keep the old deployment directory active
- If you need code reference for the old backend, use `archive/ts-backend-pre-python-rewrite`
- Do not mix the archived TypeScript backend runtime with the new Python-migrated database state
- If you need to inspect the old code, do it in a separate checkout or worktree
