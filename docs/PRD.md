# Cyber Silicon Valley — MVP Web Platform Product Document

## Product Philosophy

> What makes a platform AI is not only the AI technology, but also the AI feeling.

CSV is not a recruitment website with AI features bolted on. It is an AI-native platform where your AI companion is present from the first second, learns who you are through conversation, and works for you 24/7. Every interaction should feel like magic — not like filling out forms.

---

## Two Sides, One Platform

| | Talent Side | Enterprise Side |
|---|---|---|
| Core metaphor | "My AI companion knows me and works for me" | "My AI recruiter is always screening" |
| First impression | Cinematic, personal, fog-clearing revelation | Smart, efficient, "it already knows my company" |
| Daily experience | Capability portrait + AI reports | AI workspace + inbox |
| AI feeling | Companion that grows with you | Tireless recruiter that never sleeps |

---

## Part 1: Talent Side

### 1.1 Onboarding — "First Encounter"

The onboarding is the single most important experience in the product. It must feel like meeting a new colleague who is genuinely curious about you, not like signing up for a service.

#### Screen 1: The Awakening

Full-screen, clean, cinematic. No navigation, no sidebar, no header. Just a blank canvas and a minimal one-line AI avatar (think Notion AI's abstract style) that appears with a gentle animation.

The AI companion introduces itself:

> "Hi. I'm your CSV companion. I'll be working alongside you from now on — finding opportunities, prepping your profile, connecting you with the right people. But first, let me get to know you."

#### Screen 2: Multiple Entry Paths

The AI offers several ways to start, presented as conversational choices (not a form):

- Upload a resume (PDF/image, AI extracts everything)
- Link a personal page (GitHub, LinkedIn, personal site — AI crawls and extracts)
- Just tell me your name and give a quick intro
- Send a voice message introducing yourself

All paths converge to the same result: a structured profile. The user picks whichever feels most natural.

#### Screen 3: Conversational Discovery

The AI asks follow-up questions through a mix of chat messages and quick-select buttons. Questions are contextual, based on what it already knows:

- "What kind of work excites you most right now?"
- "Which AI tools do you use daily?" (quick-select chips: Claude, GPT, Cursor, LangChain, etc.)
- "Are you looking for full-time roles, freelance projects, or both?"
- "What's the one thing you wish employers knew about you that a resume can't show?"

The tone is warm, curious, specific. Never generic.

#### Screen 4: Profile Emerges from Fog (The Magic Moment)

This is the signature interaction of CSV.

Split screen layout:
- **Left side**: the ongoing conversation with AI
- **Right side**: a profile panel that starts completely blurred/fogged

As the AI confirms each piece of information, the corresponding section on the right "clears" with a gentle animation — like fog lifting to reveal a landscape:

1. First, your name appears
2. Then your role/title crystallizes
3. Then skill tags emerge one by one
4. Then work experience sections reveal themselves
5. Then career goals and preferences become visible
6. Finally, a skill graph renders itself

Each reveal is tied to a specific moment in the conversation. When the AI says "So you've been building RAG pipelines for legal documents — that's really specialized," the RAG skill tag glows and appears on the right.

By the end of the conversation, the user sees a complete, beautifully structured profile that they built through dialogue, not through forms. It feels like the AI truly understood them.

#### Screen 5: Guided Tour

The AI companion briefly introduces the four core spaces that will be the user's daily experience:

> "Your home is ready. Let me show you around."

It highlights each area with a one-line explanation:

- **AI Coach** — "I'll help you sharpen your profile, prep for interviews, and develop the right skills."
- **AI Seeking Report** — "I'll go out and hunt for opportunities, even pre-chat with companies on your behalf."
- **Opportunity Fair** — "A visual map of the market. Explore by keywords, not lists."
- **Inbox** — "When companies reach out, you'll see them here with match scores."

Then transitions to the home screen.

---

### 1.2 Home — "My Capability Portrait"

The default landing page is the user's capability portrait. This is not a settings page — it's the visual center of their professional identity on CSV.

#### Top Area: AI Companion (Always Present)

The AI companion sits at the top of the home screen, always available for conversation. It's not a chatbot widget tucked in the corner — it's the primary interface element.

The user can talk to the companion to:
- Update their profile ("I just learned Cursor, add that to my skills")
- Ask for advice ("Should I apply for this role?")
- Get status updates ("Any new matches today?")
- Navigate ("Take me to the opportunity fair")

The companion can also proactively surface things: "You have 2 new company invites. One is a 92% match."

#### Main Area: Capability Visualization

Below the companion, the user's skill graph / capability portrait is displayed. This is a visual, not a list — showing:

- Skill clusters (e.g., "NLP" cluster containing RAG, embeddings, fine-tuning)
- Proficiency levels (visual weight/size, not numbers)
- Experience depth (how many projects used this skill)
- Growth trajectory (what's improving)

The user can edit any part directly, or ask the AI to update it via conversation.

#### Navigation to Core Spaces

From home, the user can access four spaces. These could be tabs, cards, or sidebar items — exact layout TBD, but they must be immediately accessible:

1. AI Coach
2. AI Seeking Report
3. Opportunity Fair
4. Inbox

---

### 1.3 AI Coach

The AI coach helps users become more competitive in the job market. It's a dedicated mode of the AI companion focused on improvement.

#### Core Functions

**Resume optimization**: AI analyzes the user's profile against target roles and suggests specific improvements. "Your project descriptions focus on what you built, but employers want to see impact. Let me help you reframe them."

**Interview simulation**: Practice sessions for specific roles or companies. AI plays the interviewer, gives feedback on answers, suggests improvements.

**Skill gap analysis**: Based on the user's target roles, AI identifies gaps. "You want AI agent roles, but you haven't demonstrated multi-agent orchestration experience. Here are three ways to build that."

**Daily/weekly check-ins**: AI sets skill development goals and tracks progress. Proactive nudges when progress stalls.

#### Design Principle

The coach is not a course or tutorial platform. It's a personalized advisor that knows everything about the user's profile and goals. Every suggestion is specific, actionable, and tied to real opportunities in the market.

---

### 1.4 AI Seeking Report

This is where the user's AI agent reports on its work. The mental model: "My agent went out into the market while I was sleeping. Here's what it found."

#### Report Content

**Scan summary**: "Scanned 47 new postings this week. Found 3 high matches (>80%), 8 medium matches (60-80%)."

**Pre-chat summaries**: When the agent has pre-communicated with a company on the user's behalf, the summary is shown here. "Pre-chatted with [Company X] about their AI engineer role. They're interested in your RAG experience. They asked about your availability — I told them you're open from next month."

**Match details**: Each opportunity shows:
- Match score with breakdown (which skills matched, which didn't)
- Company overview (pulled from enterprise profile)
- Role/project description
- Agent's assessment: "Strong fit because... Potential concern because..."

**One-click actions**:
- Generate a tailored resume for this specific opportunity (AI adjusts emphasis and wording based on the JD)
- Apply with the tailored resume
- Ask agent to schedule a pre-chat
- Dismiss

#### Inbound Section

When companies proactively reach out to the user (through the enterprise side's matching), those invites also appear here (or in the Inbox — see below). Each inbound invite shows:
- Company info
- Match score
- Why they're interested
- One-click: generate tailored resume + respond

---

### 1.5 Opportunity Fair — Keyword Graph

This is CSV's most visually distinctive feature. It is NOT a list, NOT a filter-and-browse interface.

#### Core Concept

The opportunity market is visualized as a keyword graph — a spatial map where:

- **Nodes** are keywords/skills (e.g., "RAG", "agent framework", "data analysis", "computer vision")
- **Node size** represents the number of available opportunities
- **Distance between nodes** represents how related the keywords are
- **Edges** connect frequently co-occurring keywords

#### Interaction Model

1. **Entry**: User sees the full graph. Keywords most relevant to their profile are highlighted or centered.

2. **Click a keyword**: Zoom into that cluster. See the companies/projects hiring for this skill. Each company is a smaller node inside the keyword bubble with basic info (company name, role title, match score).

3. **Zoom out**: See the surrounding keyword landscape. Discover adjacent areas: clicking "RAG" shows that "vector database" and "knowledge graph" are nearby clusters.

4. **Switch primary keyword**: Directly jump to a different area of the graph.

5. **Click a company**: Opens a detail panel with the full opportunity description, match analysis, and action buttons (apply, save, ask agent to pre-chat).

#### Design Principles

- The graph should feel like exploring a territory, not reading a spreadsheet
- User's strongest keywords should be visually emphasized (they're your "home territory")
- New/trending keywords should have visual indicators
- The graph updates as the market changes — new opportunities shift the landscape

#### Why This Works

Traditional job boards are optimized for keyword search. But most people don't know exactly what to search for. The graph lets you discover adjacent opportunities you didn't know existed. "I was looking at RAG roles but discovered a cluster of knowledge graph companies that match my skills even better."

---

### 1.6 Inbox

All inbound communication in one place.

#### Content Types

- **Company invites**: Enterprises that found your profile and want to connect. Each shows match score and a preview.
- **Agent pre-chat results**: Summaries of conversations your agent had with companies.
- **Mentor messages**: If mentor twins are available, messages from mentor sessions.
- **System notifications**: Profile views, new matches, skill graph updates.

#### Key Feature

Every company interaction shows a **match score** prominently. The user can always see at a glance: "Is this worth my time?" One-click generate tailored resume for any inbound invite.

---

### 1.7 CLI / Agent Access

Users can install a CLI tool (or configure MCP server) to let their AI agent (Claude Code, Codex, OpenClaw, etc.) operate on CSV on their behalf.

#### Available Commands / Tools

```
csv profile update          # Update skills, status, availability
csv profile view            # View current profile
csv matches scan            # Scan for new matching opportunities
csv matches list            # List current matches with scores
csv apply --job [id]        # Express interest in an opportunity
csv apply --generate-resume # Generate tailored resume for a job
csv inbox list              # View inbox items
csv inbox respond [id]      # Respond to a company invite
csv coach check-in          # Run a coaching check-in session
csv status                  # Agent activity summary
```

#### MCP Server

All CLI commands are also exposed as MCP tools, so any MCP-compatible agent can interact with CSV. The agent can:

- Keep the user's profile fresh without them opening a browser
- Scan for opportunities on a schedule
- Pre-chat with companies using the user's context
- Generate tailored resumes for specific opportunities
- Manage inbox items

---

## Part 2: Enterprise Side

### 2.1 Onboarding — "We Already Know You"

The enterprise onboarding should feel like the AI has done its homework before you even showed up.

#### Screen 1: Company Recognition

Enterprise user provides company name or website URL. The AI immediately:

- Searches the web for the company
- Pulls key facts: industry, founding year, size, location, tech stack, recent news
- Presents a summary: "You're [Company Name], a [industry] company founded in [year], with about [size] employees. You recently [notable event]. Is this right?"

User confirms or corrects. This takes seconds, not minutes.

#### Screen 2: Intent Clarification

AI asks a clear question:

> "What brings you to CSV? Are you looking to..."
> - Recruit someone for a role (full-time or contract)
> - Find someone to deliver a specific project (2-8 weeks)
> - Just explore the talent pool

This determines the next flow.

#### Screen 3: Requirement Input

For recruitment or project delivery:

- User can link a JD (URL), paste text, upload a document, or describe the need in conversation
- AI extracts and structures the requirement:
  - Required skills (tool-level specificity: "LangChain RAG pipeline" not just "AI")
  - Seniority level
  - Timeline
  - Deliverables (for projects)
  - Budget range
- AI proactively asks clarifying questions for vague points: "You mentioned 'AI experience' — could you be more specific? For example, do you need someone who has built production AI systems, or someone who can use AI tools for analysis?"

#### Screen 4: Matching Setup

AI guides the enterprise through matching preferences:

> "I can start finding candidates right away. A few quick questions:"
> - "Should I auto-match and rank candidates for you?" (yes/no)
> - "Should I pre-screen candidates via AI chat before showing them to you?" (yes/no)
> - "Any hard requirements that are absolute deal-breakers?" (must-haves)

Then transitions to the workspace.

---

### 2.2 Enterprise Home — "AI at Work"

The enterprise home page should convey: "Your AI recruiter is actively working right now."

#### Top Area: AI Activity Status

A real-time status indicator showing what the AI is doing:

> "Your AI is scanning the talent pool... 12 profiles reviewed... 3 high matches found... Pre-chatting with 1 candidate..."

This is not just a progress bar — it's a live feed that makes the AI's work visible and tangible.

#### Core Sections

**Active Jobs**: All posted requirements with status (open / reviewing / in pre-chat / filled). Click into any job to see matched candidates.

**Inbox**: Candidate responses, agent pre-chat summaries, platform notifications. Each item shows relevance and urgency.

**Quick Actions**:
- Post a new requirement
- Browse talent pool
- Review AI recommendations

---

### 2.3 JD Input + Auto-Structuring

After onboarding, enterprises can post new requirements at any time. The flow is the same as onboarding but faster — company context is already known, preferences are remembered.

#### One-Click Import

- Paste JD text → AI structures in seconds
- Link JD URL → AI fetches and structures
- Conversational input → AI builds the requirement through dialogue

#### AI Structuring Output

The AI produces a structured requirement card:

- **Role/Project title**: Auto-generated, editable
- **Required skills**: Tags at tool-level (e.g., "LangChain", "RAG", "Python", "Vector DB")
- **Skill weights**: Must-have vs. nice-to-have (visual toggle)
- **Seniority**: Junior / Mid / Senior / Lead
- **Timeline**: Start date, duration, milestones
- **Deliverables**: Specific outputs expected (for projects)
- **Budget range**: Suggested based on market data, editable
- **Work mode**: Remote / onsite / hybrid

Enterprise reviews, adjusts, and publishes.

---

### 2.4 Resume Matching + Screening

Two parallel modes for finding the right talent. Both access the same talent pool, but offer different interaction paradigms.

#### Mode A: Feature Matching View (Structured)

A ranked candidate list where each candidate has a dimension-by-dimension match breakdown:

| Dimension | Requirement | Candidate | Match |
|-----------|-------------|-----------|-------|
| RAG experience | Must-have | 3 projects | High |
| Python proficiency | Must-have | 5 years | High |
| Team lead experience | Nice-to-have | None | Low |
| Available within 2 weeks | Must-have | Available now | High |

Visual indicators: green / yellow / red for each dimension.

Features:
- Sort by overall match score, specific dimension, or availability
- Side-by-side comparison of 2-3 candidates
- Filter by hard constraints
- Click into any candidate for full profile view

#### Mode B: AI Screening Chat (Conversational)

Natural language search across all talent profiles:

> Enterprise: "Find me someone who has built production RAG systems, speaks English, and can start next week."
>
> AI: "I found 4 candidates matching your criteria. The strongest match is [Name] — they built a RAG-based legal document system handling 10K+ documents in production. They're available immediately. Here's their full profile..."

Features:
- Follow-up questions refine the search: "Any of them have startup experience?"
- AI can compare candidates on request: "How do candidates A and B compare on NLP depth?"
- AI explains its reasoning: "I ranked [Name] higher because their production RAG experience directly matches your use case, while [Other] has more theoretical knowledge."

#### Candidate Detail View

When an enterprise clicks into a specific candidate (from either mode):

- Full capability portrait (same view the talent sees, but from enterprise perspective)
- Skill graph with highlights on matching dimensions
- Project history with relevance markers
- AI-generated compatibility analysis for this specific role
- Action buttons: save to shortlist, send invite, ask AI to pre-chat

#### Shortlist + Outreach

- Save candidates to a shortlist per job
- Send interview invitations or project proposals
- Track response status
- AI can draft personalized outreach messages based on the candidate's profile

---

## Part 3: Shared Infrastructure

### 3.1 Authentication

- Email + password registration
- WeChat OAuth (critical for China market)
- Google OAuth (for international users)
- Role selection on signup: Talent or Enterprise
- API key generation for CLI/agent access

### 3.2 Messaging

- Direct messaging between talent and enterprise
- Supports text and file sharing
- AI companion can draft suggested responses
- Message history preserved

### 3.3 Notifications

- In-app notification center
- Email notifications (configurable)
- WeChat push notifications (critical for China market)
- Notification types: new matches, inbound invites, agent activity reports, profile views, mentor messages

### 3.4 Landing Page

- Public marketing page explaining what CSV is
- Two clear CTAs: "I'm looking for opportunities" / "I'm hiring AI talent"
- Show the magic: a preview of the onboarding experience
- Social proof: early user testimonials, partner logos

### 3.5 Admin Dashboard

- User management (talent + enterprise accounts)
- Content moderation
- Matching quality metrics
- Platform analytics (signups, matches, conversions)
- AI Twin management (for mentor twins)

---

## Design Principles Summary

1. **AI companion first, UI second**: The primary interaction model is conversation with your AI companion. Pages and screens are secondary — they display what the AI has learned and done.

2. **Magic moments over efficiency**: The fog-clearing onboarding, the live "AI at work" status, the keyword graph — these cost more to build than forms and lists, but they're what makes CSV feel fundamentally different.

3. **No forms, only conversations**: Wherever possible, structured data is extracted from natural dialogue, not from form fields. The user talks, the AI structures.

4. **Show, don't list**: Capability portraits instead of resume text. Keyword graphs instead of job lists. Visual match breakdowns instead of percentage numbers.

5. **Agent as first-class citizen**: CLI and MCP server are not afterthoughts. The platform must be fully operable by AI agents from day one. Users who configure their agents should have a meaningfully better experience.

6. **Always working**: The AI should feel like it's always active — scanning, matching, pre-chatting — even when the user is not on the platform. The AI Seeking Report is proof that the platform is working for you while you sleep.

---

## Page Inventory (MVP)

### Talent Side
| # | Page | Type | Priority |
|---|------|------|----------|
| T1 | Onboarding: AI awakening + entry paths | AI conversation | P0 |
| T2 | Onboarding: conversational discovery + fog-clearing profile reveal | AI conversation + animation | P0 |
| T3 | Onboarding: guided tour of spaces | AI walkthrough | P0 |
| T4 | Home: capability portrait + AI companion | Dashboard | P0 |
| T5 | AI Coach | AI conversation + suggestions | P1 |
| T6 | AI Seeking Report | AI report + actions | P0 |
| T7 | Opportunity Fair: keyword graph | Interactive graph visualization | P1 |
| T8 | Inbox | Message list + actions | P0 |
| T9 | Profile editor | Edit form (as fallback to AI conversation) | P0 |
| T10 | Public portfolio page | Public-facing profile | P0 |
| T11 | API key management | Settings page | P1 |

### Enterprise Side
| # | Page | Type | Priority |
|---|------|------|----------|
| E1 | Onboarding: company recognition | AI + web search | P0 |
| E2 | Onboarding: intent + requirement input | AI conversation | P0 |
| E3 | Onboarding: matching setup | AI guided flow | P0 |
| E4 | Home: AI workspace + activity status | Dashboard | P0 |
| E5 | JD input + auto-structuring | AI + editor | P0 |
| E6 | Feature matching view (structured screening) | Data table + visualization | P0 |
| E7 | AI screening chat (conversational screening) | AI conversation | P0 |
| E8 | Candidate detail view | Profile page | P0 |
| E9 | Shortlist + outreach | List + actions | P1 |
| E10 | Company profile editor | Edit form | P1 |
| E11 | Company public page | Public-facing profile | P1 |

### Shared
| # | Page | Type | Priority |
|---|------|------|----------|
| S1 | Landing page | Marketing | P0 |
| S2 | Login / Signup | Auth flow | P0 |
| S3 | Messaging | Chat interface | P1 |
| S4 | Notification center | List | P1 |
| S5 | Admin dashboard | Internal tool | P2 |

**Total: 27 pages/features. P0 (must-have for launch): 17. P1 (fast follow): 8. P2 (later): 2.**

---

## Open Design Questions

- [ ] Opportunity Fair: force-directed graph vs spatial cluster map vs other visualization approach?
- [ ] AI companion visual identity: what does the one-line abstract avatar look like? How much personality does it have?
- [ ] Fog-clearing animation: what visual metaphor exactly? Blur removal? Particle assembly? Ink appearing?
- [ ] How does the AI companion persist across pages? Fixed top bar? Floating widget? Full sidebar?
- [ ] Inbox vs AI Seeking Report: separate tabs, or sections within a unified feed?
- [ ] Mentor twin MVP scope: pre-built twins only, or include the 7-step twin builder?
- [ ] Enterprise AI pre-chat with candidates: how much autonomy does the AI get? What requires human approval?
- [ ] Talent-side: can users opt out of AI agent pre-chatting on their behalf?
- [ ] Mobile responsiveness: web-first, but how critical is mobile web for MVP?
- [ ] Keyword graph data: how to bootstrap the graph before significant job posting volume?

---

*CSV MVP v1 — Focus on features, pages, design, and experience. No technical implementation details.*
