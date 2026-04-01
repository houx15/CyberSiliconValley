# CSV MVP — Technical Architecture Document

## Purpose

This document provides the technical decisions and architecture for building the CSV MVP. It is designed to be consumed by Claude Code (or any AI coding agent) as the primary reference for implementation.

**Scope**: Big-picture technology choices, project structure, data models, API design, and integration patterns. Not a line-by-line implementation guide.

**Builder**: Solo developer + Claude Code. Every decision optimizes for: minimal moving parts, fast iteration, one person can debug everything.

---

## 1. Technology Stack

### Frontend + Backend (Monorepo)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 (App Router)** | Fullstack in one repo. Server Components for fast loads. Server Actions for mutations. API routes for the CLI/MCP layer. Streaming support for AI chat UX. |
| Language | **TypeScript** | End-to-end type safety. Shared types between frontend and backend. |
| Styling | **Tailwind CSS 4 + Framer Motion** | Tailwind for rapid UI. Framer Motion is critical — the fog-clearing onboarding, skill graph animations, and keyword graph transitions all require a capable animation library. |
| UI Components | **shadcn/ui** | Copy-paste components, no dependency lock-in. Accessible, customizable, works perfectly with Tailwind. |
| State Management | **React Context + Zustand** | Context for auth/user state. Zustand for complex client state (keyword graph, chat sessions). No Redux. |

### Database

| Layer | Choice | Why |
|-------|--------|-----|
| Primary DB | **PostgreSQL (self-hosted)** | Reliable, battle-tested. pgvector extension for embedding search (skill matching, semantic job search). |
| ORM | **Drizzle ORM** | Type-safe, lightweight, SQL-close. Better DX than Prisma for a solo dev — less magic, more control. Excellent migration tooling. |
| Vector Search | **pgvector** | Embeddings stored in Postgres directly. No separate vector DB needed for MVP scale. Cosine similarity search for talent-job matching. |

### AI / LLM Layer

| Layer | Choice | Why |
|-------|--------|-----|
| LLM Abstraction | **Vercel AI SDK (ai package)** | Unified interface across providers. Streaming out of the box. Tool calling support. Works natively with Next.js server components and route handlers. |
| Primary LLM | **Claude (Anthropic API)** | Best for long-context conversations (onboarding, coaching). Best tool calling for agent features. |
| Secondary LLM | **DeepSeek / Qwen** | Cost-effective for batch operations (scanning job matches, generating summaries). Better China latency. |
| Embedding Model | **Text-embedding-3-small (OpenAI) or BAAI/bge (Chinese)** | For vectorizing profiles and JDs. Choose based on which gives better Chinese language results in testing. |
| LLM Router | **Custom thin layer** | Simple switch function: route to Claude for conversations, DeepSeek for batch/background tasks. No framework needed — just a provider config map. |

```typescript
// Example LLM router pattern
type TaskType = 'conversation' | 'batch' | 'embedding';

function getProvider(task: TaskType) {
  switch (task) {
    case 'conversation': return anthropic('claude-sonnet-4-20250514');
    case 'batch': return deepseek('deepseek-chat');
    case 'embedding': return openai('text-embedding-3-small');
  }
}
```

### Infrastructure

| Layer | Choice | Why |
|-------|--------|-----|
| Hosting | **Aliyun ECS** | Single server for MVP. Next.js runs as a Node.js process. Simple, debuggable, no serverless cold starts. |
| Process Manager | **PM2** | Keep Next.js alive, auto-restart, log management. |
| Reverse Proxy | **Nginx** | TLS termination, static file serving, proxy to Next.js. |
| Background Jobs | **BullMQ + Redis** | For async tasks: AI scanning, match computation, pre-chat agents. Redis also serves as cache layer. |
| File Storage | **Aliyun OSS** | Resume uploads, profile images. S3-compatible API. |
| Email | **Resend** (or Aliyun DirectMail) | Transactional emails: signup verification, notifications. |

### CLI / Agent Layer

| Layer | Choice | Why |
|-------|--------|-----|
| CLI Tool | **Node.js CLI (published to npm)** | `npx csv-cli` or `npm install -g csv-cli`. Uses the same API as the web frontend. |
| MCP Server | **TypeScript MCP server** | Exposes platform actions as MCP tools. Any MCP-compatible agent (Claude Code, Codex, OpenClaw) can operate CSV. |
| API | **Next.js API routes** | REST endpoints under `/api/v1/`. JWT auth. Same codebase as the web app — no separate backend service. |

---

## 2. Project Structure

