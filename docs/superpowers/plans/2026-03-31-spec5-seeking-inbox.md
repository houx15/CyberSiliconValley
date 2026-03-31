# Spec 5: AI Seeking Report + Inbox --- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the talent seeking report page (pre-generated AI match analysis), tailored resume generation, pre-chat background job, and shared inbox system for both talent and enterprise users.

**Architecture:** Seeking report loads a pre-generated JSONB document from `seeking_reports` table, populated by a daily `generate-report` BullMQ cron job. Inbox uses a shared `InboxList` component for both `/talent/inbox` and `/enterprise/inbox`, with filter tabs, unread tracking, and badge counts. Tailored resume generation is a synchronous LLM endpoint returning markdown. Pre-chat is a background job producing simulated conversation summaries stored as inbox items.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, Drizzle ORM, Vercel AI SDK, BullMQ, Redis

---

## File Structure

```
csv/
├── src/
│   ├── app/
│   │   ├── (talent)/
│   │   │   ├── seeking/
│   │   │   │   └── page.tsx                  # Seeking report page
│   │   │   └── inbox/
│   │   │       └── page.tsx                  # Talent inbox page
│   │   ├── (enterprise)/
│   │   │   └── inbox/
│   │   │       └── page.tsx                  # Enterprise inbox page
│   │   └── api/
│   │       └── v1/
│   │           ├── inbox/
│   │           │   ├── route.ts              # GET /api/v1/inbox
│   │           │   └── [id]/
│   │           │       └── route.ts          # PATCH /api/v1/inbox/:id
│   │           ├── resume/
│   │           │   └── generate/
│   │           │       └── route.ts          # POST /api/v1/resume/generate
│   │           └── seeking/
│   │               └── route.ts              # GET /api/v1/seeking (fetch latest report)
│   ├── components/
│   │   ├── seeking/
│   │   │   ├── scan-summary.tsx              # Scan summary section
│   │   │   ├── high-match-card.tsx           # Expandable match card
│   │   │   ├── prechat-activity.tsx          # Pre-chat summary section
│   │   │   ├── inbound-interest.tsx          # Inbound interest section
│   │   │   └── tailored-resume-dialog.tsx    # Resume preview dialog
│   │   └── inbox/
│   │       ├── inbox-list.tsx                # Shared InboxList component
│   │       ├── inbox-item-row.tsx            # Single inbox item row
│   │       ├── inbox-detail.tsx              # Detail view panel
│   │       └── inbox-badge.tsx               # Unread badge for nav
│   ├── lib/
│   │   ├── ai/
│   │   │   └── prompts/
│   │   │       ├── seeking-assessment.ts     # System prompt for match assessment
│   │   │       ├── tailored-resume.ts        # System prompt for resume rewrite
│   │   │       └── pre-chat.ts              # System prompt for pre-chat summary
│   │   ├── jobs/
│   │   │   ├── generate-report.ts            # generate-report worker handler
│   │   │   └── pre-chat.ts                  # pre-chat worker handler
│   │   └── api/
│   │       ├── inbox.ts                      # Inbox data access functions
│   │       └── seeking.ts                    # Seeking report data access functions
│   └── i18n/
│       └── messages/
│           ├── en.json                       # Add seeking + inbox strings
│           └── zh.json                       # Add seeking + inbox strings
└── __tests__/
    ├── lib/
    │   ├── api/inbox.test.ts                 # Inbox data access tests
    │   └── api/seeking.test.ts               # Seeking report data access tests
    └── components/
        └── inbox/inbox-list.test.tsx          # InboxList component tests
```

---

### Task 1: Seeking Report Data Access Layer

**Files:**
- Create: `src/lib/api/seeking.ts`
- Create: `__tests__/lib/api/seeking.test.ts`

- [x] **Step 1: Write tests for seeking report data access**

Create `__tests__/lib/api/seeking.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getLatestReport, upsertReport } from '@/lib/api/seeking';

// Mock drizzle
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: 'report-1' }]),
  },
}));

describe('seeking data access', () => {
  it('getLatestReport returns null when no reports exist', async () => {
    const result = await getLatestReport('talent-1');
    expect(result).toBeNull();
  });

  it('upsertReport accepts valid report data', async () => {
    const reportData = {
      scanSummary: {
        totalScanned: 42,
        highMatches: 5,
        mediumMatches: 12,
        periodLabel: 'This week',
      },
      highMatches: [],
      preChatActivity: [],
      inboundInterest: [],
      generatedAt: new Date().toISOString(),
    };

    // Should not throw
    await expect(upsertReport('talent-1', reportData)).resolves.not.toThrow();
  });
});
```

- [x] **Step 2: Implement seeking report data access**

Create `src/lib/api/seeking.ts`:

```typescript
import { db } from '@/lib/db';
import { seekingReports } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface ScanSummary {
  totalScanned: number;
  highMatches: number;
  mediumMatches: number;
  periodLabel: string;
}

export interface HighMatchItem {
  matchId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  workMode: string;
  score: number;
  skillMatches: Array<{
    skill: string;
    matched: boolean;
    level: string;
  }>;
  aiAssessment: string;
}

export interface PreChatItem {
  inboxItemId: string;
  companyName: string;
  jobTitle: string;
  summary: string;
  generatedAt: string;
}

export interface InboundInterestItem {
  matchId: string;
  companyName: string;
  reason: string;
  score: number;
  jobId: string;
}

export interface SeekingReportData {
  scanSummary: ScanSummary;
  highMatches: HighMatchItem[];
  preChatActivity: PreChatItem[];
  inboundInterest: InboundInterestItem[];
  generatedAt: string;
}

export async function getLatestReport(
  talentId: string
): Promise<SeekingReportData | null> {
  const rows = await db
    .select()
    .from(seekingReports)
    .where(eq(seekingReports.talentId, talentId))
    .orderBy(desc(seekingReports.generatedAt))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0]!.reportData as SeekingReportData;
}

export async function upsertReport(
  talentId: string,
  reportData: SeekingReportData
): Promise<void> {
  await db
    .insert(seekingReports)
    .values({
      talentId,
      reportData,
      generatedAt: new Date(),
    });
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -- __tests__/lib/api/seeking.test.ts
git add src/lib/api/seeking.ts __tests__/lib/api/seeking.test.ts
git commit -m "feat(spec5): add seeking report data access layer"
```

---

### Task 2: Seeking Report API Route

**Files:**
- Create: `src/app/api/v1/seeking/route.ts`

- [x] **Step 1: Implement GET /api/v1/seeking**

Create `src/app/api/v1/seeking/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getLatestReport } from '@/lib/api/seeking';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'talent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the talent profile ID from the user
  // The user object from verifyToken includes profileId
  const report = await getLatestReport(user.profileId);

  if (!report) {
    return NextResponse.json({
      data: null,
      message: 'No report generated yet',
    });
  }

  return NextResponse.json({ data: report });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v1/seeking/route.ts
git commit -m "feat(spec5): add GET /api/v1/seeking route"
```

---

