# CSV MVP — Full Platform Design Spec

## Overview

Cyber Silicon Valley (CSV) is an AI-native talent-matching platform. This spec covers the complete MVP: 8 specs decomposed as a foundation layer + 7 feature slices, designed for subagent-driven parallel development.

**Product vision**: AI companions work alongside users 24/7, connecting AI talent with enterprises through conversational onboarding, capability portraits, and intelligent matching.

**MVP target**: A fully functional two-sided platform with simplified auth (predefined accounts). Not a throwaway demo — production-grade architecture that transitions directly to a real product.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Decomposition | Hybrid: foundation layer + parallel feature slices | Foundation establishes patterns, features can parallelize after |
| LLM Provider | Single provider via Vercel AI SDK (Anthropic or OpenAI protocol) | Simplicity; supports both protocols for flexibility |
| Guided Process Engine | Prompt-driven step logic, not typed abstraction | Less infrastructure code, same user experience |
| Background Jobs | BullMQ + Redis | "AI is always working" feeling requires real background processing |
| Localization | Bilingual (zh-CN + en) from day one | next-intl, AI detects/matches user language |
| AI Companion | Context-aware sessions (separate threads per feature) | Prevents context bleed between onboarding, coaching, seeking |
| Responsiveness | Desktop-only for MVP | Saves significant layout work |
| CLI + MCP Server | Deferred to post-MVP | No one uses CLI for a demo; API routes still exist for background jobs |
| Docs infrastructure | Skip quality.md, ADRs, etc. for MVP | PRD + tech architecture doc are sufficient |
| Visual signature | Both fog-clearing onboarding AND keyword graph are must-haves | Visual memorability is critical for differentiation |

---

## Spec Dependency Graph

```
Spec 0: Foundation
       ↓
  ┌────┼────┐
  ↓    ↓    ↓
Spec 1  Spec 2  Spec 3
(Talent  (Talent  (Enterprise
Onboard) Home)   Onboard+Dash)
  └────┼────┘
       ↓
   Spec 4: Matching + Screening
       ↓
  ┌────┴────┐
  ↓         ↓
Spec 5    Spec 6
(Seeking  (Fair +
+ Inbox)  Coach)
  └────┬────┘
       ↓
Spec 7: Seed Data + Polish
```

**Parallelism**: Specs 1, 2, 3 can run in parallel. Spec 4 can start after Foundation (uses test fixtures for profiles/jobs) but should integrate with Spec 2's capability portrait component and Spec 3's job data. Specs 5 and 6 can run in parallel. Spec 0 and Spec 7 are sequential gates.

---

## Spec 0: Foundation

Everything else depends on this. Establishes the project skeleton, database, auth, AI infrastructure, layout shells, background job infrastructure, and deployment config.

### Project Setup

- Next.js 15 App Router, TypeScript strict mode, Tailwind CSS 4
- shadcn/ui installed with base components: Button, Input, Card, Dialog, Sheet, Tabs, Avatar, Badge, Skeleton
- Framer Motion for animations
- `next-intl` for i18n (zh-CN + en), locale detection from browser
- Vitest + ESLint, `npm run check` script (lint + typecheck + test)
- Monorepo structure as defined in technical architecture doc, minus `cli/` and `mcp-server/`

### Database

- PostgreSQL with pgvector extension
- Full Drizzle ORM schema covering all tables:
  - `users` — both talent and enterprise, role column
  - `talent_profiles` — display_name, headline, bio, skills (JSONB), experience (JSONB), education (JSONB), goals (JSONB), availability, salary_range, resume_url, profile_data, embedding (vector 1536), onboarding_done
  - `enterprise_profiles` — company_name, industry, company_size, website, description, ai_maturity, profile_data, preferences, onboarding_done
  - `jobs` — title, description, structured (JSONB), status, auto_match, auto_prechat, embedding (vector 1536)
  - `matches` — job_id, talent_id, score, breakdown (JSONB), status, ai_reasoning
  - `chat_sessions` — user_id, session_type, context (JSONB)
  - `chat_messages` — session_id, role, content, metadata (JSONB)
  - `inbox_items` — user_id, item_type, title, content (JSONB), read
  - `api_keys` — user_id, key_hash, key_prefix, name, last_used_at
  - `seeking_reports` (new) — talent_id, report_data (JSONB), generated_at
  - `keyword_nodes` (new) — keyword, job_count, trending
  - `keyword_edges` (new) — source_id, target_id, weight