```
csv/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth pages (login, signup)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (talent)/                 # Talent-side pages
│   │   │   ├── onboarding/page.tsx   # Fog-clearing onboarding
│   │   │   ├── home/page.tsx         # Capability portrait
│   │   │   ├── coach/page.tsx        # AI coach
│   │   │   ├── seeking/page.tsx      # AI seeking report
│   │   │   ├── fair/page.tsx         # Opportunity fair (keyword graph)
│   │   │   ├── inbox/page.tsx        # Inbox
│   │   │   └── profile/page.tsx      # Profile editor
│   │   ├── (enterprise)/             # Enterprise-side pages
│   │   │   ├── onboarding/page.tsx   # Company recognition + setup
│   │   │   ├── dashboard/page.tsx    # AI workspace home
│   │   │   ├── jobs/                 # Job management
│   │   │   │   ├── new/page.tsx      # JD input + structuring
│   │   │   │   └── [id]/page.tsx     # Job detail + candidates
│   │   │   ├── screening/page.tsx    # AI screening chat
│   │   │   ├── talent/page.tsx       # Talent pool browser
│   │   │   └── inbox/page.tsx        # Enterprise inbox
│   │   ├── api/
│   │   │   ├── v1/                   # Public API (for CLI + MCP)
│   │   │   │   ├── auth/
│   │   │   │   ├── profile/
│   │   │   │   ├── jobs/
│   │   │   │   ├── matches/
│   │   │   │   └── chat/
│   │   │   └── internal/             # Internal API (web app only)
│   │   │       ├── ai/               # AI streaming endpoints
│   │   │       └── upload/           # File uploads
│   │   ├── page.tsx                  # Landing page
│   │   └── layout.tsx                # Root layout
│   ├── components/
│   │   ├── ai/                       # AI-specific components
│   │   │   ├── companion-chat.tsx    # The ever-present AI companion
│   │   │   ├── fog-reveal.tsx        # Fog-clearing profile animation
│   │   │   ├── streaming-text.tsx    # Streaming AI response display
│   │   │   └── keyword-graph.tsx     # Force-directed opportunity graph
│   │   ├── talent/                   # Talent-side components
│   │   ├── enterprise/               # Enterprise-side components
│   │   └── ui/                       # shadcn/ui components
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── providers.ts          # LLM provider configs
│   │   │   ├── router.ts             # Task-based LLM routing
│   │   │   ├── prompts/              # System prompts for each AI feature
│   │   │   │   ├── onboarding.ts
│   │   │   │   ├── coach.ts
│   │   │   │   ├── screening.ts
│   │   │   │   ├── seeking.ts
│   │   │   │   └── jd-parser.ts
│   │   │   └── tools/                # AI tool definitions (function calling)
│   │   │       ├── profile-tools.ts
│   │   │       ├── search-tools.ts
│   │   │       └── match-tools.ts
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle schema definitions
│   │   │   ├── migrations/           # SQL migrations
│   │   │   └── index.ts              # DB connection
│   │   ├── auth/
│   │   │   └── index.ts              # Simple email+password auth, JWT
│   │   ├── matching/
│   │   │   ├── engine.ts             # Core matching algorithm
│   │   │   └── scoring.ts            # Score computation
│   │   └── utils/
│   ├── workers/                      # BullMQ job processors
│   │   ├── scan-matches.ts           # Background job: scan for new matches
│   │   ├── pre-chat.ts               # Background job: AI pre-chat with candidates
│   │   └── generate-report.ts        # Background job: compile seeking reports
│   └── types/
│       └── index.ts                  # Shared type definitions
├── cli/                              # CLI tool (separate package)
│   ├── src/
│   │   ├── index.ts                  # CLI entry point
│   │   ├── commands/                 # CLI commands
│   │   └── api-client.ts             # HTTP client for CSV API
│   └── package.json
├── mcp-server/                       # MCP server (separate package)
│   ├── src/
│   │   ├── index.ts                  # MCP server entry
│   │   └── tools/                    # MCP tool definitions
│   └── package.json
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Data Model

### Core Tables

```sql
-- Users (both talent and enterprise)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('talent', 'enterprise')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Talent profiles
CREATE TABLE talent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name    VARCHAR(255),
  headline        VARCHAR(500),        -- One-line description
  bio             TEXT,                 -- Full bio / intro
  skills          JSONB DEFAULT '[]',   -- [{name, level, category}]
  experience      JSONB DEFAULT '[]',   -- [{company, role, duration, description}]
  education       JSONB DEFAULT '[]',   -- [{school, degree, year}]
  goals           JSONB DEFAULT '{}',   -- {target_roles, preferences, etc}
  availability    VARCHAR(20) DEFAULT 'open', -- open, busy, not_looking
  salary_range    JSONB,                -- {min, max, currency}
  resume_url      VARCHAR(500),         -- Uploaded resume in OSS
  profile_data    JSONB DEFAULT '{}',   -- Flexible storage for AI-extracted data
  embedding       vector(1536),         -- Profile embedding for semantic matching
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enterprise profiles
CREATE TABLE enterprise_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name    VARCHAR(255),
  industry        VARCHAR(100),
  company_size    VARCHAR(50),          -- startup, small, medium, large
  website         VARCHAR(500),
  description     TEXT,                 -- AI-generated company description
  ai_maturity     VARCHAR(50),          -- exploring, adopting, advanced
  profile_data    JSONB DEFAULT '{}',   -- Flexible storage for AI-extracted data
  preferences     JSONB DEFAULT '{}',   -- Hiring preferences, remembered across jobs
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Job postings
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id   UUID REFERENCES enterprise_profiles(id) ON DELETE CASCADE,
  title           VARCHAR(255),
  description     TEXT,                 -- Original JD text
  structured      JSONB NOT NULL,       -- AI-structured requirement
                                        -- {skills: [{name, level, required}],
                                        --  seniority, timeline, deliverables,
                                        --  budget, work_mode, ...}
  status          VARCHAR(20) DEFAULT 'open', -- open, reviewing, filled, closed
  auto_match      BOOLEAN DEFAULT TRUE,
  auto_prechat    BOOLEAN DEFAULT FALSE,
  embedding       vector(1536),         -- JD embedding for semantic matching
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Match results (computed by matching engine)
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  talent_id       UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
  score           FLOAT NOT NULL,       -- Overall match score 0-100
  breakdown       JSONB NOT NULL,       -- Per-dimension scores
                                        -- {skills: {dim: score}, ...}
  status          VARCHAR(20) DEFAULT 'new', -- new, viewed, shortlisted,
                                             -- invited, applied, rejected
  ai_reasoning    TEXT,                 -- AI explanation of match
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, talent_id)
);