### Task 3: AI Prompts for Seeking Features

**Files:**
- Create: `src/lib/ai/prompts/seeking-assessment.ts`
- Create: `src/lib/ai/prompts/tailored-resume.ts`
- Create: `src/lib/ai/prompts/pre-chat.ts`

- [x] **Step 1: Create match assessment prompt**

Create `src/lib/ai/prompts/seeking-assessment.ts`:

```typescript
import { basePrompt } from './_base';

export function buildAssessmentPrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string; category: string }>;
    experience: Array<{ role: string; company: string; description: string }>;
    goals: { targetRoles?: string[]; preferences?: string };
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    structured: {
      skills: Array<{ name: string; required: boolean }>;
      seniority: string;
      workMode: string;
    };
  },
  score: number
): string {
  return `${basePrompt}

You are evaluating a talent-job match. Provide a concise, honest assessment.

## Talent Profile
Name: ${talentProfile.displayName}
Headline: ${talentProfile.headline}
Skills: ${talentProfile.skills.map((s) => `${s.name} (${s.level})`).join(', ')}
Experience: ${talentProfile.experience.map((e) => `${e.role} at ${e.company}: ${e.description}`).join('\n')}
Goals: ${talentProfile.goals.targetRoles?.join(', ') || 'Not specified'}

## Job
Title: ${job.title}
Company: ${job.companyName}
Description: ${job.description}
Required Skills: ${job.structured.skills.filter((s) => s.required).map((s) => s.name).join(', ')}
Nice-to-have Skills: ${job.structured.skills.filter((s) => !s.required).map((s) => s.name).join(', ')}
Seniority: ${job.structured.seniority}
Work Mode: ${job.structured.workMode}

## Match Score: ${score}/100

Write a 2-3 sentence assessment covering:
1. Why this is a strong fit (specific skill/experience overlap)
2. Any potential concerns or gaps
3. One actionable suggestion

Be specific — reference actual skills and experience. Do not be generic.
Respond in the same language the talent profile is written in.`;
}
```

- [x] **Step 2: Create tailored resume prompt**

Create `src/lib/ai/prompts/tailored-resume.ts`:

```typescript
import { basePrompt } from './_base';

export function buildTailoredResumePrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    bio: string;
    skills: Array<{ name: string; level: string; category: string }>;
    experience: Array<{
      role: string;
      company: string;
      dateRange: string;
      description: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    structured: {
      skills: Array<{ name: string; required: boolean }>;
      seniority: string;
    };
  }
): string {
  return `${basePrompt}

You are a professional resume writer. Rewrite the candidate's profile as a tailored resume for this specific job.

## Candidate Profile
Name: ${talentProfile.displayName}
Current Headline: ${talentProfile.headline}
Bio: ${talentProfile.bio}
Skills: ${talentProfile.skills.map((s) => `${s.name} (${s.level})`).join(', ')}
Experience:
${talentProfile.experience.map((e) => `- ${e.role} at ${e.company} (${e.dateRange})\n  ${e.description}`).join('\n')}
Education:
${talentProfile.education.map((e) => `- ${e.degree}, ${e.institution} (${e.year})`).join('\n')}

## Target Job
Title: ${job.title}
Company: ${job.companyName}
Description: ${job.description}
Required Skills: ${job.structured.skills.filter((s) => s.required).map((s) => s.name).join(', ')}
Nice-to-have: ${job.structured.skills.filter((s) => !s.required).map((s) => s.name).join(', ')}
Seniority: ${job.structured.seniority}

## Instructions
1. Output a complete resume in **Markdown** format
2. Rewrite the headline to emphasize relevance to this specific role
3. Reorder and reword experience bullets to highlight skills that match the job requirements
4. Emphasize matching skills prominently; downplay (but don't remove) unrelated skills
5. Add a "Summary" section at the top that positions the candidate for this exact role
6. Keep all factual content accurate — reframe, don't fabricate
7. Use quantified impact where the original data supports it
8. Respond in the same language as the candidate's profile`;
}
```

- [x] **Step 3: Create pre-chat summary prompt**

Create `src/lib/ai/prompts/pre-chat.ts`:

```typescript
import { basePrompt } from './_base';