- All indexes from technical architecture doc
- Migration scripts via `drizzle-kit`
- DB connection module with connection pooling

### Auth

- Predefined accounts seeded on deploy:
  - talent1@csv.dev / csv2026 (talent)
  - talent2@csv.dev / csv2026 (talent)
  - talent3@csv.dev / csv2026 (talent)
  - enterprise1@csv.dev / csv2026 (enterprise)
  - enterprise2@csv.dev / csv2026 (enterprise)
- bcrypt password hashing, JWT in httpOnly cookies
- Next.js middleware checking JWT on protected routes
- Role-based route protection: `(talent)` routes require talent role, `(enterprise)` routes require enterprise role
- Simple login page — pick an account or enter email/password

### AI Infrastructure

- Vercel AI SDK with configurable provider (supports both Anthropic and OpenAI-compatible APIs)
- Single provider config — switch via environment variable (`AI_PROVIDER=anthropic` or `AI_PROVIDER=openai`)
- Reusable streaming chat pattern: API route → load history from DB → construct system prompt + history + user message → stream via AI SDK → save assistant message on completion → handle tool calls
- Chat session CRUD: create session, load history, save messages
- Base system prompt module (`src/lib/ai/prompts/_base.ts`) with shared persona, tone, bilingual instruction ("Respond in the language the user writes in")
- No guided process engine abstraction — each feature handles its own step logic via system prompt instructions + tool calls

### AI Companion Component

- `CompanionChat` client component — collapsible panel at top of talent/enterprise layouts
- Collapsed state: one-line status bar with proactive template-driven messages ("You have {n} new matches")
- Expanded state: full chat interface with streaming responses
- Session tabs: switch between context threads (General, Home, Coach, etc.)
- Each tab loads a different `chat_session` by `session_type`
- Receives `pageContext` prop so the AI knows what page the user is on
- Shared between talent and enterprise layouts (different session types and tools available)

### Layout Shells

- Root layout: locale provider, auth provider, font loading (serif for headings, sans-serif for body)
- `(auth)` group: minimal layout, no navigation (login page)
- `(talent)` group: sidebar nav (Home, AI Coach, Seeking Report, Opportunity Fair, Inbox) + companion panel
- `(enterprise)` group: sidebar nav (Dashboard, Jobs, Screen Talent, Inbox) + companion panel
- Landing page at root `/` — narrative page type, dark theme, two CTAs ("Find Opportunities" / "Find Talent")

### Background Jobs

- Redis connection module
- BullMQ queue setup with typed job definitions
- Worker runner script (separate process managed by PM2)
- Job types defined with stub workers: `scan-matches`, `generate-report`, `pre-chat`, `embed-profile`, `embed-job`, `update-graph`

### Deployment

- PM2 ecosystem config: Next.js app process + BullMQ worker process
- Nginx config template: reverse proxy to localhost:3000, TLS termination
- `.env.example` with all required environment variables
- Deploy script: `git pull → npm install → npm run build → npx drizzle-kit migrate → npm run seed:users → pm2 restart`
- Server: `ssh yuxin@47.93.151.131` (Aliyun ECS)

---

## Spec 1: Talent Onboarding

The single most important experience in the product — meeting your AI companion for the first time.

### Screen Flow