-- Chat sessions (onboarding, coaching, screening, etc)
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  session_type    VARCHAR(30) NOT NULL,  -- onboarding, coach, screening,
                                         -- seeking, prechat, mentor
  context         JSONB DEFAULT '{}',    -- Session-specific context
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,  -- user, assistant, system, tool
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',    -- Tool calls, extracted data, etc
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Inbox items
CREATE TABLE inbox_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  item_type       VARCHAR(30) NOT NULL,  -- match_notification, invite,
                                         -- prechat_summary, system
  title           VARCHAR(255),
  content         JSONB NOT NULL,        -- Type-specific content
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- API keys (for CLI / MCP access)
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash        VARCHAR(255) NOT NULL, -- Hashed API key
  key_prefix      VARCHAR(10) NOT NULL,  -- First few chars for identification
  name            VARCHAR(100),
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_talent_embedding ON talent_profiles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_matches_job ON matches(job_id);
CREATE INDEX idx_matches_talent ON matches(talent_id);
CREATE INDEX idx_matches_score ON matches(score DESC);
CREATE INDEX idx_inbox_user ON inbox_items(user_id, read, created_at DESC);
CREATE INDEX idx_chat_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_jobs_status ON jobs(status, created_at DESC);
```

### Design Decisions

**JSONB for flexible fields**: Skills, experience, structured JD data — these all use JSONB instead of normalized tables. For MVP, this is faster to iterate on. Normalize later when schemas stabilize.

**Embeddings in Postgres**: pgvector avoids adding a separate vector DB. At MVP scale (hundreds to low thousands of profiles), pgvector with IVFFlat index is more than sufficient.

**Chat history in DB**: All AI conversations are persisted. This is critical — the onboarding conversation IS the profile creation process, and coaching conversations build context over time.

---

## 4. API Design

### Public API (for CLI + MCP + external agents)

All endpoints require authentication via Bearer token (API key or JWT).

```
Authentication:
  POST   /api/v1/auth/login          # Email + password → JWT
  POST   /api/v1/auth/signup         # Create account

Profile:
  GET    /api/v1/profile              # Get my profile
  PATCH  /api/v1/profile              # Update profile fields
  POST   /api/v1/profile/embedding    # Regenerate profile embedding

Jobs:
  GET    /api/v1/jobs                 # List jobs (with filters)
  GET    /api/v1/jobs/:id             # Get job detail
  POST   /api/v1/jobs                 # Create job (enterprise only)
  PATCH  /api/v1/jobs/:id             # Update job

Matches:
  GET    /api/v1/matches              # My matches (talent: matching jobs;
                                      #              enterprise: matching talent)
  POST   /api/v1/matches/scan         # Trigger match scan
  PATCH  /api/v1/matches/:id          # Update match status (shortlist, apply, etc)

Chat:
  POST   /api/v1/chat                 # Send message, get AI streaming response
  GET    /api/v1/chat/sessions        # List chat sessions
  GET    /api/v1/chat/sessions/:id    # Get session messages

Inbox:
  GET    /api/v1/inbox                # List inbox items
  PATCH  /api/v1/inbox/:id            # Mark as read, respond

Resume:
  POST   /api/v1/resume/generate      # Generate tailored resume for a job
  POST   /api/v1/resume/upload        # Upload resume file
```

### Internal API (web app only, not exposed to CLI)

```
AI Streaming:
  POST   /api/internal/ai/onboarding  # Onboarding conversation (streaming)
  POST   /api/internal/ai/coach       # Coaching conversation (streaming)
  POST   /api/internal/ai/screening   # Enterprise screening chat (streaming)
  POST   /api/internal/ai/jd-parse    # Parse and structure a JD

Upload:
  POST   /api/internal/upload         # File upload to OSS
```

---

## 5. AI Architecture

### Conversation Pattern

All AI conversations follow the same technical pattern:

```
User message
    → Next.js API route (or Server Action)
    → Load conversation history from DB
    → Construct system prompt + history + user message
    → Call LLM via Vercel AI SDK (streaming)
    → Stream response to client
    → On completion: save assistant message to DB
    → On tool call: execute tool, save result, continue