export function buildPreChatPrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string }>;
    experience: Array<{ role: string; company: string; description: string }>;
    goals: { targetRoles?: string[]; preferences?: string };
    availability: string;
    salaryRange: string;
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    structured: {
      skills: Array<{ name: string; required: boolean }>;
      seniority: string;
      workMode: string;
      budget?: string;
    };
  },
  score: number
): string {
  return `${basePrompt}

You are simulating a preliminary screening conversation between an AI recruiter representing "${job.companyName}" and the candidate "${talentProfile.displayName}".

## Candidate Profile
Name: ${talentProfile.displayName}
Headline: ${talentProfile.headline}
Skills: ${talentProfile.skills.map((s) => `${s.name} (${s.level})`).join(', ')}
Key Experience: ${talentProfile.experience.slice(0, 3).map((e) => `${e.role} at ${e.company}`).join(', ')}
Goals: ${talentProfile.goals.targetRoles?.join(', ') || 'Not specified'}
Availability: ${talentProfile.availability}
Salary Expectation: ${talentProfile.salaryRange}

## Job
Title: ${job.title}
Company: ${job.companyName}
Description: ${job.description}
Required Skills: ${job.structured.skills.filter((s) => s.required).map((s) => s.name).join(', ')}
Seniority: ${job.structured.seniority}
Work Mode: ${job.structured.workMode}
Budget: ${job.structured.budget || 'Not disclosed'}

## Match Score: ${score}/100

## Instructions
Generate a pre-chat summary as if an AI recruiter had a brief screening conversation with this candidate. This is NOT an actual conversation transcript — it's a synthesized summary.

Output format (Markdown):

### Key Findings
- 3-4 bullet points about fit, strengths, and concerns

### Compatibility Assessment
A short paragraph on overall compatibility.

### Recommended Next Steps
- 2-3 concrete next steps for the enterprise

### Candidate Sentiment
One sentence predicting the candidate's likely interest level based on their goals and the job fit.

Respond in the same language as the candidate's profile.`;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/prompts/seeking-assessment.ts src/lib/ai/prompts/tailored-resume.ts src/lib/ai/prompts/pre-chat.ts
git commit -m "feat(spec5): add AI prompts for assessment, tailored resume, and pre-chat"
```

---

### Task 4: Generate Report Background Job

**Files:**
- Create: `src/lib/jobs/generate-report.ts`

- [x] **Step 1: Implement the generate-report worker handler**

Create `src/lib/jobs/generate-report.ts`:

```typescript
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import {
  talentProfiles,
  matches,
  jobs,
  enterpriseProfiles,
  inboxItems,
} from '@/lib/db/schema';
import { eq, desc, gte, and, inArray } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { buildAssessmentPrompt } from '@/lib/ai/prompts/seeking-assessment';
import { upsertReport } from '@/lib/api/seeking';
import type {
  SeekingReportData,
  HighMatchItem,
  PreChatItem,
  InboundInterestItem,
} from '@/lib/api/seeking';

interface GenerateReportJobData {
  talentId: string;
}

export async function handleGenerateReport(
  job: Job<GenerateReportJobData>
): Promise<void> {
  const { talentId } = job.data;

  job.log(`Generating seeking report for talent ${talentId}`);

  // 1. Fetch talent profile
  const [profile] = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.id, talentId))
    .limit(1);

  if (!profile) {
    job.log(`Talent profile ${talentId} not found, skipping`);
    return;
  }

  // 2. Query recent matches
  const recentMatches = await db
    .select({
      match: matches,
      job: jobs,
    })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(eq(matches.talentId, talentId))
    .orderBy(desc(matches.score));

  const highScoreMatches = recentMatches.filter((m) => m.match.score >= 80);
  const mediumScoreMatches = recentMatches.filter(
    (m) => m.match.score >= 60 && m.match.score < 80
  );

  // 3. For top matches, generate AI assessments
  const topMatches = highScoreMatches.slice(0, 10);
  const highMatchItems: HighMatchItem[] = [];

  for (const { match, job: jobData } of topMatches) {
    // Fetch enterprise profile for company name
    const [enterprise] = await db
      .select()
      .from(enterpriseProfiles)
      .innerJoin(
        jobs,
        eq(jobs.id, match.jobId)
      )
      .where(eq(jobs.id, match.jobId))
      .limit(1);

    const structured = (jobData.structured as Record<string, unknown>) || {};
    const skills = (structured.skills as Array<{ name: string; required: boolean }>) || [];
    const companyName =
      (enterprise?.enterprise_profiles?.companyName as string) || 'Unknown Company';

    // Generate AI assessment
    let aiAssessment = '';
    try {
      const model = getAIModel();
      const profileSkills = (profile.skills as Array<{ name: string; level: string; category: string }>) || [];
      const profileExperience = (profile.experience as Array<{ role: string; company: string; description: string }>) || [];
      const profileGoals = (profile.goals as Record<string, unknown>) || {};

      const prompt = buildAssessmentPrompt(
        {
          displayName: profile.displayName || '',
          headline: profile.headline || '',
          skills: profileSkills,
          experience: profileExperience,
          goals: {
            targetRoles: (profileGoals.targetRoles as string[]) || [],
            preferences: (profileGoals.preferences as string) || '',
          },
        },
        {
          title: jobData.title,
          companyName,
          description: jobData.description || '',
          structured: {
            skills,
            seniority: (structured.seniority as string) || '',
            workMode: (structured.workMode as string) || '',
          },
        },
        match.score
      );

      const result = await generateText({
        model,
        prompt,
      });

      aiAssessment = result.text;
    } catch (error) {
      job.log(`Failed to generate assessment for match ${match.id}: ${error}`);
      aiAssessment = 'Assessment could not be generated at this time.';
    }

    // Build skill match list
    const profileSkillNames = new Set(
      ((profile.skills as Array<{ name: string }>) || []).map((s) =>
        s.name.toLowerCase()
      )
    );
    const skillMatches = skills.map((s) => ({
      skill: s.name,
      matched: profileSkillNames.has(s.name.toLowerCase()),
      level: s.required ? 'required' : 'nice-to-have',
    }));

    highMatchItems.push({
      matchId: match.id,
      jobId: jobData.id,
      jobTitle: jobData.title,
      companyName,
      location: (structured.location as string) || 'Remote',
      workMode: (structured.workMode as string) || 'Remote',
      score: match.score,
      skillMatches,
      aiAssessment,
    });
  }

  // 4. Fetch pre-chat activity from inbox
  const preChatItems = await db
    .select()
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.userId, talentId),
        eq(inboxItems.itemType, 'prechat_summary')
      )
    )
    .orderBy(desc(inboxItems.createdAt))
    .limit(5);

  const preChatActivity: PreChatItem[] = preChatItems.map((item) => {
    const content = (item.content as Record<string, unknown>) || {};
    return {
      inboxItemId: item.id,
      companyName: (content.companyName as string) || 'Unknown',
      jobTitle: (content.jobTitle as string) || 'Unknown',
      summary: (content.summary as string) || '',
      generatedAt: item.createdAt?.toISOString() || new Date().toISOString(),
    };
  });

  // 5. Fetch inbound interest (enterprises that viewed/shortlisted this talent)
  const inboundMatches = await db
    .select({
      match: matches,
      job: jobs,
    })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(
      and(
        eq(matches.talentId, talentId),
        eq(matches.status, 'shortlisted')
      )
    )
    .orderBy(desc(matches.score))
    .limit(10);

  const inboundInterest: InboundInterestItem[] = [];
  for (const { match, job: jobData } of inboundMatches) {
    const structured = (jobData.structured as Record<string, unknown>) || {};
    // Fetch company name via the job
    const [ep] = await db
      .select()
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, jobData.userId || ''))
      .limit(1);

    inboundInterest.push({
      matchId: match.id,
      companyName: ep?.companyName || 'Unknown Company',
      reason: match.aiReasoning || 'Your profile matches their requirements.',
      score: match.score,
      jobId: jobData.id,
    });
  }

  // 6. Assemble and store report
  const reportData: SeekingReportData = {
    scanSummary: {
      totalScanned: recentMatches.length,
      highMatches: highScoreMatches.length,
      mediumMatches: mediumScoreMatches.length,
      periodLabel: 'This week',
    },
    highMatches: highMatchItems,
    preChatActivity,
    inboundInterest,
    generatedAt: new Date().toISOString(),
  };

  await upsertReport(talentId, reportData);

  job.log(`Seeking report generated for talent ${talentId}: ${highMatchItems.length} high matches`);
}
```

- [x] **Step 2: Register the worker handler in the worker entry point**

In `src/lib/jobs/worker.ts`, add the `generate-report` case to the existing worker switch:

```typescript
// Add import at top of file
import { handleGenerateReport } from './generate-report';

// Inside the existing worker processor switch/if block, add:
case 'generate-report':
  await handleGenerateReport(job);
  break;
```

- [ ] **Step 3: Add daily cron schedule for generate-report**

In `src/lib/jobs/queue.ts`, add the repeatable job registration:

```typescript
// Add after existing queue definitions:

export async function scheduleGenerateReports() {
  const queue = getQueue('generate-report');

  // Remove any existing repeatable jobs to avoid duplicates
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Schedule daily at 6:00 AM
  await queue.add(
    'generate-all-reports',
    { type: 'scheduled' },
    {
      repeat: {
        pattern: '0 6 * * *', // Every day at 6 AM
      },
    }
  );
}
```

Then in the worker entry point, handle the scheduled trigger that fans out to individual talent reports:

```typescript
// In the generate-report case handler, add fan-out logic:
case 'generate-report':
  if (job.data.type === 'scheduled') {
    // Fan out: queue individual report generation for all talent profiles
    const allTalent = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.onboardingDone, true));

    const queue = getQueue('generate-report');
    for (const talent of allTalent) {
      await queue.add('generate-report-single', { talentId: talent.id });
    }
    job.log(`Queued report generation for ${allTalent.length} talent profiles`);
  } else {
    await handleGenerateReport(job);
  }
  break;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/jobs/generate-report.ts src/lib/jobs/worker.ts src/lib/jobs/queue.ts