**Screen 1: The Awakening**
- Full-screen, cinematic, no navigation/sidebar/header
- AI avatar (abstract circle with gradient) appears with gentle animation
- AI introduces itself with streaming text, character by character
- Dark background, centered content, serif font for AI dialogue

**Screen 2: Entry Paths**
- AI offers four ways to start, presented as conversational choices (not a form):
  - Upload a resume (PDF/image)
  - Link a personal page (GitHub, LinkedIn, personal site)
  - Just introduce yourself in conversation
  - Send a voice message
- All paths converge to the same structured profile result

**Screen 3+4: Conversational Discovery + Fog-Clearing Reveal**
- Split screen layout:
  - Left: ongoing AI conversation with quick-select chips for common tools/skills
  - Right: profile panel with all sections starting blurred/fogged
- As AI confirms each piece of information, the corresponding section on the right reveals:
  1. Name appears
  2. Role/title crystallizes
  3. Skill tags emerge one by one
  4. Experience sections reveal
  5. Goals and preferences become visible
  6. Skill graph renders
- Each reveal is tied to a specific AI tool call in the conversation

**Screen 5: Guided Tour**
- After onboarding completes, brief overlay tour highlighting the 4 talent spaces
- Step-through with Framer Motion transitions
- On completion, land on `/talent/home`

### Technical Design

**Route**: `/talent/onboarding` — full-screen, no layout shell. Redirects to `/talent/home` when complete. Redirects already-onboarded users to `/talent/home`.

**AI Endpoint**: `POST /api/internal/ai/onboarding`

**System Prompt Approach (no guided process engine)**:
- System prompt contains all 6 step instructions: greeting → identity → skills → experience → goals → completion
- Prompt includes: "Here is what you've collected so far: {collected_data}. Here is what you still need: {missing_fields}. Follow the phase order naturally, but let the conversation flow."
- State tracked in `chat_sessions.context` JSONB — a bag of collected fields
- LLM decides when to advance phases based on what's been collected

**Tool Calls**:
- `revealProfileField(field: string, value: any)` — triggers fog-clearing animation on client, saves extracted data to profile
- `addSkillTag(name: string, level: 'beginner'|'intermediate'|'advanced'|'expert', category: string)` — adds a skill tag with entrance animation
- `completeOnboarding()` — marks `talent_profiles.onboarding_done = true`, triggers guided tour

**Fog-Clearing Animation (Framer Motion)**:
- Profile panel renders all sections, each wrapped in a `motion.div` with `filter: blur(20px)` + `opacity: 0`
- On `revealProfileField` tool call, animate: blur 20→0, opacity 0→1, scale 0.95→1.0
- Duration: 600ms with spring easing
- Each section reveals independently with slight stagger
- Skill tags animate in one-by-one with 100ms stagger when skills section reveals

**Entry Path Handling**:
- Resume upload: `POST /api/internal/upload` to Aliyun OSS, then AI extracts text via LLM, populates fields
- URL link: AI uses a tool call to indicate a URL was provided, server fetches + extracts profile data via LLM
- Conversation: direct Q&A, AI extracts structured data from dialogue
- Voice: browser Web Speech API for speech-to-text, feed transcription to AI as text message

---

## Spec 2: Talent Home + Profile

The user's daily landing page — their professional identity on CSV.

### Capability Portrait

- Route: `/talent/home` (default landing after login/onboarding)
- Skills grouped into clusters by category from `talent_profiles.skills` JSONB
- Each cluster: bordered container with category label + skill tags inside
- Tag visual weight (opacity, background color intensity) reflects proficiency level:
  - Expert: full opacity, strong color
  - Advanced: 80% opacity
  - Intermediate: 60% opacity
  - Beginner: 40% opacity
- Cluster size reflects number of skills in the category
- Pure CSS/Tailwind — no chart library needed
- Subtle Framer Motion entrance animation on first load (staggered fade-in)

### Profile Header

