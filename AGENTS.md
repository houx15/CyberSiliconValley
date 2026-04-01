# Project Instructions

> Cyber Silicon Valley (CSV) — An AI-native talent-matching platform where AI companions work alongside users 24/7, connecting AI talent with enterprises through conversational onboarding, capability portraits, and intelligent matching.

## Key Documents

Read these before starting any implementation work:

1. **Product Requirements**: `docs/PRD.md` — Full product spec, page inventory, design principles
2. **Technical Architecture**: `docs/technical-architecture.md` — Tech stack, project structure, data models, API design
3. **Web Visual Identity** (reference only): `docs/WebsiteUI.md` — "Calm Functionalism" design system. If it conflicts with PRD or technical architecture, follow those instead.

Historical planning and legacy architecture material lives under `docs/archive/`. Do not use archived docs as the source of truth for current implementation work.

## Development Environment

- **Frontend**: Next.js in `src/`
- **Backend**: Python workspace in `backend/`
  - `backend/apps/api` = FastAPI
  - `backend/apps/worker` = worker
  - `backend/apps/cli` = CLI
  - `backend/apps/mcp` = MCP server
- **Primary local workflow**: run frontend with `npm` and backend with `uv`
- **Deployment server**: Aliyun ECS
  - PostgreSQL and Redis run on that server
  - Production deploy is a split stack: Next.js on `3000`, FastAPI on `8000`, worker as a separate process

## Guidelines

- Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui for the frontend
- FastAPI + SQLAlchemy + Alembic + Redis + arq + uv for the backend
- pgvector remains in PostgreSQL for embeddings
- Follow the project structure defined in `docs/technical-architecture.md`

## Backend Rewrite Rules

- Do not add backend behavior to `src/app/api/**` or revive deleted Next.js API routes
- Do not add direct database access back into the frontend under `src/**`
- Frontend data access should go through backend HTTP clients in `src/lib/api/**`
- Keep deployment instructions free of server-specific secrets, IPs, or credentials
- If new operational guidance or cutover notes are needed, write them in `README.md`, `backend/README.md`, or `docs/plans/*`. Archive obsolete plans under `docs/archive/`.

## Shared Memory

**Always write new instructions, rules, and memory to `AGENTS.md` only.**

Never modify `CLAUDE.md` or `GEMINI.md` directly - they only import `AGENTS.md`.
This ensures Claude Code, Codex CLI, and Gemini CLI share the same context consistently.

## Project Structure

- `.claude/agents/` - Custom subagents for specialized tasks
- `.claude/skills/` - Claude Code skills (slash commands)
- `.claude/rules/` - Modular rules auto-loaded into context
- `.codex/skills/` - Codex CLI skills
- `.codex/prompts/` - Codex CLI custom slash commands
- `.gemini/skills/` - Gemini CLI skills
- `.gemini/commands/` - Gemini CLI custom slash commands (TOML)
- `.mcp.json` - MCP server configuration