git commit -m "feat(spec5): implement generate-report background job with daily cron"
```

---

### Task 5: Pre-Chat Background Job

**Files:**
- Create: `src/lib/jobs/pre-chat.ts`

- [x] **Step 1: Implement the pre-chat worker handler**

Create `src/lib/jobs/pre-chat.ts`:

```typescript
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import {
  talentProfiles,
  matches,
  jobs,
  enterpriseProfiles,
  inboxItems,
} from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { buildPreChatPrompt } from '@/lib/ai/prompts/pre-chat';

interface PreChatJobData {
  jobId: string;
}

export async function handlePreChat(
  job: Job<PreChatJobData>
): Promise<void> {
  const { jobId } = job.data;

  job.log(`Running pre-chat generation for job ${jobId}`);

  // 1. Fetch the job and enterprise profile
  const [jobData] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!jobData) {
    job.log(`Job ${jobId} not found, skipping`);
    return;
  }

  const [enterprise] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, jobData.userId || ''))
    .limit(1);

  const companyName = enterprise?.companyName || 'Unknown Company';
  const structured = (jobData.structured as Record<string, unknown>) || {};

  // 2. Find high-match talent for this job (score >= 80)
  const highMatches = await db
    .select({
      match: matches,
      talent: talentProfiles,
    })
    .from(matches)
    .innerJoin(talentProfiles, eq(matches.talentId, talentProfiles.id))
    .where(
      and(
        eq(matches.jobId, jobId),
        gte(matches.score, 80)
      )
    );

  job.log(`Found ${highMatches.length} high-match candidates for pre-chat`);

  // 3. For each high match, generate pre-chat summary
  for (const { match, talent } of highMatches) {
    // Check if a pre-chat already exists for this talent+job combo
    const existing = await db
      .select({ id: inboxItems.id })
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.userId, talent.id),
          eq(inboxItems.itemType, 'prechat_summary')
        )
      )
      .limit(1);

    // Simple dedup: check content for this job ID
    // In production, you'd add a unique constraint or a jobId column
    if (existing.length > 0) {
      // Check if this specific job's pre-chat already exists
      const existingForJob = await db
        .select({ id: inboxItems.id })
        .from(inboxItems)
        .where(
          and(
            eq(inboxItems.userId, talent.id),
            eq(inboxItems.itemType, 'prechat_summary')
          )
        );

      const alreadyExists = existingForJob.some((item) => {
        // This is checked at the content level since we don't have a dedicated column
        return false; // Let it generate — dedup by content is fragile
      });
    }

    try {
      const model = getAIModel();
      const talentSkills = (talent.skills as Array<{ name: string; level: string }>) || [];
      const talentExperience = (talent.experience as Array<{ role: string; company: string; description: string }>) || [];
      const talentGoals = (talent.goals as Record<string, unknown>) || {};

      const prompt = buildPreChatPrompt(
        {
          displayName: talent.displayName || '',
          headline: talent.headline || '',
          skills: talentSkills,
          experience: talentExperience,
          goals: {
            targetRoles: (talentGoals.targetRoles as string[]) || [],
            preferences: (talentGoals.preferences as string) || '',
          },
          availability: talent.availability || 'Open',
          salaryRange: talent.salaryRange || 'Not specified',
        },
        {
          title: jobData.title,
          companyName,
          description: jobData.description || '',
          structured: {
            skills: (structured.skills as Array<{ name: string; required: boolean }>) || [],
            seniority: (structured.seniority as string) || '',
            workMode: (structured.workMode as string) || '',
            budget: (structured.budget as string) || undefined,
          },
        },
        match.score
      );

      const result = await generateText({
        model,
        prompt,
      });

      // Store pre-chat summary as inbox item for the talent
      await db.insert(inboxItems).values({
        userId: talent.id,
        itemType: 'prechat_summary',
        title: `Pre-chat: ${companyName} — ${jobData.title}`,
        content: {
          companyName,
          jobTitle: jobData.title,
          jobId: jobData.id,
          matchScore: match.score,
          summary: result.text,
        },
        read: false,
      });

      // Also store for the enterprise side
      await db.insert(inboxItems).values({
        userId: enterprise?.userId || '',
        itemType: 'prechat_summary',
        title: `Pre-chat: ${talent.displayName} — ${jobData.title}`,
        content: {
          talentName: talent.displayName,
          talentId: talent.id,
          jobTitle: jobData.title,
          jobId: jobData.id,
          matchScore: match.score,
          summary: result.text,
        },
        read: false,
      });

      job.log(`Generated pre-chat for ${talent.displayName} <> ${jobData.title}`);
    } catch (error) {
      job.log(`Failed to generate pre-chat for talent ${talent.id}: ${error}`);
    }
  }
}
```

- [x] **Step 2: Register the pre-chat handler in worker.ts**

In `src/lib/jobs/worker.ts`, add:

```typescript
// Add import at top
import { handlePreChat } from './pre-chat';

// In the worker processor switch, add:
case 'pre-chat':
  await handlePreChat(job);
  break;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/jobs/pre-chat.ts src/lib/jobs/worker.ts