- Avatar (first character of name), display name, headline
- Availability badge (Open / Busy / Not looking) with color coding
- "Last updated" timestamp
- Edit Profile button → links to `/talent/profile`

### Experience Section

- Card list of work experiences from `talent_profiles.experience` JSONB
- Each card: role, company, date range, description
- Ordered by date descending

### AI Companion Panel

- Rendered in the `(talent)` layout shell, appears on every talent page
- **Collapsed** (default): one-line status bar — "You have {n} new matches and {n} company invites. Click to chat →"
- **Expanded**: full chat interface with streaming
- Session tabs: General, Home, Coach (switch between `chat_session` types)
- Proactive status messages on page load: fetch latest inbox count + match count, display via template strings (not AI-generated per page load)
- Full AI responses only when user opens chat and sends a message

### Profile Editor

- Route: `/talent/profile`
- Traditional form-based editor as fallback to AI conversation
- Editable sections: name, headline, bio, skills (add/remove/reorder), experience (add/edit/delete entries), education, goals (target roles, work preferences), availability, salary range
- Changes save via Server Action → update `talent_profiles`
- After save, queue `embed-profile` background job to regenerate embedding

---

## Spec 3: Enterprise Onboarding + Dashboard

### Enterprise Onboarding

**Route**: `/enterprise/onboarding` — full-screen, no layout shell (same pattern as talent onboarding). Redirects to `/enterprise/dashboard` when complete.

**AI Endpoint**: `POST /api/internal/ai/enterprise-onboarding`

**4 Steps in System Prompt**:

1. **Company Recognition**: User provides company name or URL. AI generates a plausible company summary from its training data (no actual web scraping for MVP). Presents summary, user confirms or corrects.
2. **Intent Clarification**: AI asks what brings them to CSV — recruit for a role, find project delivery, or explore talent pool. Presented as conversational choices.
3. **Requirement Input**: For recruitment/project: user pastes JD text, links a URL, or describes needs in conversation. AI extracts and structures the requirement.
4. **Matching Setup**: Quick preferences — auto-match (yes/no), auto pre-screen (yes/no), hard deal-breakers. Then transitions to dashboard.

**Tool Calls**:
- `setCompanyProfile(data)` — saves to `enterprise_profiles`
- `createJob(structured_requirement)` — creates first job posting from conversation
- `completeOnboarding()` — marks done, redirects to dashboard

### Enterprise Dashboard

**Route**: `/enterprise/dashboard` (default landing for enterprise users)

**AI Activity Status Bar**:
- Top of page, real-time feel via polling every 30 seconds
- Shows: profiles scanned, matches found, pre-chat activity
- Green pulse dot + status text

**Active Jobs**:
- List of all posted jobs with: title, posted date, match count, shortlisted count, status badge (Open/Reviewing/Filled/Closed)
- Click → `/enterprise/jobs/[id]` (candidate view)

**Quick Actions**:
- Post a new job → `/enterprise/jobs/new`
- Screen talent → `/enterprise/screening`
- Review AI picks → scrolls to recommendations

### JD Input + Auto-Structuring

**Route**: `/enterprise/jobs/new`

**Input Modes**:
- Paste JD text
- Link JD URL
- Describe in conversation

**AI Endpoint**: `POST /api/internal/ai/jd-parse`

**Structured Output (editable card)**:
- Role/project title (auto-generated)
- Required skills as tags with toggle: must-have vs nice-to-have
- Seniority level: Junior / Mid / Senior / Lead
- Timeline: start date, duration
- Deliverables (for projects)
- Budget range (suggested by AI based on market data from training)
- Work mode: Remote / Onsite / Hybrid

**On Publish**: save to `jobs` table → queue `embed-job` → queue `scan-matches`

---

## Spec 4: Matching + Screening

The core transaction layer — connecting talent with opportunities.

### Matching Engine (`src/lib/matching/`)