```

### System Prompts (by feature)

Each AI feature has a dedicated system prompt in `src/lib/ai/prompts/`. These define:

- The AI's persona and tone
- What information to extract
- What tools are available
- Output format constraints

| Feature | Prompt File | Key Behavior |
|---------|-------------|-------------|
| Onboarding | `onboarding.ts` | Extract skills, experience, goals through warm conversation. Trigger fog-reveal events. |
| Coach | `coach.ts` | Analyze profile gaps vs target roles. Give specific, actionable advice. |
| Seeking | `seeking.ts` | Scan job listings, evaluate fit, compose pre-chat messages. |
| JD Parser | `jd-parser.ts` | Extract structured requirements from natural language JD. Ask clarifying questions. |
| Screening | `screening.ts` | Search talent pool by natural language query. Explain reasoning. |
| Pre-chat | `prechat.ts` | Represent a talent in initial conversations with enterprises. Stay within bounds. |

### Tool Calling

AI features use tool calling (function calling) to interact with the platform:

```typescript
// Example: Onboarding tools
const onboardingTools = {
  revealProfileField: {
    description: 'Reveal a field in the fog-clearing UI',
    parameters: {
      field: z.enum(['name', 'headline', 'skills', 'experience',
                      'education', 'goals', 'skill_graph']),
      value: z.any(),
    },
    execute: async ({ field, value }) => {
      // Send SSE event to trigger fog-clearing animation on client
      // Save extracted data to profile
    }
  },
  addSkillTag: {
    description: 'Add a confirmed skill to the profile',
    parameters: {
      name: z.string(),
      level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
      category: z.string(),
    }
  },
  completeOnboarding: {
    description: 'Mark onboarding as complete, transition to home',
    parameters: {}
  }
};
```

### Matching Engine

The matching engine combines vector similarity with structured comparison:

```
1. Semantic match (pgvector):
   - Compute cosine similarity between talent embedding and job embedding
   - This captures "vibe match" — similar language, similar domain

2. Feature match (structured):
   - For each required skill in the job:
     - Check if talent has the skill
     - Compare proficiency levels
     - Weight by must-have vs nice-to-have
   - Check availability, timeline, salary range

3. Combined score:
   - weighted_score = 0.4 * semantic_score + 0.6 * feature_score
   - Store breakdown in matches.breakdown

4. AI reasoning (async):
   - For top N matches, call LLM to generate natural language explanation
   - "Strong match because their RAG pipeline project directly mirrors
      your requirement. Gap: no team lead experience."
```

### Background Jobs

BullMQ workers handle async AI tasks:

| Job | Trigger | What It Does |
|-----|---------|-------------|
| `scan-matches` | New job posted, or scheduled daily | Compute match scores for all relevant talent-job pairs |
| `pre-chat` | Enterprise enables auto pre-chat | AI initiates conversation with high-match candidates |
| `generate-report` | Scheduled daily | Compile AI seeking report for each talent user |
| `parse-company` | Enterprise onboarding | Web search for company info, generate company profile |
| `embed-profile` | Profile updated | Regenerate embedding vector |
| `embed-job` | Job posted or updated | Regenerate embedding vector |

---

## 6. Key UX Implementation Notes

### Fog-Clearing Onboarding

Technical approach:

1. Client renders a full profile layout, but every section is covered by a CSS blur/opacity overlay
2. AI conversation happens via streaming API
3. When AI calls the `revealProfileField` tool, the server sends a custom SSE event
4. Client receives the event and triggers a Framer Motion animation on the corresponding section:
   - Blur reduces from `blur(20px)` to `blur(0)`
   - Opacity goes from 0 to 1
   - A gentle scale-up from 0.95 to 1.0
   - Content fades in with a slight delay after the blur clears
5. Each section reveals independently, creating a progressive unfolding effect

### Keyword Graph (Opportunity Fair)

Technical approach:

1. Data structure: nodes (keywords) + edges (co-occurrence) + child nodes (companies inside keywords)
2. Render with **D3.js force simulation** inside a React component
3. Node size = number of opportunities for that keyword
4. Edge weight = frequency of co-occurrence in job listings
5. User interactions:
   - Click keyword node → zoom in, show company nodes inside
   - Click company node → open detail panel (slide-in from right)
   - Pinch/scroll to zoom → reveal/hide keyword connections
   - Drag to pan
6. User's own skill keywords are highlighted (different color/glow)
7. Data updates in real-time as new jobs are posted

### AI Companion Persistence

The AI companion (chat interface) persists across all talent-side pages:

- Rendered as a collapsible panel at the top of every page
- Collapsed by default (shows one-line status: "3 new matches found")
- Click to expand into full chat interface
- Chat context is maintained across pages (same session)
- Server-side: session ID stored in cookie, history loaded from DB

### Streaming AI Responses

All AI chat interfaces use the Vercel AI SDK streaming pattern:

```typescript
// Server: API route
export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
  const history = await loadChatHistory(sessionId);

  const result = streamText({
    model: getProvider('conversation'),
    system: getSystemPrompt('onboarding'),
    messages: [...history, ...messages],
    tools: onboardingTools,
    onFinish: async (result) => {
      await saveChatMessages(sessionId, messages, result);
    }
  });

  return result.toDataStreamResponse();
}

// Client: React component
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/internal/ai/onboarding',
  body: { sessionId },
});
```

---

## 7. Auth (MVP Simplified)

For MVP, authentication is deliberately minimal:

### Predefined Accounts

Seed the database with test accounts on deployment:

```
Talent accounts:
  talent1@csv.dev / csv2026  (role: talent)
  talent2@csv.dev / csv2026  (role: talent)
  talent3@csv.dev / csv2026  (role: talent)

