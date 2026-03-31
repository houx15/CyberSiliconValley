# CSV — Cyber Silicon Valley

AI-native talent matching platform.

## Current Product Surface

The repo now covers the core web flows for both sides of the marketplace:

- Public marketing and auth flows
- Talent onboarding, portrait, matches, seeking report, and shared inbox
- Enterprise dashboard, talent discovery, role management, and shared inbox
- AI-assisted resume tailoring, pre-chat preparation, and report-generation worker hooks

Spec planning lives in `docs/superpowers/plans/`, and specs `0-5` are implemented in the frontend codebase.

## Local Development

```bash
npm install
cp .env.example .env    # edit with your API keys
npm run dev              # starts on http://localhost:3000
```

This starts the Next.js frontend only.

### Full Stack Development

The new Python backend stack lives under `backend/` and is the preferred way to run the full system locally:

```bash
cd backend
docker compose up --build
```

That compose stack brings up:

- `frontend`
- `backend`
- `worker`
- `postgres`
- `redis`

The backend service is intentionally wired to the future `/api/v1/health` endpoint and will become fully healthy once the Python API routes land in the next tasks.

### Frontend Pages Added Recently

- Talent seeking report: `/talent/seeking`
- Talent inbox: `/talent/inbox`
- Enterprise inbox: `/enterprise/inbox`

These pages have mock/demo fallbacks in the frontend, but their live data paths depend on the API routes, Redis-backed jobs, and PostgreSQL-backed application data described below.

### Commands

```bash
npm run dev          # dev server (no turbopack)
npm run build        # production build
npm run typecheck    # TypeScript check
npm run test         # run unit tests
npm run check        # lint + typecheck + test (all three)
```

## Deploy to Dev Server

The platform currently runs on the Aliyun ECS server; the frontend remains Next.js/Node-based, and the backend is being replatformed to Python under `backend/`.

Important constraints for this repo:

- Do not attempt to stand up PostgreSQL locally for normal feature work
- Build and preview the frontend locally
- Run DB-backed flows, workers, and end-to-end verification against the ECS environment
- Redis-dependent jobs may log connection warnings during local builds if Redis is not running

```
ssh yuxin@YOUR_SERVER_IP
```

### First-Time Server Setup

Run these once on the server:

#### 1. Install system dependencies

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16
sudo apt-get install -y postgresql-16 postgresql-16-pgvector

# Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server

# PM2
sudo npm install -g pm2

# Nginx
sudo apt-get install -y nginx
```

#### 2. Set up PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER csvuser WITH PASSWORD 'your-secure-password';
CREATE DATABASE csv OWNER csvuser;
\c csv
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

#### 3. Clone the repo

```bash
cd ~
git clone <your-repo-url> csv
cd csv
npm install
```

#### 4. Create .env

```bash
cp .env.example .env
```

Edit `.env` with real values:

```bash
DATABASE_URL=postgresql://csvuser:your-secure-password@localhost:5432/csv
REDIS_URL=redis://localhost:6379
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
JWT_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_APP_URL=http://YOUR_SERVER_IP:3000
NODE_ENV=production
```

#### 5. Run database migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Then add the pgvector columns (drizzle doesn't support the vector type natively):

```bash
sudo -u postgres psql -d csv -c "
ALTER TABLE talent_profiles ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_talent_embedding ON talent_profiles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops);
"
```

#### 6. Seed demo accounts

```bash
npm run seed:users
```

This creates 5 accounts (password: `csv2026`):
- `talent1@csv.dev`, `talent2@csv.dev`, `talent3@csv.dev`
- `enterprise1@csv.dev`, `enterprise2@csv.dev`

#### 7. Build and start

```bash
npm run build
pm2 start ecosystem.config.js
```

Check it's running:

```bash
pm2 status
curl http://localhost:3000
```

#### 8. (Optional) Set up Nginx reverse proxy

Copy the nginx config:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/csv
sudo ln -s /etc/nginx/sites-available/csv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Edit `nginx.conf` to replace `csv.yourdomain.com` with your actual domain. For dev without a domain, you can access directly via `http://YOUR_SERVER_IP:3000`.

### Subsequent Deploys

After the first-time setup, deploy updates with:

```bash
ssh yuxin@YOUR_SERVER_IP
cd ~/csv
./scripts/deploy.sh
```

Or manually:

```bash
git pull
npm install
npm run build
npx drizzle-kit migrate   # only if schema changed
pm2 restart all
```

### Verifying the Deploy

```bash
# Check processes
pm2 status

# Check logs
pm2 logs csv-web --lines 20
pm2 logs csv-worker --lines 20

# Test login API
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"talent1@csv.dev","password":"csv2026"}'
```

Expected: JSON response with `{"user":{"id":"...","email":"talent1@csv.dev","role":"talent"}}` and a `Set-Cookie` header.

### Troubleshooting

**"Cannot connect to database"**: Check `DATABASE_URL` in `.env`. Verify PostgreSQL is running: `sudo systemctl status postgresql`

**"Redis connection refused"**: Check `REDIS_URL` in `.env`. Verify Redis is running: `sudo systemctl status redis-server`

**"Port 3000 already in use"**: Kill existing process: `pm2 kill` then restart.

**Build fails with type errors**: Run `npm run typecheck` to see the specific errors.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/login/       # Login page
│   ├── (talent)/talent/    # Talent-side pages
│   ├── (enterprise)/enterprise/  # Enterprise-side pages
│   └── api/v1/             # REST API endpoints
├── components/
│   ├── layout/             # Sidebar nav, companion bar
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── ai/                 # LLM providers, prompts, chat utilities
│   ├── auth/               # JWT, password hashing, middleware
│   ├── db/                 # Drizzle ORM schema, connection
│   └── jobs/               # BullMQ queues and workers
├── i18n/                   # Bilingual strings (en + zh)
└── types/                  # Shared TypeScript types
```

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| talent1@csv.dev | csv2026 | Talent |
| talent2@csv.dev | csv2026 | Talent |
| talent3@csv.dev | csv2026 | Talent |
| enterprise1@csv.dev | csv2026 | Enterprise |
| enterprise2@csv.dev | csv2026 | Enterprise |