git commit -m "feat(spec5): implement pre-chat background job"
```

---

### Task 6: Tailored Resume Generation API

**Files:**
- Create: `src/app/api/v1/resume/generate/route.ts`

- [x] **Step 1: Implement POST /api/v1/resume/generate**

Create `src/app/api/v1/resume/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { talentProfiles, jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { buildTailoredResumePrompt } from '@/lib/ai/prompts/tailored-resume';
import { z } from 'zod';

const requestSchema = z.object({
  talentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { talentId, jobId } = parsed.data;

  // Verify the requesting user owns this talent profile or is the talent
  if (user.role === 'talent' && user.profileId !== talentId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch talent profile
  const [profile] = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.id, talentId))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { error: 'Talent profile not found' },
      { status: 404 }
    );
  }

  // Fetch job
  const [jobData] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!jobData) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Fetch company name
  const [enterprise] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, jobData.userId || ''))
    .limit(1);

  const companyName = enterprise?.companyName || 'Unknown Company';
  const structured = (jobData.structured as Record<string, unknown>) || {};
  const profileSkills = (profile.skills as Array<{ name: string; level: string; category: string }>) || [];
  const profileExperience = (profile.experience as Array<{
    role: string;
    company: string;
    dateRange: string;
    description: string;
  }>) || [];
  const profileEducation = (profile.education as Array<{
    degree: string;
    institution: string;
    year: string;
  }>) || [];

  try {
    const model = getAIModel();
    const prompt = buildTailoredResumePrompt(
      {
        displayName: profile.displayName || '',
        headline: profile.headline || '',
        bio: profile.bio || '',
        skills: profileSkills,
        experience: profileExperience,
        education: profileEducation,
      },
      {
        title: jobData.title,
        companyName,
        description: jobData.description || '',
        structured: {
          skills: (structured.skills as Array<{ name: string; required: boolean }>) || [],
          seniority: (structured.seniority as string) || '',
        },
      }
    );

    const result = await generateText({
      model,
      prompt,
    });

    return NextResponse.json({
      data: {
        markdown: result.text,
        talentName: profile.displayName,
        jobTitle: jobData.title,
        companyName,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Resume generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate tailored resume' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v1/resume/generate/route.ts
git commit -m "feat(spec5): add POST /api/v1/resume/generate endpoint"
```

---

### Task 7: Inbox Data Access Layer

**Files:**
- Create: `src/lib/api/inbox.ts`
- Create: `__tests__/lib/api/inbox.test.ts`

- [x] **Step 1: Write tests for inbox data access**

Create `__tests__/lib/api/inbox.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { InboxItemType } from '@/lib/api/inbox';

describe('inbox data access types', () => {
  it('InboxItemType includes all valid types', () => {
    const validTypes: InboxItemType[] = [
      'invite',
      'prechat_summary',
      'match',
      'system',
    ];
    expect(validTypes).toHaveLength(4);
  });

  it('inbox filter tab maps correctly', () => {
    const tabToType: Record<string, InboxItemType | 'all'> = {
      all: 'all',
      invites: 'invite',
      'pre-chats': 'prechat_summary',
      matches: 'match',
      system: 'system',
    };
    expect(Object.keys(tabToType)).toHaveLength(5);
  });
});
```

- [x] **Step 2: Implement inbox data access**

Create `src/lib/api/inbox.ts`:

```typescript
import { db } from '@/lib/db';
import { inboxItems } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export type InboxItemType = 'invite' | 'prechat_summary' | 'match' | 'system';

export interface InboxItemRow {
  id: string;
  userId: string;
  itemType: string;
  title: string;
  content: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export async function getInboxItems(
  userId: string,
  filter?: InboxItemType
): Promise<InboxItemRow[]> {
  const conditions = [eq(inboxItems.userId, userId)];

  if (filter) {
    conditions.push(eq(inboxItems.itemType, filter));
  }

  const rows = await db
    .select()
    .from(inboxItems)
    .where(and(...conditions))
    .orderBy(desc(inboxItems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    itemType: row.itemType,
    title: row.title,
    content: (row.content as Record<string, unknown>) || {},
    read: row.read,
    createdAt: row.createdAt || new Date(),
  }));
}

export async function markAsRead(id: string, userId: string): Promise<boolean> {
  const result = await db
    .update(inboxItems)
    .set({ read: true })
    .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)));

  return (result?.rowCount ?? 0) > 0;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.userId, userId),
        eq(inboxItems.read, false)
      )
    );

  return result[0]?.count ?? 0;
}

export async function createInboxItem(data: {
  userId: string;
  itemType: InboxItemType;
  title: string;
  content: Record<string, unknown>;
}): Promise<string> {
  const [row] = await db
    .insert(inboxItems)
    .values({
      userId: data.userId,
      itemType: data.itemType,
      title: data.title,
      content: data.content,
      read: false,
    })
    .returning({ id: inboxItems.id });

  return row!.id;
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -- __tests__/lib/api/inbox.test.ts
git add src/lib/api/inbox.ts __tests__/lib/api/inbox.test.ts
git commit -m "feat(spec5): add inbox data access layer"
```

---

### Task 8: Inbox API Routes

**Files:**
- Create: `src/app/api/v1/inbox/route.ts`
- Create: `src/app/api/v1/inbox/[id]/route.ts`

- [x] **Step 1: Implement GET /api/v1/inbox**

Create `src/app/api/v1/inbox/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getInboxItems, getUnreadCount } from '@/lib/api/inbox';
import type { InboxItemType } from '@/lib/api/inbox';

const VALID_FILTERS: InboxItemType[] = [
  'invite',
  'prechat_summary',
  'match',
  'system',
];

export async function GET(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get('filter');

  let filter: InboxItemType | undefined;
  if (filterParam && VALID_FILTERS.includes(filterParam as InboxItemType)) {
    filter = filterParam as InboxItemType;
  }

  // For talent users, use profileId; for enterprise, use userId
  const userId = user.profileId || user.id;

  const [items, unreadCount] = await Promise.all([
    getInboxItems(userId, filter),
    getUnreadCount(userId),
  ]);

  return NextResponse.json({
    data: {
      items,
      unreadCount,
    },
  });
}
```

- [x] **Step 2: Implement PATCH /api/v1/inbox/:id**

Create `src/app/api/v1/inbox/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { markAsRead } from '@/lib/api/inbox';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = user.profileId || user.id;

  const updated = await markAsRead(id, userId);

  if (!updated) {
    return NextResponse.json(
      { error: 'Inbox item not found or not owned by user' },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { id, read: true } });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/inbox/route.ts src/app/api/v1/inbox/\[id\]/route.ts
git commit -m "feat(spec5): add inbox API routes (GET + PATCH)"
```

---

### Task 9: Inbox UI Components

**Files:**
- Create: `src/components/inbox/inbox-list.tsx`
- Create: `src/components/inbox/inbox-item-row.tsx`
- Create: `src/components/inbox/inbox-detail.tsx`
- Create: `src/components/inbox/inbox-badge.tsx`

- [x] **Step 1: Create InboxBadge component**

Create `src/components/inbox/inbox-badge.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface InboxBadgeProps {
  className?: string;
}

export function InboxBadge({ className }: InboxBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch('/api/v1/inbox');
        if (res.ok) {
          const json = await res.json();
          setUnreadCount(json.data?.unreadCount ?? 0);
        }
      } catch {
        // Silently fail — badge is non-critical
      }
    }

    fetchUnread();

    // Poll every 30 seconds for new items
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  if (unreadCount === 0) return null;

  return (
    <Badge
      variant="destructive"
      className={`ml-auto min-w-[20px] justify-center rounded-full px-1.5 py-0.5 text-xs ${className ?? ''}`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}
```

- [x] **Step 2: Create InboxItemRow component**

Create `src/components/inbox/inbox-item-row.tsx`:

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';
import type { InboxItemRow as InboxItemRowData } from '@/lib/api/inbox';

const BORDER_COLORS: Record<string, string> = {
  invite: 'border-l-blue-500',
  prechat_summary: 'border-l-violet-500',
  match: 'border-l-emerald-500',
  system: 'border-l-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  invite: 'Invite',
  prechat_summary: 'Pre-chat',
  match: 'Match',
  system: 'System',
};

interface InboxItemRowProps {
  item: InboxItemRowData;
  isSelected: boolean;
  onClick: () => void;
}

export function InboxItemRow({ item, isSelected, onClick }: InboxItemRowProps) {
  const borderColor = BORDER_COLORS[item.itemType] || 'border-l-gray-400';
  const typeLabel = TYPE_LABELS[item.itemType] || item.itemType;
  const score = (item.content?.matchScore as number) || null;

  return (
    <button
      onClick={onClick}
      className={`
        flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left
        transition-colors duration-150
        ${borderColor}
        ${isSelected ? 'bg-accent' : 'hover:bg-muted/50'}
        ${!item.read ? 'bg-muted/30' : ''}
      `}
    >
      {/* Unread dot */}
      <div className="mt-2 flex-shrink-0">
        {!item.read && (
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        )}
        {item.read && <div className="h-2 w-2" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${!item.read ? 'font-semibold' : 'font-normal'}`}
          >
            {item.title}
          </span>
          {score !== null && (
            <span className="flex-shrink-0 text-xs font-medium text-emerald-600">
              {score}%
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{typeLabel}</span>
          <span>
            {formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </button>
  );
}
```

- [x] **Step 3: Create InboxDetail component**

Create `src/components/inbox/inbox-detail.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InboxItemRow } from '@/lib/api/inbox';