Enterprise accounts:
  enterprise1@csv.dev / csv2026  (role: enterprise)
  enterprise2@csv.dev / csv2026  (role: enterprise)
```

### Implementation

- Simple email + password login
- Passwords hashed with bcrypt
- JWT tokens (stored in httpOnly cookies)
- Middleware checks JWT on protected routes
- No signup flow in MVP (use predefined accounts)
- No email verification, no password reset
- No OAuth (WeChat, Google — deferred to post-MVP)

---

## 8. Deployment

### Single Server Setup (Aliyun ECS)

```
Aliyun ECS instance (4 vCPU, 8GB RAM recommended)
├── Nginx (reverse proxy, TLS)
├── Node.js (Next.js app via PM2)
├── PostgreSQL (with pgvector extension)
├── Redis (for BullMQ job queue + cache)
└── Aliyun OSS (file storage, separate service)
```

### Deployment Steps

```bash
# On the ECS instance:
1. Install: Node.js 20+, PostgreSQL 16 + pgvector, Redis, Nginx, PM2
2. Clone repo, install dependencies
3. Set environment variables (see below)
4. Run database migrations: npx drizzle-kit migrate
5. Seed predefined accounts: node scripts/seed.ts
6. Build: npm run build
7. Start: pm2 start ecosystem.config.js
8. Configure Nginx reverse proxy to localhost:3000
9. Set up TLS certificate (Let's Encrypt or Aliyun cert)
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/csv

# Redis
REDIS_URL=redis://localhost:6379

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...          # For embeddings

# File Storage
ALIYUN_OSS_ENDPOINT=...
ALIYUN_OSS_BUCKET=csv-uploads
ALIYUN_OSS_ACCESS_KEY=...
ALIYUN_OSS_SECRET_KEY=...

# Auth
JWT_SECRET=<random-256-bit-string>

# App
NEXT_PUBLIC_APP_URL=https://csv.yourdomain.com
NODE_ENV=production
```

---

## 9. CLI Tool

### Package Structure

The CLI is a separate npm package within the monorepo (`cli/` directory).

### Core Commands

```bash
csv login                          # Authenticate with email + password
csv profile view                   # Display current profile
csv profile update --skills "..."  # Update profile fields
csv profile status open|busy       # Set availability

csv matches scan                   # Trigger match scan, show results
csv matches list                   # List current matches with scores
csv matches detail <id>            # Show match details + AI reasoning

csv apply <job-id>                 # Express interest in a job
csv apply <job-id> --resume        # Generate tailored resume + apply

csv inbox list                     # Show inbox items
csv inbox read <id>                # View inbox item detail

csv status                         # Quick overview: profile, matches, inbox
```

### MCP Server

The MCP server exposes the same capabilities as tools:

```typescript
// MCP tool definitions
const tools = [
  {
    name: 'csv_profile_view',
    description: 'View the current user profile on CSV platform',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'csv_matches_scan',
    description: 'Scan for new job/project matches and return top results',
    inputSchema: { type: 'object', properties: {
      min_score: { type: 'number', description: 'Minimum match score (0-100)' }
    }}
  },
  {
    name: 'csv_apply',
    description: 'Express interest in a job opportunity',
    inputSchema: { type: 'object', properties: {
      job_id: { type: 'string' },
      generate_resume: { type: 'boolean' },
      note: { type: 'string' }
    }, required: ['job_id'] }
  },
  // ... more tools
];
```

---

## 10. Development Phases

### Phase 1: Foundation (Week 1-2)

Set up project structure, database, auth, basic layouts.

- [ ] Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
- [ ] Set up PostgreSQL with pgvector, Drizzle ORM, migrations
- [ ] Implement simple auth (email + password, JWT, predefined accounts)
- [ ] Create basic layout shells for talent and enterprise sides
- [ ] Set up Vercel AI SDK with Anthropic provider
- [ ] Landing page

### Phase 2: Talent Core (Week 3-4)

The onboarding and home experience.

- [ ] Onboarding: AI conversation flow with streaming
- [ ] Onboarding: fog-clearing profile reveal animation
- [ ] Home: capability portrait / skill graph visualization
- [ ] Home: AI companion (persistent chat interface)
- [ ] Profile editor (manual edit fallback)
- [ ] Public portfolio page

### Phase 3: Enterprise Core (Week 5-6)

Enterprise onboarding and job management.

- [ ] Onboarding: company recognition (web search + AI)
- [ ] Onboarding: intent clarification + requirement input
- [ ] JD input: one-click import + AI structuring
- [ ] Enterprise dashboard (AI workspace home)

### Phase 4: Matching + Screening (Week 7-8)

The core transaction layer.

- [ ] Embedding generation for profiles and jobs
- [ ] Matching engine (vector + feature hybrid)
- [ ] Feature matching view (structured screening)
- [ ] AI screening chat (conversational screening)
- [ ] Candidate detail view
- [ ] Match notifications + inbox

### Phase 5: Agent Layer (Week 9-10)

CLI, MCP, and background AI.

- [ ] API v1 endpoints
- [ ] CLI tool (npm package)
- [ ] MCP server
- [ ] Background jobs: scan-matches, generate-report
- [ ] AI Seeking Report page

### Phase 6: Polish (Week 11-12)

Opportunity fair, coaching, and UX polish.

- [ ] Opportunity Fair keyword graph (D3.js)
- [ ] AI Coach (conversation + suggestions)
- [ ] Tailored resume generation
- [ ] Messaging between talent and enterprise
- [ ] Overall UX polish, animations, edge cases

---

## 11. LLM-Guided Process Engine

Onboarding, JD parsing, coaching sessions, and enterprise setup are NOT free-form chats. They are **structured multi-step processes where the LLM drives the flow**. The LLM knows what information it still needs, asks for it in a natural order, and advances when each step is satisfied.

### Architecture: Process Definition

Each guided process is defined as a typed configuration:

```typescript
interface GuidedProcess {
  id: string;                         // 'talent_onboarding', 'jd_parsing', etc.
  steps: ProcessStep[];               // Ordered information goals
  systemPrompt: string;               // Base persona + instructions
  tools: ToolDefinition[];            // Available tool calls
  completionCheck: (state: ProcessState) => boolean;
}

interface ProcessStep {
  id: string;                         // 'collect_name', 'extract_skills', etc.
  goal: string;                       // What info to collect in this step
  requiredFields: string[];           // Fields that must be filled before advancing
  prompt: string;                     // Step-specific instruction appended to system prompt
  uiEvent?: string;                   // Client-side event to trigger (e.g., fog reveal)
}

interface ProcessState {
  currentStep: number;
  collectedData: Record<string, any>; // What's been extracted so far
  pendingFields: string[];            // What's still missing
  conversationHistory: Message[];
}
```

### Example: Talent Onboarding Process

```typescript
const talentOnboarding: GuidedProcess = {
  id: 'talent_onboarding',
  steps: [
    {
      id: 'greeting',
      goal: 'Introduce yourself, offer entry paths (resume upload, link, or conversation)',
      requiredFields: ['entry_method'],
      prompt: 'Warmly greet the user. Offer them ways to get started.',
      uiEvent: 'show_entry_options'
    },
    {
      id: 'identity',
      goal: 'Learn name, current role/status, one-line self-description',
      requiredFields: ['display_name', 'headline'],
      prompt: 'Find out who they are. Get their name and what they do.',
      uiEvent: 'reveal_name_headline'
    },
    {
      id: 'skills',
      goal: 'Extract specific AI tools and technical skills with proficiency levels',
      requiredFields: ['skills'],
      prompt: 'Dig into their technical skills. Be specific — tool-level, not category-level.',
      uiEvent: 'reveal_skills'
    },
    {
      id: 'experience',
      goal: 'Extract work/project experience, especially AI-related delivery',
      requiredFields: ['experience'],
      prompt: 'Learn about their experience. Focus on what they built and delivered.',
      uiEvent: 'reveal_experience'
    },
    {
      id: 'goals',
      goal: 'Understand career goals, what kind of work they want, availability',
      requiredFields: ['goals', 'availability'],
      prompt: 'Understand what they are looking for. Roles, project types, timeline.',
      uiEvent: 'reveal_goals'
    },
    {
      id: 'completion',
      goal: 'Summarize the profile, confirm accuracy, transition to home',
      requiredFields: [],
      prompt: 'Summarize what you have learned. Ask if anything is missing. Complete onboarding.',
      uiEvent: 'reveal_full_graph'
    }
  ],
};
```

### Runtime Flow

```
1. Client sends user message → /api/internal/ai/guided
   Body: { processId, sessionId, userMessage }

2. Server loads:
   - Process definition (steps, tools, prompts)
   - Current state from DB (which step, what's collected)
   - Conversation history

3. Server constructs the LLM call:
   System prompt = base persona
                 + process context ("You are on step 3 of 6")
                 + current step instructions
                 + collected data so far
                 + list of still-needed fields

4. LLM responds (streaming):
   - Conversational response streams to client
   - Tool calls extract structured data → update state
   - UI event tools trigger client-side animations (fog reveal, etc.)

5. After response completes:
   - Check: are this step's requiredFields filled?
   - Yes → advance to next step, update state in DB
   - No → stay on current step (LLM will ask for missing info next turn)
   - Final step complete → mark process as done

6. State persisted in chat_sessions.context (JSONB)
```

### Guided Processes in the MVP

| Process | Steps | Trigger |
|---------|-------|---------|
| Talent onboarding | 6 steps: greeting → identity → skills → experience → goals → completion | First login (talent) |
| Enterprise onboarding | 4 steps: company recognition → intent → requirement → matching setup | First login (enterprise) |
| JD parsing | 3 steps: input → structuring → confirmation | Enterprise posts new job |
| Coaching session | 3 steps: check-in → analysis → action plan | Talent opens coach |
| AI screening | Open-ended but guided: query → results → refinement | Enterprise searches talent |

### Key Design Point

The user experiences a natural conversation. The structure is invisible to them — they just notice that the AI is unusually good at staying on track, never forgets to ask about something important, and always knows what to do next.

---

## 12. Seed Data & Demo Strategy

An empty platform is a dead platform. The MVP must ship with realistic seed data.

### Seed Data Inventory

| Entity | Count | Generation Method |
|--------|-------|-------------------|
| Talent profiles | 50 | LLM-generated with realistic Chinese tech personas |
| Enterprise profiles | 15 | Based on real company types (anonymized) |
| Job postings | 30 | LLM-generated, spread across industries and skill areas |
| Matches | ~200 | Computed by matching engine after profiles + jobs are seeded |
| Inbox items | ~50 | Auto-generated from matches |
| Keyword graph nodes | ~60 | Extracted from job postings + talent skills |

### Seed Script

```bash
node scripts/seed.ts --full       # Generate all seed data
node scripts/seed.ts --users      # Only user accounts
node scripts/seed.ts --profiles   # Only talent/enterprise profiles
node scripts/seed.ts --jobs       # Only job postings
node scripts/seed.ts --matches    # Only compute matches (requires profiles + jobs)
node scripts/seed.ts --reset      # Clear all data and re-seed
```

### Seed Data Principles

**Diversity**: Profiles span different backgrounds (students, engineers, freelancers), skill levels, specializations (NLP, vision, agent, data), and availability states.

**Realism**: LLM generates Chinese names, realistic company descriptions, believable project histories. Not "Test User 1."

**Keyword coverage**: Jobs collectively cover major keyword clusters for the Opportunity Fair: RAG, agent framework, data analysis, computer vision, NLP, prompt engineering, fine-tuning, etc.

**Match variety**: Pre-computed matches include high (>85%), medium (60-85%), and low (<60%) scores to demonstrate scoring UI.

---

## 13. Harness Engineering

This project is built solo with Claude Code as the primary implementer. The codebase must be designed so that an AI coding agent can operate reliably — understanding the architecture, making changes confidently, and self-verifying its work.

A harness is the infrastructure that governs how the agent operates: the documentation it reads, the constraints that keep it on track, the feedback loops that catch errors, and the conventions that make patterns replicable. Without a harness, an AI agent will drift, introduce inconsistencies, and produce code that slowly degrades.

### 13.1 AGENTS.md — The Agent's Map

The root `AGENTS.md` is the entry point for any AI agent. It is deliberately short (~100 lines) and serves as a table of contents, not an encyclopedia.

```markdown
# AGENTS.md

## Project
CSV (Cyber Silicon Valley) — AI-native talent matching platform.
Next.js 15 App Router + TypeScript + Tailwind + PostgreSQL + Drizzle ORM.

## Quick Start
npm install && npm run dev       # Start dev server on :3000
npm run db:migrate               # Run database migrations
npm run db:seed                  # Seed demo data
npm run check                    # Lint + typecheck + test (run after every change)

## Architecture Map
See docs/architecture.md for the full system diagram.
- src/app/(talent)/    — Talent-side pages
- src/app/(enterprise)/ — Enterprise-side pages
- src/app/api/v1/      — Public REST API (CLI + MCP)
- src/app/api/internal/ — Internal API (web only)
- src/lib/ai/          — LLM providers, prompts, guided process engine
- src/lib/db/          — Drizzle schema, migrations, queries
- src/lib/matching/    — Matching engine
- src/workers/         — BullMQ background jobs
- cli/                 — CLI tool (separate package)
- mcp-server/          — MCP server (separate package)

## Key Patterns (do not deviate)
- AI features use the Guided Process Engine (docs/guided-process.md)
- LLM calls go through src/lib/ai/router.ts — never call providers directly
- DB access goes through src/lib/db/queries/ — no raw SQL in pages
- API routes validate input with Zod schemas
- UI animations use Framer Motion

## Conventions
- Files: kebab-case. Components: PascalCase. Functions: camelCase. DB: snake_case.
- One component per file. Server Components by default.
- All API routes follow the standard try/catch + Zod pattern (see docs/api.md)
- All user-facing strings support zh-CN

## Docs (read before working on a module)
- docs/architecture.md      — System map and data flow
- docs/guided-process.md    — LLM-guided process engine
- docs/data-model.md        — Database schema reference
- docs/api.md               — API endpoint reference
- docs/prompts.md           — System prompt design
- docs/quality.md           — Module quality grades
```

### 13.2 Structured Documentation (docs/)

The `docs/` directory is the single source of truth for the AI agent. Each doc is focused, cross-linked, and updated in the same PR as the code it describes.

```
docs/
├── architecture.md          # System architecture: what talks to what
├── guided-process.md        # The guided process engine
├── data-model.md            # Every table, every column, with explanations
├── api.md                   # Every endpoint: method, path, request/response schema
├── prompts.md               # System prompt design principles
├── seed-data.md             # Seed data inventory and generation
├── deployment.md            # Aliyun ECS deployment runbook
├── quality.md               # Module quality grades (see below)
└── decisions/               # Architecture Decision Records
    ├── 001-nextjs-monorepo.md
    ├── 002-drizzle-over-prisma.md
    ├── 003-pgvector-not-pinecone.md
    ├── 004-guided-process-engine.md
    └── ...
```

### 13.3 Architecture Decision Records (ADRs)

Every significant technical decision gets a short ADR in `docs/decisions/`. This gives the AI agent the "why" behind decisions, so it doesn't accidentally undo them or choose conflicting approaches.

```markdown
# ADR-001: Next.js Monorepo
## Status: Accepted
## Context: Solo developer building MVP. Need fullstack in one repo.
## Decision: Use Next.js 15 App Router for frontend + backend.
## Consequences: One deploy, one process. Cannot easily swap framework (acceptable).
```

### 13.4 Quality Tracking (docs/quality.md)

A living document grading each module. Tells the agent where to be careful and where to move fast.

```markdown
| Module | Tests | Types | Error Handling | Docs | Grade |
|--------|-------|-------|----------------|------|-------|
| Auth | ✅ | ✅ | ✅ | ✅ | A |
| Guided Process Engine | ✅ | ✅ | ⚠️ | ✅ | B+ |
| Matching Engine | ⚠️ | ✅ | ✅ | ✅ | B |
| Onboarding UI | ❌ | ✅ | ⚠️ | ⚠️ | C+ |
| Keyword Graph | ❌ | ⚠️ | ❌ | ❌ | D |
```

### 13.5 Automated Feedback Loop

The primary feedback loop for the AI agent: **run `npm run check` after every change.**

```json
{
  "scripts": {
    "check": "npm run lint && npm run typecheck && npm run test",
    "lint": "eslint src/ --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

Enforced rules:
- **ESLint**: no `any` types (except explicitly marked), no unused variables, no console.log in production, import order
- **TypeScript**: strict mode, no implicit any
- **Vitest**: tests on critical paths (matching engine, guided process engine, API routes)

If `npm run check` passes, the change is good. If it fails, fix before moving on. This is the single most important element of the harness.

### 13.6 Test Strategy

Not everything needs tests in MVP. Critical paths do:

| Layer | What to Test | Tool |
|-------|-------------|------|
| Guided Process Engine | Step transitions, field extraction, completion | Vitest |
| Matching Engine | Score computation, ranking, edge cases | Vitest |
| API Routes | Validation, auth, response shapes | Vitest + supertest |
| LLM Integration | Tool call handling with mocked providers | Vitest |

**Not tested in MVP**: Static pages, simple CRUD, CSS, layout.

### 13.7 Prompts as Code

System prompts are treated as versioned, reviewable, testable code:

```
src/lib/ai/prompts/
├── _base.ts              # Shared persona, tone, language
├── onboarding.ts         # Talent onboarding prompt + tools + test fixtures
├── enterprise-onboarding.ts
├── coach.ts
├── screening.ts
├── seeking.ts
├── jd-parser.ts
└── prechat.ts
```

Each file exports: the system prompt string, available tools for that context, and test fixtures (example inputs + expected tool calls).

### 13.8 Standardized Patterns

Every API route follows the same skeleton. The agent can replicate it mechanically:

```typescript
// Standard API route pattern — replicate for every endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);  // Zod validation
    // ... business logic
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Unhandled error:', error);
    return Response.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

### 13.9 Convention Enforcement

Machine-enforceable rules reduce drift:

- **Data flow**: Pages → Server Components fetch data → pass props to Client Components. Mutations → Server Actions or API routes. DB access → only through `src/lib/db/queries/`.
- **AI integration**: LLM calls → only through `src/lib/ai/router.ts`. Tools → only in `src/lib/ai/tools/`. Prompts → only in `src/lib/ai/prompts/`.
- **File naming**: `kebab-case.ts` for files, `PascalCase` for components, `camelCase` for functions, `snake_case` for DB columns.

### 13.10 What Makes This Harness Work

| Element | Purpose |
|---------|---------|
| `AGENTS.md` | Entry point. Short map. Agent reads this first. |
| `docs/` directory | Deep context when the agent needs to understand a module. |
| ADRs | "Why" behind decisions — prevents the agent from undoing them. |
| `quality.md` | Where to be careful, where to move fast. |
| `npm run check` | The feedback loop. Pass = done. Fail = fix. |
| Test suite | Catches regressions on critical paths. |
| Prompts as code | AI behavior changes are reviewable diffs. |
| Standardized patterns | Every API route, every DB query follows the same shape. |
| ESLint + strict TS | Automated drift detection. |

The goal: a Claude Code agent reading `AGENTS.md` can understand the codebase, make a change, verify it with `npm run check`, and move on — reliably, repeatedly.

---

## 14. Key Technical Risks

| Risk | Mitigation |
|------|-----------|
| AI conversation quality | Invest in system prompts first. Test with real profiles. Iterate prompts before building UI. |
| Guided process edge cases | What if user goes off-topic? Partial info? Build robust step-transition logic with fallbacks. |
| Keyword graph performance | Limit to 50-100 keyword nodes. Lazy-load company nodes on zoom. |
| China latency for Anthropic API | Use DeepSeek/Qwen for batch tasks. Consider China proxy for Claude. |
| pgvector at small scale | Use exact search (no index) at <100 profiles. IVFFlat at 500+. |
| Agent-built code drift | Harness engineering: lint, typecheck, test on every change. Quality doc tracks health. |
| Solo dev bottleneck | Phase 1-4 is the real MVP. Ship after Phase 4 if needed. |
| Seed data feels fake | LLM-generate realistic Chinese personas. Manual review. |

---

*CSV MVP Technical Architecture — v1. Designed for solo dev + Claude Code, with harness engineering for reliable AI-driven development. Ship fast, iterate faster.*