**`engine.ts`** — orchestration:
1. For a given job, query pgvector for top 50 talent profiles by embedding cosine similarity (semantic match)
2. For each candidate, run feature scoring
3. Combine: `0.4 * semantic_score + 0.6 * feature_score` → 0-100 scale
4. Store results in `matches` table with per-dimension breakdown in `breakdown` JSONB
5. For top 10 matches, queue AI reasoning generation

**`scoring.ts`** — feature match algorithm:
- For each required skill in `jobs.structured.skills`:
  - Check if talent has the skill (fuzzy name match — LLM-normalized skill names from seed)
  - Compare proficiency levels (expert matching expert = 1.0, expert matching advanced = 0.8, etc.)
  - Must-have skills weighted 2x vs nice-to-have
- Additional factors: availability match, seniority match
- Produce per-dimension scores in breakdown JSONB

**Embedding Generation**:
- Use the configured LLM provider's embedding endpoint
- Embedding dimension: 1536 (OpenAI text-embedding-3-small default). If using a different model, update the `vector(1536)` column definition in schema accordingly.
- Profile embedding: concatenate display_name + headline + skills (names) + experience (descriptions) into text block, embed
- Job embedding: concatenate title + description + structured skills into text block, embed
- Triggered as BullMQ jobs (`embed-profile`, `embed-job`) on create/update

### Feature Matching View

**Route**: `/enterprise/jobs/[id]`