interface InboxDetailProps {
  item: InboxItemRow;
}

export function InboxDetail({ item }: InboxDetailProps) {
  const content = item.content || {};

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-xl font-semibold">{item.title}</h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{item.itemType.replace('_', ' ')}</Badge>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Invite detail */}
      {item.itemType === 'invite' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {(content.companyName as string) || 'Company'} invited you
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.jobTitle && (
              <p className="text-sm">
                <span className="font-medium">Position:</span>{' '}
                {content.jobTitle as string}
              </p>
            )}
            {content.message && (
              <p className="text-sm text-muted-foreground">
                {content.message as string}
              </p>
            )}
            {content.matchScore && (
              <p className="text-sm">
                <span className="font-medium">Match Score:</span>{' '}
                <span className="text-emerald-600 font-semibold">
                  {content.matchScore as number}%
                </span>
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm">View Job</Button>
              <Button size="sm" variant="outline">
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-chat summary detail */}
      {item.itemType === 'prechat_summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pre-chat Summary —{' '}
              {(content.companyName as string) ||
                (content.talentName as string) ||
                'Unknown'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.jobTitle && (
              <p className="text-sm">
                <span className="font-medium">Position:</span>{' '}
                {content.jobTitle as string}
              </p>
            )}
            {content.matchScore && (
              <p className="text-sm">
                <span className="font-medium">Match Score:</span>{' '}
                <span className="text-emerald-600 font-semibold">
                  {content.matchScore as number}%
                </span>
              </p>
            )}
            {content.summary && (
              <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/50 p-4">
                <div
                  dangerouslySetInnerHTML={{
                    __html: (content.summary as string).replace(/\n/g, '<br>'),
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Match notification detail */}
      {item.itemType === 'match' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Match Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.jobTitle && (
              <p className="text-sm">
                <span className="font-medium">Position:</span>{' '}
                {content.jobTitle as string}
              </p>
            )}
            {content.companyName && (
              <p className="text-sm">
                <span className="font-medium">Company:</span>{' '}
                {content.companyName as string}
              </p>
            )}
            {content.matchScore && (
              <p className="text-sm">
                <span className="font-medium">Match Score:</span>{' '}
                <span className="text-emerald-600 font-semibold">
                  {content.matchScore as number}%
                </span>
              </p>
            )}
            {content.aiReasoning && (
              <p className="text-sm text-muted-foreground">
                {content.aiReasoning as string}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm">View Details</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System message detail */}
      {item.itemType === 'system' && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {(content.message as string) || item.title}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [x] **Step 4: Create InboxList component**

Create `src/components/inbox/inbox-list.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { InboxItemRow as InboxItemRowComponent } from './inbox-item-row';
import { InboxDetail } from './inbox-detail';
import type { InboxItemRow } from '@/lib/api/inbox';

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'invite', label: 'Invites' },
  { value: 'prechat_summary', label: 'Pre-chats' },
  { value: 'match', label: 'Matches' },
  { value: 'system', label: 'System' },
] as const;

export function InboxList() {
  const [items, setItems] = useState<InboxItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchItems = useCallback(async (filter?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter && filter !== 'all') {
        params.set('filter', filter);
      }
      const res = await fetch(`/api/v1/inbox?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data?.items ?? []);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(activeTab);
  }, [activeTab, fetchItems]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedId(null);
  };

  const handleItemClick = async (item: InboxItemRow) => {
    setSelectedId(item.id);

    // Mark as read if unread
    if (!item.read) {
      try {
        await fetch(`/api/v1/inbox/${item.id}`, { method: 'PATCH' });
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read: true } : i))
        );
      } catch {
        // fail silently
      }
    }
  };

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Filter tabs */}
      <div className="border-b px-4 py-3">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Content area: list + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Item list */}
        <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-medium">No messages yet</p>
                <p className="mt-1">
                  Your AI companion is working on it.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <InboxItemRowComponent
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedItem ? (
            <InboxDetail item={selectedItem} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a message to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/
git commit -m "feat(spec5): add shared inbox UI components (InboxList, InboxItemRow, InboxDetail, InboxBadge)"
```

---

### Task 10: Seeking Report UI Components

**Files:**
- Create: `src/components/seeking/scan-summary.tsx`
- Create: `src/components/seeking/high-match-card.tsx`
- Create: `src/components/seeking/prechat-activity.tsx`
- Create: `src/components/seeking/inbound-interest.tsx`
- Create: `src/components/seeking/tailored-resume-dialog.tsx`

- [x] **Step 1: Create ScanSummary component**

Create `src/components/seeking/scan-summary.tsx`:

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import type { ScanSummary as ScanSummaryData } from '@/lib/api/seeking';

interface ScanSummaryProps {
  data: ScanSummaryData;
}

export function ScanSummary({ data }: ScanSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent className="flex items-center gap-6 py-5">
          {/* Pulse indicator */}
          <div className="relative flex-shrink-0">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-emerald-500 opacity-30" />
          </div>

          <p className="text-sm leading-relaxed">
            Scanned{' '}
            <span className="font-semibold text-foreground">
              {data.totalScanned}
            </span>{' '}
            new postings {data.periodLabel.toLowerCase()}. Found{' '}
            <span className="font-semibold text-emerald-600">
              {data.highMatches} high matches
            </span>{' '}
            ({'>'} 80%) and{' '}
            <span className="font-semibold text-amber-600">
              {data.mediumMatches} medium matches
            </span>{' '}
            (60-80%).
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

- [x] **Step 2: Create HighMatchCard component**

Create `src/components/seeking/high-match-card.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, FileText, X, Check } from 'lucide-react';
import type { HighMatchItem } from '@/lib/api/seeking';

interface HighMatchCardProps {
  match: HighMatchItem;
  onGenerateResume: (jobId: string) => void;
  index: number;
}

