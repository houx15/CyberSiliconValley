# Project Instructions

> Cyber Silicon Valley (CSV) — An AI-native talent-matching platform where AI companions work alongside users 24/7, connecting AI talent with enterprises through conversational onboarding, capability portraits, and intelligent matching.

## Key Documents

Read these before starting any implementation work:

1. **Product Requirements**: `docs/PRD.md` — Full product spec, page inventory, design principles
2. **Technical Architecture**: `docs/technical-architecture.md` — Tech stack, project structure, data models, API design
3. **Web Visual Identity** (reference only): `docs/WebsiteUI.md` — "Calm Functionalism" design system. If it conflicts with PRD or technical architecture, follow those instead.

## Development Environment

- **No local PostgreSQL or backend** — do not attempt to run the backend locally
- **Deployment server**: `ssh yuxin@47.93.151.131` (Aliyun ECS)
  - Pull the backend codebase on this server and run it there
  - PostgreSQL runs on this server
- **Frontend**: can be developed and previewed locally

## Guidelines

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- Drizzle ORM for database, pgvector for embeddings
- Vercel AI SDK for LLM integration
- Follow the project structure defined in `docs/technical-architecture.md`

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
