# Core Loop Implementation Plan

> Goal: Make the platform functional end-to-end — real LLM calls, real user modeling, real conversations.

## Phase 1: LLM Infrastructure (Foundation)
Everything depends on this. Replace DeterministicProvider with real Claude API calls.

### 1.1 Real LLM Provider
- Create `ClaudeProvider` in `packages/ai/src/ai/providers/claude.py`
- Implement streaming via Anthropic SDK
- Wire into `ProviderRouter` as default
- Config: `ANTHROPIC_API_KEY` env var, model selection

### 1.2 File Processing Pipeline
- Add `markitdown` or similar for PDF/DOCX parsing
- Create `packages/ai/src/ai/extractors/resume_extractor.py`
- Parse uploaded resumes into structured profile data
- Update upload endpoint to trigger extraction

### 1.3 Streaming Infrastructure
- Ensure SSE endpoints properly stream from Claude
- Tool-use support: AI can call tools (reveal_profile_field, add_skill_tag, etc.)
- Frontend already handles SSE + tool events — just need backend to produce real ones

## Phase 2: Talent Onboarding (The Magic Moment)

### 2.1 AI Character Design
- Design a minimal, cute flat AI avatar (abstract one-line style)
- Welcome message copy and personality definition

### 2.2 Onboarding Conversation Backend
- Create `packages/ai/src/ai/workflows/onboarding.py`
- System prompt: warm, curious AI that asks about the user
- Tool definitions: `reveal_profile_field`, `add_skill_tag`, `complete_onboarding`
- Resume parsing integration: when user uploads, extract and reveal fields
- Progressive profile building via conversation

### 2.3 User Profile Model Enhancement
- Current `TalentProfile` has: skills[], experience[], education[], goals
- Need to add/ensure: `capability_tags` (JSON), `seniority_level`, `ai_tools_used`
- Memory entries for ongoing AI knowledge about user

### 2.4 Frontend Onboarding Polish
- Frontend onboarding components already exist and handle tool events
- Wire to real backend endpoints (currently uses mock/deterministic)
- Ensure fog-clearing animation works with real streaming data

## Phase 3: AI Companion (Buddy) — Functional Chat

### 3.1 Companion Workflow
- Create real `packages/ai/src/ai/workflows/companion.py`
- System prompt with full user profile context + memory
- Modes: general chat, profile update, job advice
- Tool support: update_profile, search_opportunities

### 3.2 Conversation History
- Chat sessions already stored in DB
- Implement proper session listing endpoint (currently returns empty/mock)
- Load history into LLM context window

### 3.3 Memory System
- MemorySpace model exists with JSONB entries
- Create memory service: auto-extract key facts from conversations
- Structure: `{title, keywords, content, updated_at, type}`
- Feed relevant memories into system prompt

### 3.4 File Upload in Chat
- Allow file attachments in companion/coach chat
- Parse files → feed content to LLM
- Update profile based on new file content

## Phase 4: AI Coach — Specialized Advisor

### 4.1 Coach Workflow Enhancement
- Coach workflow exists but uses DeterministicProvider
- Wire to real Claude with mode-specific system prompts
- Modes: resume-review, mock-interview, skill-gaps, general

### 4.2 Profile-Aware Coaching
- AI starts by summarizing current profile state
- Suggests improvements based on target roles
- Proactive opening messages per mode

### 4.3 Tools for Coach
- Career assessment questionnaires (tool to present quiz UI)
- Radar chart / visualization data (tool to render charts)
- Opportunity analysis (tool to fetch user's pending opportunities)

### 4.4 Session History
- Implement real session history listing
- Load past coaching context

## Phase 5: Enterprise Onboarding

### 5.1 Web Search Integration
- Add web search capability (Tavily, SerpAPI, or similar)
- When enterprise provides company name/URL → search for info
- Present findings for confirmation

### 5.2 Enterprise Onboarding Workflow
- Create `packages/ai/src/ai/workflows/enterprise_onboarding.py`
- Search → confirm company identity → ask intent → collect requirements
- JD parsing: accept URL/text/file → structure into job requirements
- Tool events: `confirm_company_info`, `structure_job`, `set_preferences`

### 5.3 JD Structuring
- AI extracts: skills, seniority, timeline, deliverables, work mode
- Structures into Job model fields
- Enterprise reviews and publishes

## Phase 6: Talent Home & Profile Management

### 6.1 Home Page Data
- Wire real profile data (already partially done)
- Publicity/visibility setting (DB has `visible` field)
- Buddy report with real AI-generated insights

### 6.2 AI-Driven Profile Updates
- In companion chat: "update my skills" → AI updates profile
- Tool: `update_talent_profile` with specific field changes
- Show diff of what changed

## Execution Priority

```
Phase 1 (LLM Infra)     ██████████ MUST DO FIRST
Phase 2 (Onboarding)    ██████████ Core magic
Phase 3 (Companion)     ████████   Core loop
Phase 4 (Coach)         ██████     Important
Phase 5 (Enterprise)    ██████     Important  
Phase 6 (Home/Profile)  ████       Polish
```