- Job header: title, posted date, match count, status, Edit JD button, "AI Screen →" button
- Ranked candidate table:
  - Columns: Candidate (name + current role), Overall Score, per-skill dimension columns (from job's required skills), Availability, Status
  - Color-coded dots: green (high match), yellow (medium), red (low/missing)
  - Must-have skills marked with ✱
  - Click row → opens candidate detail Sheet
- Sort by: overall score, specific dimension, availability
- Filter by: hard constraints, score threshold

### AI Screening Chat

**Route**: `/enterprise/screening`

**AI Endpoint**: `POST /api/internal/ai/screening`

**System Prompt**: "You are an AI recruiter. You have access to the talent pool. Search and compare candidates based on the enterprise's needs."

**Tools**:
- `searchTalent(query: string, filters?: object)` — queries pgvector + structured filters against talent_profiles, returns ranked results
- `compareCandidates(talent_ids: string[], dimensions: string[])` — side-by-side comparison
- `shortlistCandidate(talent_id: string, job_id: string)` — adds to shortlist, updates match status

**UX**: Full-page chat interface. AI responses include inline action chips (View profile, Compare all, Shortlist). AI explains its reasoning.

### Candidate Detail View

- shadcn Sheet component (slide-in panel from right, not a separate route)
- Left side: full profile — capability portrait (same component as talent home), experience list
  - Skill tags that match the job requirement are marked with ✓ and highlighted green
- Right side: match analysis
  - Large match score (count-up animation)
  - AI-generated compatibility analysis text
  - Action buttons: Send Invite, Add to Shortlist, Ask AI to Pre-chat
- Send Invite → creates `inbox_items` entry for the talent user (type: `invite`)

### Background Job: `scan-matches`

- Trigger: new job published, or daily scheduled cron
- For each open job: find top 50 talent by embedding similarity → run feature scoring → upsert matches
- For top 10 matches per job: queue AI reasoning generation (LLM call with talent profile + job details → natural language explanation)
- Create `inbox_items` for new high-score matches (>80%) on both talent and enterprise sides

---

## Spec 5: AI Seeking Report + Inbox

### AI Seeking Report

**Route**: `/talent/seeking`

**Data Flow**:
- Background job `generate-report` runs daily (BullMQ scheduled)
- For each talent: query `matches` table for recent matches, group by score tier
- For top matches: generate AI assessment (LLM call with talent profile + job details)
- Store as JSONB document in `seeking_reports` table
- Page loads latest report from DB — no real-time LLM generation on page view

**Report Sections**:

1. **Scan Summary**: "Scanned {n} new postings this week. Found {n} high matches (>80%), {n} medium matches (60-80%)."

2. **High Matches**: Expandable cards for each match:
   - Job title, company, location, work mode
   - Match score (prominent)
   - Skill match tags (green ✓ / red ✗)
   - AI assessment text ("Strong fit because... Potential concern because...")
   - Action buttons: Generate Tailored Resume, Apply, Dismiss

3. **Pre-chat Activity**: Summaries of AI pre-chats conducted on the user's behalf (if any)
   - Company name, chat summary text, action buttons

4. **Inbound Interest**: Companies that found the user's profile
   - Company name, why interested, match score, View button

### Tailored Resume Generation

**Endpoint**: `POST /api/v1/resume/generate` with `{talent_id, job_id}`

- LLM call: system prompt instructs AI to rewrite the talent's profile text, emphasizing skills and experience that match this specific job's requirements
- Output: markdown resume text
- Rendered on client as styled HTML preview with download option (HTML download, not PDF for MVP)

### Pre-chat (Background Job)

- Triggered when enterprise enables `auto_prechat` for a job
- For each high-match talent on that job: AI generates a simulated pre-chat summary
- For MVP: LLM produces a plausible conversation summary from profile + job data (not an actual multi-turn agent conversation)
- Summary stored in `inbox_items` with `item_type: 'prechat_summary'`

### Inbox

**Routes**: `/talent/inbox` and `/enterprise/inbox`

**Shared `InboxList` Component**:
- Filter tabs by `item_type`: All, Invites, Pre-chats, Matches, System
- Each item: color-coded left border by type (blue for invites, purple for inbound, gray for system), title, timestamp, match score where relevant
- Unread indicator: blue dot based on `read` boolean
- Click → detail view (content varies by `item_type`)
- Mark as read on click via `PATCH /api/v1/inbox/:id`
- Badge count on nav sidebar for unread items

---

## Spec 6: Opportunity Fair + AI Coach

### Opportunity Fair — Keyword Graph

**Route**: `/talent/fair`

**Rendering**: D3.js force simulation inside a React client component

**Data Source**: `keyword_nodes` and `keyword_edges` tables

**Graph Behavior**:
- Nodes are keyword pills (rounded rectangle): keyword name + job count
- Node size proportional to `job_count`
- Edges connect frequently co-occurring keywords (from `keyword_edges.weight`)
- User's own skills highlighted: distinct border color + glow effect (match `talent_profiles.skills` against `keyword_nodes.keyword`)
- Trending keywords: green fire indicator based on `keyword_nodes.trending`
- Force simulation: nodes repel, edges attract, user's skills cluster toward center

**Interactions**:
- **Click keyword** → D3 zoom transition into cluster. Load companies from `jobs` table filtered by that keyword's skill. Display as grid of company cards (company name, role title, match score, location).
- **Click company card** → Sheet panel (same pattern as candidate detail) with full job description, match analysis, action buttons (Apply, Save, Ask AI to Pre-chat)
- **Back button** → zoom out to full graph
- **Search input** → jump to keyword node, center and highlight
- **Pan and scroll/pinch zoom** → standard D3 zoom/pan behavior

**Graph Data Bootstrap** (in Spec 7 seed):
- Extract keywords from all `jobs.structured.skills`
- Build `keyword_nodes` with counts
- Build `keyword_edges`: count co-occurrence of skill pairs within the same job
- Cap at 50-80 keyword nodes for performance

**Background Job `update-graph`**:
- Triggered when jobs are created/updated
- Re-compute node job_counts and edge weights
- Set `trending = true` for keywords with >30% posting increase in last 7 days

### AI Coach

**Route**: `/talent/coach`

**AI Endpoint**: `POST /api/internal/ai/coach`

**System Prompt**: "You are a career coach. You know this user's full profile: {profile_json}. You know their target roles: {goals}. You know their recent match landscape: {recent_matches_summary}. Help them become more competitive."

**Four Modes (UI tabs, same component and endpoint)**:
1. **Chat** — open conversation with coach
2. **Resume Review** — system prompt appends: "Focus on reviewing and improving their profile descriptions. Suggest impact-focused rewording."
3. **Mock Interview** — system prompt appends: "Conduct a mock interview for {target_role}. Play the interviewer. After each answer, give feedback."
4. **Skill Gaps** — system prompt appends: "Analyze gaps between their current skills and target roles. Be specific about what to learn and how."

**Coach Tools**:
- `updateProfileField(field: string, value: any)` — coach can directly update the user's profile (user sees the change happen in conversation)
- `suggestSkill(name: string, reason: string)` — suggest a skill to develop with explanation

**UX**: Full-page chat interface below the mode tabs. AI responses include structured elements (gap analysis cards with skill name + status, reworded experience suggestions with before/after). Standard chat input at bottom.

---

## Spec 7: Seed Data + Demo Polish

### Seed Data Inventory

| Entity | Count | Method | Notes |
|--------|-------|--------|-------|
| User accounts | 5 | Hardcoded | 3 talent + 2 enterprise, predefined passwords |
| Talent profiles | 50 | LLM-generated | Chinese names, diverse backgrounds |
| Enterprise profiles | 15 | LLM-generated | Mix of startup/mid/large, various industries |
| Job postings | 30 | LLM-generated | Spread across keyword clusters |
| Embeddings | ~80 | Computed | All profiles + jobs |
| Matches | ~200 | Computed | Mix of high/medium/low scores |
| Keyword graph | ~60 nodes | Extracted | From job skills, edges from co-occurrence |
| Inbox items | ~50 | Generated | Match notifications, invites, pre-chat summaries |
| Seeking reports | 3 | Generated | One per demo talent account |

### Talent Profile Diversity

**By Specialization** (~50 total): NLP/RAG (~12), AI Agent/Framework (~10), Data Analysis/ML (~8), Computer Vision (~6), Prompt Engineering (~5), Fine-tuning/Training (~5), Full-stack+AI (~4)

**By Seniority**: Senior 5+ years (~15), Mid 2-5 years (~20), Junior 0-2 years (~10), Student/Intern (~5)

**By Availability**: Open (~30), Busy/freelance only (~12), Not looking (~8)

**By Background**: Industry engineers (~20), Researchers/PhD (~8), Freelancers (~8), Career changers (~5), Students (~5), Startup founders (~4)

### Seed Script (`scripts/seed.ts`)

- Uses the configured LLM to batch-generate realistic profile data
- Prompt template per entity type: generates structured JSON matching DB schema
- Controlled vocabulary for skill names (normalized across all profiles)
- Run sequence: users → profiles → jobs → embeddings → matches → graph → inbox → reports

**Sub-commands**:
```
npm run seed              # Full seed
npm run seed:users        # Predefined accounts only
npm run seed:profiles     # Generate talent + enterprise profiles
npm run seed:jobs         # Generate job postings
npm run seed:compute      # Compute embeddings + matches + graph
npm run seed:content      # Generate inbox items + seeking reports
npm run seed:reset        # Drop all data + re-seed
```

### Seed Data Quality Rules

- All names are realistic Chinese names (mix of common and less common)
- Companies are plausible but fictional
- Project descriptions are specific and technical — "Built RAG pipeline processing 10K legal docs with 95% retrieval accuracy" not "Worked on AI projects"
- Skill names normalized to controlled vocabulary (same name across all profiles)
- Match scores span full range: some 90+, many 60-80, some below 50
- At least 3 high matches per demo talent account

### Demo Polish

**Empty States**: Simple components with message + CTA
- New talent: onboarding starts immediately (never see empty home)
- No matches yet: "Your AI is scanning the market..." with pulse animation
- Empty inbox: "No messages yet. Your AI companion is working on it."
- No seeking report: "First report generating... check back soon."

**Loading States**:
- AI streaming: typing indicator → character-by-character text reveal
- Page loads: shadcn Skeleton components (shimmer)
- Match computing: progress indication
- Resume generating: loading spinner with cancel option
- Graph rendering: fade-in after force simulation settles

**Animations** (following WebsiteUI rules: 150-300ms, smooth easing, no simultaneous):
- Fog-clearing: blur → clear, 600ms spring
- Page transitions: subtle fade (200ms)
- Companion panel: smooth height expand/collapse (250ms)
- Keyword graph: force simulation settles over 2-3 seconds, nodes fade in
- Skill tags: staggered entrance (100ms per tag)
- Match scores: count-up animation (400ms)

**Landing Page** (`/`):
- Narrative page type (full-screen sections, scroll-driven)
- Dark theme consistent with platform
- Hero: headline + one-line description + two CTAs
- "How it works": 3 steps for talent, 3 steps for enterprise
- Feature highlights with visual previews
- Final CTA section

**End-to-End Flow Testing**:
- Talent path: login → onboarding → home → seeking report → apply
- Enterprise path: login → onboarding → post job → view matches → invite candidate
- Cross-platform: enterprise posts job → matches computed → talent sees in seeking report
- Companion: ask question → get streaming answer on any page
- Coach: get suggestions → apply profile changes

---

## New Tables (additions to tech architecture doc)

```sql
CREATE TABLE seeking_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id    UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
  report_data  JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE keyword_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     VARCHAR(100) UNIQUE NOT NULL,
  job_count   INT DEFAULT 0,
  trending    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE keyword_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID REFERENCES keyword_nodes(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES keyword_nodes(id) ON DELETE CASCADE,
  weight      FLOAT DEFAULT 1.0,
  UNIQUE(source_id, target_id)
);
```

---

## API Endpoints Summary

### Internal API (web app only)

| Method | Path | Used By |
|--------|------|---------|
| POST | `/api/internal/ai/onboarding` | Spec 1 |
| POST | `/api/internal/ai/enterprise-onboarding` | Spec 3 |
| POST | `/api/internal/ai/jd-parse` | Spec 3 |
| POST | `/api/internal/ai/screening` | Spec 4 |
| POST | `/api/internal/ai/coach` | Spec 6 |
| POST | `/api/internal/upload` | Spec 1, 3 |

### Public API (v1)

| Method | Path | Used By |
|--------|------|---------|
| POST | `/api/v1/auth/login` | Spec 0 |
| GET | `/api/v1/profile` | Spec 2 |
| PATCH | `/api/v1/profile` | Spec 2 |
| GET | `/api/v1/jobs` | Spec 3, 4 |
| GET | `/api/v1/jobs/:id` | Spec 4 |
| POST | `/api/v1/jobs` | Spec 3 |
| PATCH | `/api/v1/jobs/:id` | Spec 3 |
| GET | `/api/v1/matches` | Spec 4 |
| POST | `/api/v1/matches/scan` | Spec 4 |
| PATCH | `/api/v1/matches/:id` | Spec 4 |
| GET | `/api/v1/inbox` | Spec 5 |
| PATCH | `/api/v1/inbox/:id` | Spec 5 |
| POST | `/api/v1/resume/generate` | Spec 5 |

### Background Jobs

| Job | Trigger | Spec |
|-----|---------|------|
| `embed-profile` | Profile created/updated | Spec 4 |
| `embed-job` | Job created/updated | Spec 4 |
| `scan-matches` | Job published / daily cron | Spec 4 |
| `generate-report` | Daily cron | Spec 5 |
| `pre-chat` | Enterprise enables auto_prechat | Spec 5 |
| `update-graph` | Job created/updated | Spec 6 |