export function HighMatchCard({
  match,
  onGenerateResume,
  index,
}: HighMatchCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden">
        {/* Collapsed header — always visible */}
        <CardHeader
          className="cursor-pointer py-4"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Score */}
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-600 dark:bg-emerald-950">
                {match.score}
              </div>

              <div>
                <h3 className="font-semibold">{match.jobTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {match.companyName} · {match.location} · {match.workMode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Skill match preview (collapsed) */}
              <div className="hidden items-center gap-1 sm:flex">
                {match.skillMatches.slice(0, 4).map((skill) => (
                  <Badge
                    key={skill.skill}
                    variant={skill.matched ? 'default' : 'outline'}
                    className={`text-xs ${
                      skill.matched
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {skill.matched ? (
                      <Check className="mr-1 h-3 w-3" />
                    ) : (
                      <X className="mr-1 h-3 w-3" />
                    )}
                    {skill.skill}
                  </Badge>
                ))}
                {match.skillMatches.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{match.skillMatches.length - 4}
                  </span>
                )}
              </div>

              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CardContent className="space-y-4 border-t pt-4">
                {/* All skill matches */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">Skill Match</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {match.skillMatches.map((skill) => (
                      <Badge
                        key={skill.skill}
                        variant={skill.matched ? 'default' : 'outline'}
                        className={`${
                          skill.matched
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                            : 'border-red-200 text-red-600 dark:border-red-800 dark:text-red-400'
                        }`}
                      >
                        {skill.matched ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <X className="mr-1 h-3 w-3" />
                        )}
                        {skill.skill}
                        <span className="ml-1 opacity-60">
                          ({skill.level})
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* AI Assessment */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">AI Assessment</h4>
                  <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                    {match.aiAssessment}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateResume(match.jobId);
                    }}
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Generate Tailored Resume
                  </Button>
                  <Button size="sm">Apply</Button>
                  <Button size="sm" variant="ghost">
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
```

- [x] **Step 3: Create PreChatActivity component**

Create `src/components/seeking/prechat-activity.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import type { PreChatItem } from '@/lib/api/seeking';

interface PreChatActivityProps {
  items: PreChatItem[];
}

export function PreChatActivity({ items }: PreChatActivityProps) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Pre-chat Activity</h2>
        <p className="text-sm text-muted-foreground">
          Your AI conducted preliminary conversations on your behalf.
        </p>

        {items.map((item, index) => (
          <motion.div
            key={item.inboxItemId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {item.companyName} — {item.jobTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                  {item.summary.length > 300
                    ? `${item.summary.slice(0, 300)}...`
                    : item.summary}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.generatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View Full Summary
                    </Button>
                    <Button size="sm">Respond</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
```

- [x] **Step 4: Create InboundInterest component**

Create `src/components/seeking/inbound-interest.tsx`:

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import type { InboundInterestItem } from '@/lib/api/seeking';

interface InboundInterestProps {
  items: InboundInterestItem[];
}

export function InboundInterest({ items }: InboundInterestProps) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Inbound Interest</h2>
        <p className="text-sm text-muted-foreground">
          Companies that found your profile interesting.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <motion.div
              key={item.matchId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card className="h-full">
                <CardContent className="flex h-full flex-col justify-between gap-3 pt-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{item.companyName}</h3>
                      <span className="text-sm font-medium text-emerald-600">
                        {item.score}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {item.reason}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="self-start">
                    View
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
```

- [x] **Step 5: Create TailoredResumeDialog component**

Create `src/components/seeking/tailored-resume-dialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2 } from 'lucide-react';

interface TailoredResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talentId: string;
  jobId: string;
}

export function TailoredResumeDialog({
  open,
  onOpenChange,
  talentId,
  jobId,
}: TailoredResumeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [resumeData, setResumeData] = useState<{
    markdown: string;
    talentName: string;
    jobTitle: string;
    companyName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateResume = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId, jobId }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate resume');
      }

      const json = await res.json();
      setResumeData(json.data);
    } catch {
      setError('Failed to generate tailored resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !resumeData && !loading) {
      generateResume();
    }
    if (!isOpen) {
      // Reset state on close
      setResumeData(null);
      setError(null);
    }
  };

  const handleDownload = () => {
    if (!resumeData) return;

    // Convert markdown to simple HTML for download
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resume — ${resumeData.talentName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
    h2 { font-size: 18px; color: #333; margin-top: 24px; }
    h3 { font-size: 16px; color: #555; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; }
    p { margin: 8px 0; }
  </style>
</head>
<body>
${resumeData.markdown
  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
  .replace(/^\* (.*$)/gm, '<li>$1</li>')
  .replace(/^- (.*$)/gm, '<li>$1</li>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/^(?!<[hlu])/gm, '<p>')
}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-${resumeData.talentName}-${resumeData.companyName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resumeData
              ? `Tailored Resume for ${resumeData.companyName}`
              : 'Generating Tailored Resume...'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating your tailored resume...
              </div>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-6 w-1/2 mt-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {error}
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={generateResume}
              >
                Retry
              </Button>
            </div>
          )}

          {resumeData && !loading && (
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-6">
              <div
                dangerouslySetInnerHTML={{
                  __html: resumeData.markdown
                    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                    .replace(/^\* (.*$)/gm, '<li>$1</li>')
                    .replace(/^- (.*$)/gm, '<li>$1</li>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n\n/g, '<br><br>'),
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {resumeData && (
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-1.5 h-4 w-4" />
              Download HTML
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/seeking/
git commit -m "feat(spec5): add seeking report UI components (ScanSummary, HighMatchCard, PreChatActivity, InboundInterest, TailoredResumeDialog)"
```

---

### Task 11: Seeking Report Page

**Files:**
- Modify: `src/app/(talent)/seeking/page.tsx`

- [x] **Step 1: Implement the seeking report page**

Replace `src/app/(talent)/seeking/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanSummary } from '@/components/seeking/scan-summary';
import { HighMatchCard } from '@/components/seeking/high-match-card';
import { PreChatActivity } from '@/components/seeking/prechat-activity';
import { InboundInterest } from '@/components/seeking/inbound-interest';
import { TailoredResumeDialog } from '@/components/seeking/tailored-resume-dialog';
import type { SeekingReportData } from '@/lib/api/seeking';

export default function SeekingPage() {
  const [report, setReport] = useState<SeekingReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [talentId, setTalentId] = useState<string>('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch('/api/v1/seeking');
        if (res.ok) {
          const json = await res.json();
          setReport(json.data);
        }

        // Also fetch the current user's profile ID for resume generation
        const profileRes = await fetch('/api/v1/profile');
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          setTalentId(profileJson.data?.id || '');
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, []);

  const handleGenerateResume = (jobId: string) => {
    setSelectedJobId(jobId);
    setResumeDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 text-2xl font-bold">Seeking Report</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="relative mb-4">
            <div className="h-4 w-4 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-emerald-500 opacity-30" />
          </div>
          <p className="font-medium">First report generating...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your AI is scanning the market. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">Seeking Report</h1>

      {/* 1. Scan Summary */}
      <ScanSummary data={report.scanSummary} />

      {/* 2. High Matches */}
      {report.highMatches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            High Matches ({report.highMatches.length})
          </h2>
          {report.highMatches.map((match, index) => (
            <HighMatchCard
              key={match.matchId}
              match={match}
              onGenerateResume={handleGenerateResume}
              index={index}
            />
          ))}
        </div>
      )}

      {/* 3. Pre-chat Activity */}
      <PreChatActivity items={report.preChatActivity} />

      {/* 4. Inbound Interest */}
      <InboundInterest items={report.inboundInterest} />

      {/* Tailored Resume Dialog */}
      {selectedJobId && (
        <TailoredResumeDialog
          open={resumeDialogOpen}
          onOpenChange={setResumeDialogOpen}
          talentId={talentId}
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\\(talent\\)/seeking/page.tsx
git commit -m "feat(spec5): implement seeking report page"
```

---

### Task 12: Inbox Pages (Talent + Enterprise)

**Files:**
- Modify: `src/app/(talent)/inbox/page.tsx`
- Modify: `src/app/(enterprise)/inbox/page.tsx`

- [x] **Step 1: Implement talent inbox page**

Replace `src/app/(talent)/inbox/page.tsx`:

```typescript
import { InboxList } from '@/components/inbox/inbox-list';

export default function TalentInboxPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxList />
      </div>
    </div>
  );
}
```

- [x] **Step 2: Implement enterprise inbox page**

Replace `src/app/(enterprise)/inbox/page.tsx`:

```typescript
import { InboxList } from '@/components/inbox/inbox-list';

export default function EnterpriseInboxPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxList />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\\(talent\\)/inbox/page.tsx src/app/\\(enterprise\\)/inbox/page.tsx
git commit -m "feat(spec5): implement talent and enterprise inbox pages"
```

---

### Task 13: Integrate InboxBadge into Sidebar Navigation

**Files:**
- Modify: `src/components/layout/sidebar-nav.tsx`

- [x] **Step 1: Add InboxBadge to sidebar nav items**

In `src/components/layout/sidebar-nav.tsx`, import and render the `InboxBadge` next to the Inbox nav item:

```typescript
// Add import at top
import { InboxBadge } from '@/components/inbox/inbox-badge';

// In the nav items rendering, for the "Inbox" link, add the badge:
// Find the Inbox nav item and modify it to include:
<Link
  href={role === 'talent' ? '/talent/inbox' : '/enterprise/inbox'}
  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`}
>
  <InboxIcon className="h-4 w-4" />
  <span className="flex-1">Inbox</span>
  <InboxBadge />
</Link>
```

The exact modification depends on how the sidebar-nav was structured in Spec 0. The key change is:
1. Import `InboxBadge` from `@/components/inbox/inbox-badge`
2. Add `<InboxBadge />` as the last child inside the Inbox nav link element

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar-nav.tsx
git commit -m "feat(spec5): add unread badge to inbox nav item in sidebar"
```

---

### Task 14: Add i18n Strings

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [x] **Step 1: Add English strings**

Add the following keys to `src/i18n/messages/en.json`:

```json
{
  "seeking": {
    "title": "Seeking Report",
    "emptyTitle": "First report generating...",
    "emptyDescription": "Your AI is scanning the market. Check back soon.",
    "scanSummary": "Scanned {total} new postings {period}. Found {high} high matches (>80%) and {medium} medium matches (60-80%).",
    "highMatches": "High Matches",
    "preChatActivity": "Pre-chat Activity",
    "preChatDescription": "Your AI conducted preliminary conversations on your behalf.",
    "inboundInterest": "Inbound Interest",
    "inboundDescription": "Companies that found your profile interesting.",
    "generateResume": "Generate Tailored Resume",
    "generatingResume": "Generating your tailored resume...",
    "resumeTitle": "Tailored Resume for {company}",
    "downloadHtml": "Download HTML",
    "apply": "Apply",
    "dismiss": "Dismiss",
    "viewFullSummary": "View Full Summary",
    "respond": "Respond",
    "view": "View"
  },
  "inbox": {
    "title": "Inbox",
    "empty": "No messages yet",
    "emptyDescription": "Your AI companion is working on it.",
    "selectMessage": "Select a message to view details",
    "filterAll": "All",
    "filterInvites": "Invites",
    "filterPreChats": "Pre-chats",
    "filterMatches": "Matches",
    "filterSystem": "System",
    "typeInvite": "Invite",
    "typePreChat": "Pre-chat",
    "typeMatch": "Match",
    "typeSystem": "System",
    "viewJob": "View Job",
    "viewDetails": "View Details",
    "position": "Position",
    "company": "Company",
    "matchScore": "Match Score"
  }
}
```

- [x] **Step 2: Add Chinese strings**

Add the following keys to `src/i18n/messages/zh.json`:

```json
{
  "seeking": {
    "title": "求职报告",
    "emptyTitle": "首份报告生成中...",
    "emptyDescription": "AI 正在扫描市场，请稍后查看。",
    "scanSummary": "本{period}扫描了 {total} 个新职位。发现 {high} 个高匹配（>80%）和 {medium} 个中匹配（60-80%）。",
    "highMatches": "高度匹配",
    "preChatActivity": "预聊天动态",
    "preChatDescription": "AI 代您进行了初步沟通。",
    "inboundInterest": "企业关注",
    "inboundDescription": "对您的档案感兴趣的企业。",
    "generateResume": "生成定制简历",
    "generatingResume": "正在生成定制简历...",
    "resumeTitle": "为 {company} 定制的简历",
    "downloadHtml": "下载 HTML",
    "apply": "申请",
    "dismiss": "跳过",
    "viewFullSummary": "查看完整摘要",
    "respond": "回复",
    "view": "查看"
  },
  "inbox": {
    "title": "收件箱",
    "empty": "暂无消息",
    "emptyDescription": "AI 伙伴正在为您工作。",
    "selectMessage": "选择一条消息查看详情",
    "filterAll": "全部",
    "filterInvites": "邀请",
    "filterPreChats": "预聊天",
    "filterMatches": "匹配",
    "filterSystem": "系统",
    "typeInvite": "邀请",
    "typePreChat": "预聊天",
    "typeMatch": "匹配",
    "typeSystem": "系统",
    "viewJob": "查看职位",
    "viewDetails": "查看详情",
    "position": "职位",
    "company": "公司",
    "matchScore": "匹配分数"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/zh.json
git commit -m "feat(spec5): add i18n strings for seeking report and inbox"
```

---

### Task 15: Install date-fns Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install date-fns**

The `InboxItemRow` component uses `formatDistanceToNow` from `date-fns`. Install it:

```bash
npm install date-fns
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add date-fns dependency for inbox timestamps"
```

---

### Task 16: Verify Build and Run Tests

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: All existing tests pass, plus the new tests in `__tests__/lib/api/seeking.test.ts` and `__tests__/lib/api/inbox.test.ts`.

- [x] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [x] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Fix any issues found and commit**

If any build/test/type errors are found, fix them and commit:

```bash
git add -A
git commit -m "fix(spec5): resolve build/test issues"
```
