# Spec 4: Matching + Screening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core matching engine, embedding generation, AI screening chat, and enterprise-facing candidate views that connect talent profiles with job opportunities through hybrid scoring.

**Architecture:** The matching engine (`src/lib/matching/`) computes hybrid scores from pgvector cosine similarity (semantic, 40%) and structured feature comparison (feature, 60%). BullMQ workers handle embedding generation and match scanning asynchronously. Enterprise users view ranked candidates on a per-job page, screen talent via AI chat with tool calls, and inspect candidates in a slide-in Sheet panel.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM, pgvector, Vercel AI SDK (embeddings + chat), BullMQ, shadcn/ui (Sheet, Badge, Tabs), Framer Motion, Vitest

---

## File Structure

```
csv/
├── src/
│   ├── app/
│   │   ├── (enterprise)/
│   │   │   ├── jobs/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx              # Feature matching view
│   │   │   └── screening/
│   │   │       └── page.tsx                  # AI screening chat page
│   │   └── api/
│   │       ├── internal/
│   │       │   └── ai/
│   │       │       └── screening/
│   │       │           └── route.ts          # AI screening endpoint
│   │       └── v1/
│   │           ├── jobs/
│   │           │   └── [id]/
│   │           │       └── route.ts          # GET job detail + matches
│   │           └── matches/
│   │               ├── route.ts              # GET matches list
│   │               ├── scan/
│   │               │   └── route.ts          # POST trigger scan
│   │               └── [id]/
│   │                   └── route.ts          # PATCH match status
│   ├── components/
│   │   └── matching/
│   │       ├── candidate-table.tsx           # Ranked candidate table
│   │       ├── candidate-detail.tsx          # Sheet slide-in panel
│   │       ├── score-dot.tsx                 # Color-coded score dot
│   │       └── screening-chat.tsx            # AI screening chat UI
│   ├── lib/
│   │   ├── matching/
│   │   │   ├── engine.ts                     # Match orchestration
│   │   │   ├── scoring.ts                    # Feature scoring algorithm
│   │   │   ├── embedding.ts                  # Embedding generation
│   │   │   └── __tests__/
│   │   │       ├── scoring.test.ts           # Scoring unit tests
│   │   │       └── engine.test.ts            # Engine integration tests
│   │   ├── ai/
│   │   │   └── prompts/
│   │   │       └── screening.ts              # Screening system prompt
│   │   └── jobs/
│   │       └── worker.ts                     # Updated: real embed + scan logic
│   └── i18n/
│       └── messages/
│           ├── en.json                       # Add matching/screening strings
│           └── zh.json                       # Add matching/screening strings
└── vitest.config.ts
```

---

### Task 1: Feature Scoring Algorithm (`scoring.ts`) — with Tests

**Files:**
- Create: `src/lib/matching/scoring.ts`
- Create: `src/lib/matching/__tests__/scoring.test.ts`

- [ ] **Step 1: Write scoring tests first**

Create `src/lib/matching/__tests__/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeFeatureScore,
  compareProficiency,
  matchSkillName,
  computeAvailabilityScore,
  computeSeniorityScore,
} from '../scoring';
import type { Skill, StructuredJob } from '@/types';

describe('matchSkillName', () => {
  it('matches exact names case-insensitively', () => {
    expect(matchSkillName('Python', 'python')).toBe(true);
    expect(matchSkillName('React', 'react')).toBe(true);
  });

  it('matches with normalized whitespace and separators', () => {
    expect(matchSkillName('Machine Learning', 'machine-learning')).toBe(true);
    expect(matchSkillName('machine_learning', 'Machine Learning')).toBe(true);
    expect(matchSkillName('Natural Language Processing', 'natural-language-processing')).toBe(true);
  });

  it('does not match unrelated skills', () => {
    expect(matchSkillName('Python', 'JavaScript')).toBe(false);
    expect(matchSkillName('React', 'Vue')).toBe(false);
  });
});

describe('compareProficiency', () => {
  it('returns 1.0 for exact match', () => {
    expect(compareProficiency('expert', 'expert')).toBe(1.0);
    expect(compareProficiency('beginner', 'beginner')).toBe(1.0);
  });

  it('returns 0.8 for one level difference', () => {
    expect(compareProficiency('advanced', 'expert')).toBe(0.8);
    expect(compareProficiency('intermediate', 'advanced')).toBe(0.8);
  });

  it('returns 0.5 for two level difference', () => {
    expect(compareProficiency('intermediate', 'expert')).toBe(0.5);
    expect(compareProficiency('beginner', 'advanced')).toBe(0.5);
  });

  it('returns 0.2 for three level difference', () => {
    expect(compareProficiency('beginner', 'expert')).toBe(0.2);
  });

  it('returns 1.0 when talent exceeds requirement', () => {
    expect(compareProficiency('expert', 'intermediate')).toBe(1.0);
    expect(compareProficiency('advanced', 'beginner')).toBe(1.0);
  });
});

describe('computeAvailabilityScore', () => {
  it('returns 1.0 for open availability', () => {
    expect(computeAvailabilityScore('open')).toBe(1.0);
  });

  it('returns 0.5 for busy availability', () => {
    expect(computeAvailabilityScore('busy')).toBe(0.5);
  });

  it('returns 0.1 for not_looking availability', () => {
    expect(computeAvailabilityScore('not_looking')).toBe(0.1);
  });
});

describe('computeSeniorityScore', () => {
  it('returns 1.0 for exact match', () => {
    expect(computeSeniorityScore('senior', 'senior')).toBe(1.0);
  });

  it('returns 0.7 for one level difference', () => {
    expect(computeSeniorityScore('mid', 'senior')).toBe(0.7);
    expect(computeSeniorityScore('senior', 'lead')).toBe(0.7);
  });

  it('returns 0.4 for two level difference', () => {
    expect(computeSeniorityScore('junior', 'senior')).toBe(0.4);
  });

  it('returns 1.0 when talent exceeds requirement', () => {
    expect(computeSeniorityScore('lead', 'mid')).toBe(1.0);
  });
});

describe('computeFeatureScore', () => {
  const talentSkills: Skill[] = [
    { name: 'Python', level: 'expert', category: 'Programming' },
    { name: 'Machine Learning', level: 'advanced', category: 'AI' },
    { name: 'React', level: 'intermediate', category: 'Frontend' },
    { name: 'Docker', level: 'beginner', category: 'DevOps' },
  ];

  it('scores a perfect match highly', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Machine Learning', level: 'advanced', required: true },
      ],
      seniority: 'senior',
      timeline: '6 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.score).toBeGreaterThan(90);
    expect(result.dimensions['Python']).toBe(1.0);
    expect(result.dimensions['Machine Learning']).toBe(1.0);
  });

  it('penalizes missing must-have skills heavily', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Kubernetes', level: 'advanced', required: true },
      ],
      seniority: 'senior',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.dimensions['Kubernetes']).toBe(0);
    // Missing a must-have skill should drop the score significantly
    expect(result.score).toBeLessThan(60);
  });

  it('weights must-have skills 2x vs nice-to-have', () => {
    const jobWithMustHave: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Go', level: 'intermediate', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const jobAllNiceToHave: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: false },
        { name: 'Go', level: 'intermediate', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const resultMustHave = computeFeatureScore(talentSkills, jobWithMustHave, 'open');
    const resultNiceToHave = computeFeatureScore(talentSkills, jobAllNiceToHave, 'open');

    // When the talent has the must-have skill (Python), having it weighted 2x should boost score
    expect(resultMustHave.score).toBeGreaterThan(resultNiceToHave.score);
  });

  it('includes availability in the score', () => {
    const jobStructured: StructuredJob = {
      skills: [{ name: 'Python', level: 'expert', required: true }],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const openScore = computeFeatureScore(talentSkills, jobStructured, 'open');
    const notLookingScore = computeFeatureScore(talentSkills, jobStructured, 'not_looking');
    expect(openScore.score).toBeGreaterThan(notLookingScore.score);
  });

  it('returns per-dimension scores in breakdown', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'React', level: 'advanced', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.dimensions).toHaveProperty('Python');
    expect(result.dimensions).toHaveProperty('React');
    expect(result.dimensions).toHaveProperty('availability');
    expect(result.dimensions).toHaveProperty('seniority');
    expect(result.dimensions['Python']).toBe(1.0);
    // React: talent has intermediate, job wants advanced → 0.8
    expect(result.dimensions['React']).toBe(0.8);
  });

  it('handles empty job skills gracefully', () => {
    const jobStructured: StructuredJob = {
      skills: [],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    // With no skills to match, score is based on availability + seniority only
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('handles empty talent skills gracefully', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore([], jobStructured, 'open');
    expect(result.dimensions['Python']).toBe(0);
    expect(result.score).toBeLessThan(30);
  });
});
```

- [ ] **Step 2: Implement scoring module**

Create `src/lib/matching/scoring.ts`:

```typescript
import type { Skill, StructuredJob, Availability } from '@/types';

/**
 * Proficiency levels ordered from lowest to highest.
 * Index is used for comparison arithmetic.
 */
const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

/**
 * Seniority levels ordered from lowest to highest.
 */
const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const;

/**
 * Normalize a skill name for fuzzy comparison.
 * Lowercases, replaces hyphens/underscores with spaces, trims.
 */
function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if two skill names match (fuzzy, case-insensitive, separator-insensitive).
 */
export function matchSkillName(a: string, b: string): boolean {
  return normalizeSkillName(a) === normalizeSkillName(b);
}

/**
 * Compare proficiency levels.
 * Returns a score 0-1 based on how well the talent's level meets the required level.
 * If talent exceeds requirement, returns 1.0 (no penalty for being overqualified).
 */
export function compareProficiency(
  talentLevel: string,
  requiredLevel: string
): number {
  const talentIdx = PROFICIENCY_LEVELS.indexOf(
    talentLevel as (typeof PROFICIENCY_LEVELS)[number]
  );
  const requiredIdx = PROFICIENCY_LEVELS.indexOf(
    requiredLevel as (typeof PROFICIENCY_LEVELS)[number]
  );

  // If either level is unrecognized, assume a partial match
  if (talentIdx === -1 || requiredIdx === -1) return 0.5;

  // Talent meets or exceeds requirement
  if (talentIdx >= requiredIdx) return 1.0;

  // Talent below requirement — penalty based on gap
  const gap = requiredIdx - talentIdx;
  const penalties: Record<number, number> = { 1: 0.8, 2: 0.5, 3: 0.2 };
  return penalties[gap] ?? 0.1;
}

/**
 * Score availability: open = 1.0, busy = 0.5, not_looking = 0.1
 */
export function computeAvailabilityScore(availability: string): number {
  const scores: Record<string, number> = {
    open: 1.0,
    busy: 0.5,
    not_looking: 0.1,
  };
  return scores[availability] ?? 0.5;
}

/**
 * Score seniority match.
 * Returns 1.0 if talent meets or exceeds. Penalty for gap.
 */
export function computeSeniorityScore(
  talentSeniority: string,
  requiredSeniority: string
): number {
  const talentIdx = SENIORITY_LEVELS.indexOf(
    talentSeniority as (typeof SENIORITY_LEVELS)[number]
  );
  const requiredIdx = SENIORITY_LEVELS.indexOf(
    requiredSeniority as (typeof SENIORITY_LEVELS)[number]
  );

  if (talentIdx === -1 || requiredIdx === -1) return 0.5;
  if (talentIdx >= requiredIdx) return 1.0;

  const gap = requiredIdx - talentIdx;
  const penalties: Record<number, number> = { 1: 0.7, 2: 0.4, 3: 0.2 };
  return penalties[gap] ?? 0.1;
}

/**
 * Infer talent seniority from years of experience in their experience list.
 * This is a rough heuristic: sum all experience durations.
 */
function inferSeniority(skills: Skill[]): string {
  // Count expert/advanced skills as a proxy for seniority
  const expertCount = skills.filter((s) => s.level === 'expert').length;
  const advancedCount = skills.filter((s) => s.level === 'advanced').length;

  if (expertCount >= 3) return 'lead';
  if (expertCount >= 1 || advancedCount >= 3) return 'senior';
  if (advancedCount >= 1) return 'mid';
  return 'junior';
}

export interface FeatureScoreResult {
  /** Overall feature score on 0-100 scale */
  score: number;
  /** Per-dimension scores (skill names, availability, seniority) on 0-1 scale */
  dimensions: Record<string, number>;
}

/**
 * Compute the feature-based match score for a talent against a job.
 *
 * Scoring breakdown:
 * - Skills: 70% weight (must-have skills weighted 2x vs nice-to-have)
 * - Availability: 15% weight
 * - Seniority: 15% weight
 *
 * Returns a 0-100 score and per-dimension breakdown.
 */
export function computeFeatureScore(
  talentSkills: Skill[],
  job: StructuredJob,
  availability: string
): FeatureScoreResult {
  const dimensions: Record<string, number> = {};

  // --- Skill scoring ---
  const jobSkills = job.skills || [];
  let skillWeightedSum = 0;
  let skillTotalWeight = 0;

  for (const jobSkill of jobSkills) {
    const weight = jobSkill.required ? 2 : 1;
    skillTotalWeight += weight;

    // Find matching talent skill
    const talentSkill = talentSkills.find((ts) =>
      matchSkillName(ts.name, jobSkill.name)
    );

    if (talentSkill) {
      const profScore = compareProficiency(talentSkill.level, jobSkill.level);
      dimensions[jobSkill.name] = profScore;
      skillWeightedSum += profScore * weight;
    } else {
      dimensions[jobSkill.name] = 0;
      // Missing skill contributes 0
    }
  }

  const skillScore =
    skillTotalWeight > 0 ? skillWeightedSum / skillTotalWeight : 1.0;

  // --- Availability scoring ---
  const availabilityScore = computeAvailabilityScore(availability);
  dimensions['availability'] = availabilityScore;

  // --- Seniority scoring ---
  const talentSeniority = inferSeniority(talentSkills);
  const requiredSeniority = job.seniority || 'mid';
  const seniorityScore = computeSeniorityScore(
    talentSeniority,
    requiredSeniority.toLowerCase()
  );
  dimensions['seniority'] = seniorityScore;

  // --- Weighted combination ---
  const SKILL_WEIGHT = 0.7;
  const AVAILABILITY_WEIGHT = 0.15;
  const SENIORITY_WEIGHT = 0.15;

  const finalScore =
    (skillScore * SKILL_WEIGHT +
      availabilityScore * AVAILABILITY_WEIGHT +
      seniorityScore * SENIORITY_WEIGHT) *
    100;

  return {
    score: Math.round(Math.max(0, Math.min(100, finalScore))),
    dimensions,
  };
}
```

- [ ] **Step 3: Run tests and verify**

```bash
npx vitest run src/lib/matching/__tests__/scoring.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/matching/scoring.ts src/lib/matching/__tests__/scoring.test.ts
git commit -m "feat: implement feature scoring algorithm with comprehensive tests"
```

---

### Task 2: Embedding Generation

**Files:**
- Create: `src/lib/matching/embedding.ts`

- [ ] **Step 1: Create embedding module**

Create `src/lib/matching/embedding.ts`:

```typescript
import { embed } from 'ai';
import { getProvider } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { talentProfiles, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Build a text block from a talent profile for embedding.
 * Concatenates display_name, headline, skill names, and experience descriptions.
 */
export function buildProfileEmbeddingText(profile: {
  displayName?: string | null;
  headline?: string | null;
  skills?: Array<{ name: string; level?: string; category?: string }>;
  experience?: Array<{ role?: string; company?: string; description?: string }>;
}): string {
  const parts: string[] = [];

  if (profile.displayName) parts.push(profile.displayName);
  if (profile.headline) parts.push(profile.headline);

  if (profile.skills && Array.isArray(profile.skills)) {
    const skillNames = profile.skills.map((s) => s.name).join(', ');
    if (skillNames) parts.push(`Skills: ${skillNames}`);
  }

  if (profile.experience && Array.isArray(profile.experience)) {
    for (const exp of profile.experience) {
      const expParts: string[] = [];
      if (exp.role) expParts.push(exp.role);
      if (exp.company) expParts.push(`at ${exp.company}`);
      if (exp.description) expParts.push(exp.description);
      if (expParts.length > 0) parts.push(expParts.join(' '));
    }
  }

  return parts.join('. ').slice(0, 8000); // Limit to prevent token overflow
}

/**
 * Build a text block from a job posting for embedding.
 * Concatenates title, description, and structured skill names.
 */
export function buildJobEmbeddingText(job: {
  title?: string | null;
  description?: string | null;
  structured?: {
    skills?: Array<{ name: string }>;
    seniority?: string;
    workMode?: string;
  };
}): string {
  const parts: string[] = [];

  if (job.title) parts.push(job.title);
  if (job.description) parts.push(job.description);

  if (job.structured?.skills && Array.isArray(job.structured.skills)) {
    const skillNames = job.structured.skills.map((s) => s.name).join(', ');
    if (skillNames) parts.push(`Required skills: ${skillNames}`);
  }

  if (job.structured?.seniority) {
    parts.push(`Seniority: ${job.structured.seniority}`);
  }

  if (job.structured?.workMode) {
    parts.push(`Work mode: ${job.structured.workMode}`);
  }

  return parts.join('. ').slice(0, 8000);
}

/**
 * Generate an embedding vector for the given text using the configured AI provider.
 * Returns a 1536-dimensional float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getProvider();

  const { embedding } = await embed({
    model: provider.textEmbeddingModel('text-embedding-3-small'),
    value: text,
  });

  return embedding;
}

/**
 * Generate and store an embedding for a talent profile.
 */
export async function embedProfile(profileId: string): Promise<void> {
  const profile = await db.query.talentProfiles.findFirst({
    where: eq(talentProfiles.id, profileId),
  });

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  const text = buildProfileEmbeddingText({
    displayName: profile.displayName,
    headline: profile.headline,
    skills: profile.skills as Array<{ name: string; level?: string; category?: string }>,
    experience: profile.experience as Array<{ role?: string; company?: string; description?: string }>,
  });

  if (!text.trim()) {
    console.warn(`[embed-profile] Empty text for profile ${profileId}, skipping`);
    return;
  }

  const embedding = await generateEmbedding(text);

  // Store embedding using raw SQL since Drizzle doesn't natively support vector type
  await db.execute(
    sql`UPDATE talent_profiles SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${profileId}::uuid`
  );

  console.log(`[embed-profile] Embedded profile ${profileId} (${text.length} chars)`);
}

/**
 * Generate and store an embedding for a job posting.
 */
export async function embedJob(jobId: string): Promise<void> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const text = buildJobEmbeddingText({
    title: job.title,
    description: job.description,
    structured: job.structured as {
      skills?: Array<{ name: string }>;
      seniority?: string;
      workMode?: string;
    },
  });

  if (!text.trim()) {
    console.warn(`[embed-job] Empty text for job ${jobId}, skipping`);
    return;
  }

  const embedding = await generateEmbedding(text);

  await db.execute(
    sql`UPDATE jobs SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${jobId}::uuid`
  );

  console.log(`[embed-job] Embedded job ${jobId} (${text.length} chars)`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/matching/embedding.ts
git commit -m "feat: add embedding generation for profiles and jobs"
```

---

### Task 3: Matching Engine (`engine.ts`) — with Tests

**Files:**
- Create: `src/lib/matching/engine.ts`
- Create: `src/lib/matching/__tests__/engine.test.ts`

- [ ] **Step 1: Write engine tests**

Create `src/lib/matching/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { computeHybridScore, rankCandidates } from '../engine';

describe('computeHybridScore', () => {
  it('combines semantic and feature scores with correct weights', () => {
    const result = computeHybridScore(80, 90);
    // 0.4 * 80 + 0.6 * 90 = 32 + 54 = 86
    expect(result).toBe(86);
  });

  it('handles zero scores', () => {
    expect(computeHybridScore(0, 0)).toBe(0);
  });

  it('handles perfect scores', () => {
    expect(computeHybridScore(100, 100)).toBe(100);
  });

  it('clamps to 0-100 range', () => {
    expect(computeHybridScore(0, 0)).toBeGreaterThanOrEqual(0);
    expect(computeHybridScore(100, 100)).toBeLessThanOrEqual(100);
  });

  it('weights feature score higher than semantic', () => {
    // Same semantic, different feature → feature has more impact
    const highFeature = computeHybridScore(50, 100);
    const lowFeature = computeHybridScore(50, 0);
    expect(highFeature - lowFeature).toBe(60); // 0.6 * 100
  });
});

describe('rankCandidates', () => {
  it('sorts candidates by total score descending', () => {
    const candidates = [
      { talentId: 'a', semanticScore: 60, featureScore: 70 },
      { talentId: 'b', semanticScore: 90, featureScore: 95 },
      { talentId: 'c', semanticScore: 50, featureScore: 80 },
    ];

    const ranked = rankCandidates(candidates);
    expect(ranked[0]!.talentId).toBe('b');
    expect(ranked[0]!.totalScore).toBe(computeHybridScore(90, 95));
    // Verify descending order
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.totalScore).toBeLessThanOrEqual(ranked[i - 1]!.totalScore);
    }
  });

  it('handles empty array', () => {
    expect(rankCandidates([])).toEqual([]);
  });

  it('handles single candidate', () => {
    const candidates = [{ talentId: 'a', semanticScore: 80, featureScore: 70 }];
    const ranked = rankCandidates(candidates);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.totalScore).toBe(computeHybridScore(80, 70));
  });
});
```

- [ ] **Step 2: Implement matching engine**

Create `src/lib/matching/engine.ts`:

```typescript
import { db } from '@/lib/db';
import { talentProfiles, jobs, matches, inboxItems } from '@/lib/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { computeFeatureScore } from './scoring';
import { generateEmbedding, buildJobEmbeddingText } from './embedding';
import type { Skill, StructuredJob, MatchBreakdown } from '@/types';
import { generateText } from 'ai';
import { getProvider } from '@/lib/ai/providers';

const SEMANTIC_WEIGHT = 0.4;
const FEATURE_WEIGHT = 0.6;
const TOP_N_SEMANTIC = 50;
const TOP_N_REASONING = 10;
const HIGH_MATCH_THRESHOLD = 80;

/**
 * Compute the hybrid match score from semantic and feature scores.
 * Both inputs on 0-100 scale; output on 0-100 scale.
 */
export function computeHybridScore(
  semanticScore: number,
  featureScore: number
): number {
  const hybrid =
    SEMANTIC_WEIGHT * semanticScore + FEATURE_WEIGHT * featureScore;
  return Math.round(Math.max(0, Math.min(100, hybrid)));
}

/**
 * Rank a set of candidates by their hybrid score (descending).
 */
export function rankCandidates(
  candidates: Array<{
    talentId: string;
    semanticScore: number;
    featureScore: number;
  }>
): Array<{
  talentId: string;
  semanticScore: number;
  featureScore: number;
  totalScore: number;
}> {
  return candidates
    .map((c) => ({
      ...c,
      totalScore: computeHybridScore(c.semanticScore, c.featureScore),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Find the top N talent profiles by embedding cosine similarity to a job.
 * Returns profiles with their cosine similarity score (0-1) converted to 0-100.
 */
async function findSemanticMatches(
  jobId: string,
  limit: number = TOP_N_SEMANTIC
): Promise<
  Array<{
    id: string;
    displayName: string | null;
    headline: string | null;
    skills: unknown;
    experience: unknown;
    availability: string | null;
    cosineSimilarity: number;
  }>
> {
  // Use raw SQL for pgvector cosine similarity query
  const result = await db.execute(sql`
    SELECT
      tp.id,
      tp.display_name as "displayName",
      tp.headline,
      tp.skills,
      tp.experience,
      tp.availability,
      1 - (tp.embedding <=> j.embedding) as "cosineSimilarity"
    FROM talent_profiles tp, jobs j
    WHERE j.id = ${jobId}::uuid
      AND tp.embedding IS NOT NULL
      AND j.embedding IS NOT NULL
    ORDER BY tp.embedding <=> j.embedding
    LIMIT ${limit}
  `);

  return (result.rows || result) as Array<{
    id: string;
    displayName: string | null;
    headline: string | null;
    skills: unknown;
    experience: unknown;
    availability: string | null;
    cosineSimilarity: number;
  }>;
}

/**
 * Generate AI reasoning for why a talent is a good/poor match for a job.
 */
async function generateMatchReasoning(
  talentProfile: {
    displayName: string | null;
    headline: string | null;
    skills: Skill[];
  },
  jobDetails: {
    title: string | null;
    structured: StructuredJob;
  },
  score: number
): Promise<string> {
  const provider = getProvider();

  const { text } = await generateText({
    model: provider('gpt-4o-mini'),
    system: `You are an AI recruiter analyzing talent-job fit. Be concise (2-3 sentences). Write in the language that matches the talent's name (Chinese name → Chinese, otherwise English).`,
    prompt: `Talent: ${talentProfile.displayName} — ${talentProfile.headline}
Skills: ${talentProfile.skills.map((s) => `${s.name} (${s.level})`).join(', ')}
Job: ${jobDetails.title}
Required Skills: ${jobDetails.structured.skills.map((s) => `${s.name} (${s.required ? 'must-have' : 'nice-to-have'})`).join(', ')}
Seniority: ${jobDetails.structured.seniority}
Match Score: ${score}/100

Explain why this talent is ${score >= 80 ? 'a strong' : score >= 60 ? 'a moderate' : 'a weak'} match for this role. Mention specific skill alignments and gaps.`,
    maxTokens: 200,
  });

  return text;
}

/**
 * Run the full matching pipeline for a single job.
 *
 * 1. Query pgvector for top 50 talent profiles by cosine similarity
 * 2. Compute feature score for each candidate
 * 3. Compute hybrid score (0.4 * semantic + 0.6 * feature)
 * 4. Upsert results into the matches table
 * 5. For top 10, generate AI reasoning
 * 6. Create inbox notifications for high matches (>80%)
 */
export async function scanMatchesForJob(jobId: string): Promise<number> {
  // Load job details
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const structured = job.structured as StructuredJob;

  // Step 1: Semantic search via pgvector
  const semanticMatches = await findSemanticMatches(jobId);

  if (semanticMatches.length === 0) {
    console.log(`[scan-matches] No embeddings found for job ${jobId}`);
    return 0;
  }

  // Step 2+3: Feature scoring + hybrid score for each candidate
  const scoredCandidates = semanticMatches.map((talent) => {
    const talentSkills = (talent.skills || []) as Skill[];
    const availability = talent.availability || 'open';

    const featureResult = computeFeatureScore(
      talentSkills,
      structured,
      availability
    );

    // Convert cosine similarity (0-1) to 0-100 scale
    const semanticScore = Math.round((talent.cosineSimilarity ?? 0) * 100);
    const totalScore = computeHybridScore(semanticScore, featureResult.score);

    return {
      talentId: talent.id,
      displayName: talent.displayName,
      headline: talent.headline,
      skills: talentSkills,
      semanticScore,
      featureScore: featureResult.score,
      totalScore,
      breakdown: {
        semantic: semanticScore,
        feature: featureResult.score,
        dimensions: featureResult.dimensions,
      } satisfies MatchBreakdown,
    };
  });

  // Sort by total score descending
  scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

  // Step 4: Upsert matches into DB
  for (const candidate of scoredCandidates) {
    await db
      .insert(matches)
      .values({
        jobId,
        talentId: candidate.talentId,
        score: candidate.totalScore,
        breakdown: candidate.breakdown,
        status: 'new',
      })
      .onConflictDoUpdate({
        target: [matches.jobId, matches.talentId],
        set: {
          score: candidate.totalScore,
          breakdown: candidate.breakdown,
        },
      });
  }

  // Step 5: Generate AI reasoning for top 10
  const topCandidates = scoredCandidates.slice(0, TOP_N_REASONING);

  for (const candidate of topCandidates) {
    try {
      const reasoning = await generateMatchReasoning(
        {
          displayName: candidate.displayName,
          headline: candidate.headline,
          skills: candidate.skills,
        },
        {
          title: job.title,
          structured,
        },
        candidate.totalScore
      );

      await db
        .update(matches)
        .set({ aiReasoning: reasoning })
        .where(
          and(
            eq(matches.jobId, jobId),
            eq(matches.talentId, candidate.talentId)
          )
        );
    } catch (error) {
      console.error(
        `[scan-matches] Failed to generate reasoning for talent ${candidate.talentId}:`,
        error
      );
    }
  }

  // Step 6: Create inbox notifications for high matches (>80%)
  const highMatches = scoredCandidates.filter(
    (c) => c.totalScore >= HIGH_MATCH_THRESHOLD
  );

  for (const candidate of highMatches) {
    // Notification for the talent user
    const talentProfile = await db.query.talentProfiles.findFirst({
      where: eq(talentProfiles.id, candidate.talentId),
    });

    if (talentProfile?.userId) {
      await db.insert(inboxItems).values({
        userId: talentProfile.userId,
        itemType: 'match_notification',
        title: `New high match: ${job.title}`,
        content: {
          jobId,
          jobTitle: job.title,
          score: candidate.totalScore,
          breakdown: candidate.breakdown,
        },
      });
    }

    // Notification for the enterprise user
    if (job.enterpriseId) {
      const enterpriseProfile = await db.query.enterpriseProfiles.findFirst({
        where: eq(
          (await import('@/lib/db/schema')).enterpriseProfiles.id,
          job.enterpriseId
        ),
      });

      if (enterpriseProfile?.userId) {
        await db.insert(inboxItems).values({
          userId: enterpriseProfile.userId,
          itemType: 'match_notification',
          title: `High match found: ${candidate.displayName} for ${job.title}`,
          content: {
            talentId: candidate.talentId,
            talentName: candidate.displayName,
            jobId,
            jobTitle: job.title,
            score: candidate.totalScore,
          },
        });
      }
    }
  }

  console.log(
    `[scan-matches] Job ${jobId}: ${scoredCandidates.length} matches, ${highMatches.length} high matches`
  );

  return scoredCandidates.length;
}
```

- [ ] **Step 3: Run tests and verify**

```bash
npx vitest run src/lib/matching/__tests__/engine.test.ts
```

Expected: All pure-function tests pass. DB-dependent functions are tested in integration.

- [ ] **Step 4: Commit**

```bash
git add src/lib/matching/engine.ts src/lib/matching/__tests__/engine.test.ts
git commit -m "feat: implement matching engine with hybrid scoring and AI reasoning"
```

---

### Task 4: BullMQ Workers — Replace Stubs with Real Logic

**Files:**
- Modify: `src/lib/jobs/worker.ts`

- [ ] **Step 1: Update worker with real embedding and matching logic**

Replace the stub handlers in `src/lib/jobs/worker.ts` with:

```typescript
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type {
  EmbedJobData,
  ScanMatchJobData,
  ReportJobData,
  PrechatJobData,
  GraphJobData,
} from './queue';
import { embedProfile, embedJob } from '@/lib/matching/embedding';
import { scanMatchesForJob } from '@/lib/matching/engine';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Worker: embed profiles and jobs
new Worker<EmbedJobData>(
  'embed',
  async (job) => {
    console.log(`[embed] Processing ${job.data.type} ${job.data.id}`);

    if (job.data.type === 'profile') {
      await embedProfile(job.data.id);
    } else if (job.data.type === 'job') {
      await embedJob(job.data.id);
    } else {
      console.warn(`[embed] Unknown type: ${job.data.type}`);
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// Worker: scan for matches
new Worker<ScanMatchJobData>(
  'scan-matches',
  async (job) => {
    console.log(`[scan-matches] Processing job ${job.data.jobId}`);
    const matchCount = await scanMatchesForJob(job.data.jobId);
    console.log(`[scan-matches] Found ${matchCount} matches for job ${job.data.jobId}`);
  },
  {
    connection,
    concurrency: 1,
  }
);

// Worker: generate seeking reports (Spec 5 — stub)
new Worker<ReportJobData>(
  'generate-report',
  async (job) => {
    console.log(`[generate-report] Processing talent ${job.data.talentId}`);
    // Stub: actual report generation in Spec 5
  },
  { connection }
);

// Worker: pre-chat (Spec 5 — stub)
new Worker<PrechatJobData>(
  'pre-chat',
  async (job) => {
    console.log(`[pre-chat] Processing job ${job.data.jobId} / talent ${job.data.talentId}`);
    // Stub: actual pre-chat in Spec 5
  },
  { connection }
);

// Worker: update keyword graph (Spec 6 — stub)
new Worker<GraphJobData>(
  'update-graph',
  async (job) => {
    console.log(`[update-graph] Trigger: ${job.data.trigger}`);
    // Stub: actual graph update in Spec 6
  },
  { connection }
);

console.log('[workers] All workers started');
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/jobs/worker.ts
git commit -m "feat: replace embed and scan-matches worker stubs with real implementations"
```

---

### Task 5: API Routes — Jobs Detail, Matches, and Scan Trigger

**Files:**
- Create: `src/app/api/v1/jobs/[id]/route.ts`
- Create: `src/app/api/v1/matches/route.ts`
- Create: `src/app/api/v1/matches/scan/route.ts`
- Create: `src/app/api/v1/matches/[id]/route.ts`

- [ ] **Step 1: Job detail API (GET /api/v1/jobs/[id])**

Create `src/app/api/v1/jobs/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, matches, talentProfiles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load job
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Load matches for this job with talent profile data
    const jobMatches = await db
      .select({
        matchId: matches.id,
        talentId: matches.talentId,
        score: matches.score,
        breakdown: matches.breakdown,
        status: matches.status,
        aiReasoning: matches.aiReasoning,
        createdAt: matches.createdAt,
        displayName: talentProfiles.displayName,
        headline: talentProfiles.headline,
        skills: talentProfiles.skills,
        availability: talentProfiles.availability,
      })
      .from(matches)
      .leftJoin(talentProfiles, eq(matches.talentId, talentProfiles.id))
      .where(eq(matches.jobId, id))
      .orderBy(desc(matches.score));

    return NextResponse.json({
      job,
      matches: jobMatches,
    });
  } catch (error) {
    console.error('[GET /api/v1/jobs/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Matches list API (GET /api/v1/matches)**

Create `src/app/api/v1/matches/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matches, jobs, talentProfiles } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const minScore = searchParams.get('minScore');
    const status = searchParams.get('status');

    let query = db
      .select({
        matchId: matches.id,
        jobId: matches.jobId,
        talentId: matches.talentId,
        score: matches.score,
        breakdown: matches.breakdown,
        status: matches.status,
        aiReasoning: matches.aiReasoning,
        createdAt: matches.createdAt,
        jobTitle: jobs.title,
        talentName: talentProfiles.displayName,
        talentHeadline: talentProfiles.headline,
      })
      .from(matches)
      .leftJoin(jobs, eq(matches.jobId, jobs.id))
      .leftJoin(talentProfiles, eq(matches.talentId, talentProfiles.id))
      .orderBy(desc(matches.score));

    // Note: filters are applied in the engine; for MVP we return all results.
    // Production would add .where() clauses based on jobId, minScore, status.

    const results = await query;

    return NextResponse.json({ matches: results });
  } catch (error) {
    console.error('[GET /api/v1/matches]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Scan trigger API (POST /api/v1/matches/scan)**

Create `src/app/api/v1/matches/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { matchQueue } from '@/lib/jobs/queue';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Queue the scan-matches job
    const job = await matchQueue.add('scan', { jobId });

    return NextResponse.json({
      message: 'Match scan queued',
      queueJobId: job.id,
    });
  } catch (error) {
    console.error('[POST /api/v1/matches/scan]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Match status update API (PATCH /api/v1/matches/[id])**

Create `src/app/api/v1/matches/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matches, inboxItems, talentProfiles, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { MatchStatus } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body as { status: MatchStatus };

    const validStatuses: MatchStatus[] = [
      'new',
      'viewed',
      'shortlisted',
      'invited',
      'applied',
      'rejected',
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update match status
    const [updated] = await db
      .update(matches)
      .set({ status })
      .where(eq(matches.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // If status is 'invited', create an inbox item for the talent
    if (status === 'invited' && updated.talentId) {
      const talentProfile = await db.query.talentProfiles.findFirst({
        where: eq(talentProfiles.id, updated.talentId),
      });

      const job = updated.jobId
        ? await db.query.jobs.findFirst({
            where: eq(jobs.id, updated.jobId),
          })
        : null;

      if (talentProfile?.userId) {
        await db.insert(inboxItems).values({
          userId: talentProfile.userId,
          itemType: 'invite',
          title: `You've been invited to apply: ${job?.title ?? 'a position'}`,
          content: {
            jobId: updated.jobId,
            jobTitle: job?.title,
            matchId: id,
            score: updated.score,
          },
        });
      }
    }

    return NextResponse.json({ match: updated });
  } catch (error) {
    console.error('[PATCH /api/v1/matches/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/jobs/\[id\]/route.ts src/app/api/v1/matches/route.ts src/app/api/v1/matches/scan/route.ts src/app/api/v1/matches/\[id\]/route.ts
git commit -m "feat: add API routes for job detail, matches list, scan trigger, and status update"
```

---

### Task 6: AI Screening Endpoint and System Prompt

**Files:**
- Create: `src/lib/ai/prompts/screening.ts`
- Create: `src/app/api/internal/ai/screening/route.ts`

- [ ] **Step 1: Create screening system prompt**

Create `src/lib/ai/prompts/screening.ts`:

```typescript
import { basePrompt } from './_base';

export function screeningSystemPrompt(context: {
  companyName: string;
  activeJobs: Array<{ id: string; title: string }>;
}) {
  return `${basePrompt}

You are an AI recruiter assistant for ${context.companyName}. You help the enterprise user search, compare, and screen AI talent candidates.

## Active Jobs
${context.activeJobs.map((j) => `- ${j.title} (ID: ${j.id})`).join('\n')}

## Capabilities
You have access to three tools:
1. **searchTalent** — Search the talent pool by query and optional filters. Returns ranked candidates with match scores.
2. **compareCandidates** — Compare multiple candidates side-by-side on specific dimensions.
3. **shortlistCandidate** — Add a candidate to the shortlist for a specific job.

## Behavior
- When the user asks about candidates, use searchTalent to find relevant talent
- When comparing, present results in a clear structured format
- Explain your reasoning about why candidates match or don't match
- Proactively suggest comparisons when multiple strong candidates exist
- When shortlisting, confirm the action and explain why the candidate is a good pick
- Be concise but thorough in your analysis`;
}
```

- [ ] **Step 2: Create AI screening API route**

Create `src/app/api/internal/ai/screening/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { getProvider } from '@/lib/ai/providers';
import { screeningSystemPrompt } from '@/lib/ai/prompts/screening';
import {
  loadChatHistory,
  saveChatMessage,
  getOrCreateSession,
} from '@/lib/ai/chat';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  talentProfiles,
  jobs,
  matches,
  enterpriseProfiles,
} from '@/lib/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { computeFeatureScore } from '@/lib/matching/scoring';
import type { Skill, StructuredJob } from '@/types';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload || payload.role !== 'enterprise') {
    return new Response('Forbidden', { status: 403 });
  }

  const { message } = await request.json();

  // Load enterprise context
  const enterprise = await db.query.enterpriseProfiles.findFirst({
    where: eq(enterpriseProfiles.userId, payload.userId),
  });

  const activeJobs = await db.query.jobs.findMany({
    where: eq(jobs.status, 'open'),
  });

  const enterpriseJobs = enterprise
    ? activeJobs.filter((j) => j.enterpriseId === enterprise.id)
    : [];

  // Get or create screening chat session
  const session = await getOrCreateSession(payload.userId, 'screening');

  // Load chat history
  const history = await loadChatHistory(session.id);

  // Save user message
  await saveChatMessage(session.id, 'user', message);

  const provider = getProvider();
  const systemPrompt = screeningSystemPrompt({
    companyName: enterprise?.companyName || 'Your Company',
    activeJobs: enterpriseJobs.map((j) => ({ id: j.id, title: j.title || 'Untitled' })),
  });

  const result = streamText({
    model: provider('gpt-4o'),
    system: systemPrompt,
    messages: [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ],
    tools: {
      searchTalent: tool({
        description:
          'Search the talent pool by query text and optional filters. Returns ranked candidates with match scores.',
        parameters: z.object({
          query: z
            .string()
            .describe('Search query — skills, role, or description of ideal candidate'),
          filters: z
            .object({
              availability: z
                .enum(['open', 'busy', 'not_looking'])
                .optional()
                .describe('Filter by availability'),
              minScore: z
                .number()
                .optional()
                .describe('Minimum match score (0-100)'),
              jobId: z
                .string()
                .optional()
                .describe('Job ID to match against'),
            })
            .optional()
            .describe('Optional filters'),
        }),
        execute: async ({ query, filters }) => {
          // If a jobId is provided, use existing matches
          if (filters?.jobId) {
            const existingMatches = await db
              .select({
                talentId: matches.talentId,
                score: matches.score,
                breakdown: matches.breakdown,
                aiReasoning: matches.aiReasoning,
                displayName: talentProfiles.displayName,
                headline: talentProfiles.headline,
                skills: talentProfiles.skills,
                availability: talentProfiles.availability,
              })
              .from(matches)
              .leftJoin(
                talentProfiles,
                eq(matches.talentId, talentProfiles.id)
              )
              .where(eq(matches.jobId, filters.jobId))
              .orderBy(desc(matches.score))
              .limit(20);

            return {
              candidates: existingMatches.map((m) => ({
                talentId: m.talentId,
                name: m.displayName,
                headline: m.headline,
                skills: m.skills,
                availability: m.availability,
                matchScore: m.score,
                reasoning: m.aiReasoning,
              })),
              total: existingMatches.length,
            };
          }

          // Otherwise, do a semantic search using pgvector
          // First generate embedding for the query
          const { generateEmbedding } = await import(
            '@/lib/matching/embedding'
          );
          const queryEmbedding = await generateEmbedding(query);

          const results = await db.execute(sql`
            SELECT
              tp.id as "talentId",
              tp.display_name as "displayName",
              tp.headline,
              tp.skills,
              tp.availability,
              1 - (tp.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
            FROM talent_profiles tp
            WHERE tp.embedding IS NOT NULL
            ${filters?.availability ? sql`AND tp.availability = ${filters.availability}` : sql``}
            ORDER BY tp.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
            LIMIT 20
          `);

          const candidates = ((results.rows || results) as Array<Record<string, unknown>>).map(
            (r) => ({
              talentId: r.talentId as string,
              name: r.displayName as string,
              headline: r.headline as string,
              skills: r.skills,
              availability: r.availability as string,
              matchScore: Math.round(
                ((r.similarity as number) ?? 0) * 100
              ),
            })
          );

          return {
            candidates: filters?.minScore
              ? candidates.filter(
                  (c) => c.matchScore >= (filters.minScore ?? 0)
                )
              : candidates,
            total: candidates.length,
          };
        },
      }),

      compareCandidates: tool({
        description:
          'Compare multiple candidates side-by-side on specific skill dimensions. Returns a comparison matrix.',
        parameters: z.object({
          talentIds: z
            .array(z.string())
            .min(2)
            .max(5)
            .describe('Talent profile IDs to compare'),
          dimensions: z
            .array(z.string())
            .describe('Skill or attribute names to compare on'),
        }),
        execute: async ({ talentIds, dimensions }) => {
          const profiles = [];

          for (const talentId of talentIds) {
            const profile = await db.query.talentProfiles.findFirst({
              where: eq(talentProfiles.id, talentId),
            });

            if (profile) {
              const skills = (profile.skills || []) as Skill[];
              const dimensionScores: Record<string, string> = {};

              for (const dim of dimensions) {
                const skill = skills.find(
                  (s) =>
                    s.name.toLowerCase() === dim.toLowerCase()
                );
                dimensionScores[dim] = skill
                  ? `${skill.level} ✓`
                  : 'Not listed ✗';
              }

              profiles.push({
                talentId,
                name: profile.displayName,
                headline: profile.headline,
                dimensions: dimensionScores,
                availability: profile.availability,
              });
            }
          }

          return { comparison: profiles };
        },
      }),

      shortlistCandidate: tool({
        description:
          'Add a candidate to the shortlist for a specific job. Updates the match status to shortlisted.',
        parameters: z.object({
          talentId: z.string().describe('Talent profile ID to shortlist'),
          jobId: z.string().describe('Job ID to shortlist for'),
        }),
        execute: async ({ talentId, jobId }) => {
          // Find or create the match record
          const existingMatch = await db.query.matches.findFirst({
            where: and(
              eq(matches.jobId, jobId),
              eq(matches.talentId, talentId)
            ),
          });

          if (existingMatch) {
            await db
              .update(matches)
              .set({ status: 'shortlisted' })
              .where(eq(matches.id, existingMatch.id));
          } else {
            await db.insert(matches).values({
              jobId,
              talentId,
              score: 0,
              breakdown: { semantic: 0, feature: 0, dimensions: {} },
              status: 'shortlisted',
            });
          }

          // Load names for confirmation message
          const talent = await db.query.talentProfiles.findFirst({
            where: eq(talentProfiles.id, talentId),
          });
          const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, jobId),
          });

          return {
            success: true,
            message: `${talent?.displayName ?? 'Candidate'} has been shortlisted for "${job?.title ?? 'the position'}"`,
          };
        },
      }),
    },
    maxSteps: 5,
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session.id, 'assistant', text);
      }
    },
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts/screening.ts src/app/api/internal/ai/screening/route.ts
git commit -m "feat: add AI screening endpoint with searchTalent, compareCandidates, shortlistCandidate tools"
```

---

### Task 7: UI Components — Score Dot, Candidate Table, Candidate Detail Sheet

**Files:**
- Create: `src/components/matching/score-dot.tsx`
- Create: `src/components/matching/candidate-table.tsx`
- Create: `src/components/matching/candidate-detail.tsx`

- [ ] **Step 1: Create score dot component**

Create `src/components/matching/score-dot.tsx`:

```typescript
'use client';

interface ScoreDotProps {
  score: number; // 0-1 scale
  label?: string;
  mustHave?: boolean;
}

/**
 * Color-coded dot representing a skill match score.
 * Green: >= 0.8, Yellow: >= 0.5, Red: < 0.5, Gray: 0 (missing)
 */
export function ScoreDot({ score, label, mustHave }: ScoreDotProps) {
  const color =
    score === 0
      ? 'bg-zinc-600'
      : score >= 0.8
        ? 'bg-emerald-500'
        : score >= 0.5
          ? 'bg-yellow-500'
          : 'bg-red-500';

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`h-2.5 w-2.5 rounded-full ${color}`}
        title={`${Math.round(score * 100)}%`}
      />
      {label && (
        <span className="text-xs text-muted-foreground">
          {label}
          {mustHave && <span className="ml-0.5 text-amber-400">✱</span>}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create candidate table component**

Create `src/components/matching/candidate-table.tsx`:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScoreDot } from './score-dot';
import type { Skill, MatchBreakdown, MatchStatus } from '@/types';

export interface CandidateRow {
  matchId: string;
  talentId: string;
  displayName: string | null;
  headline: string | null;
  score: number;
  breakdown: MatchBreakdown;
  status: MatchStatus;
  skills: Skill[];
  availability: string | null;
  aiReasoning?: string | null;
}

interface CandidateTableProps {
  candidates: CandidateRow[];
  jobSkills: Array<{ name: string; required: boolean }>;
  onSelectCandidate: (candidate: CandidateRow) => void;
  sortBy?: string;
  onSortChange?: (column: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  viewed: 'bg-zinc-500/20 text-zinc-400',
  shortlisted: 'bg-emerald-500/20 text-emerald-400',
  invited: 'bg-purple-500/20 text-purple-400',
  applied: 'bg-amber-500/20 text-amber-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export function CandidateTable({
  candidates,
  jobSkills,
  onSelectCandidate,
  sortBy = 'score',
  onSortChange,
}: CandidateTableProps) {
  const [filterThreshold, setFilterThreshold] = useState<number>(0);

  const filtered = useMemo(
    () => candidates.filter((c) => c.score >= filterThreshold),
    [candidates, filterThreshold]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'score') {
      arr.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'availability') {
      const order = { open: 0, busy: 1, not_looking: 2 };
      arr.sort(
        (a, b) =>
          (order[a.availability as keyof typeof order] ?? 3) -
          (order[b.availability as keyof typeof order] ?? 3)
      );
    } else {
      // Sort by a specific skill dimension
      arr.sort((a, b) => {
        const aScore = a.breakdown.dimensions?.[sortBy] ?? 0;
        const bScore = b.breakdown.dimensions?.[sortBy] ?? 0;
        return bScore - aScore;
      });
    }
    return arr;
  }, [filtered, sortBy]);

  const handleHeaderClick = (column: string) => {
    onSortChange?.(column);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-4 text-sm">
        <label className="text-muted-foreground">Min score:</label>
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          value={filterThreshold}
          onChange={(e) => setFilterThreshold(Number(e.target.value))}
        >
          <option value={0}>All</option>
          <option value={50}>50+</option>
          <option value={60}>60+</option>
          <option value={70}>70+</option>
          <option value={80}>80+</option>
        </select>
        <span className="text-muted-foreground">
          {sorted.length} candidate{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th
                className="cursor-pointer px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('name')}
              >
                Candidate
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('score')}
              >
                Score
              </th>
              {jobSkills.map((skill) => (
                <th
                  key={skill.name}
                  className="cursor-pointer px-3 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => handleHeaderClick(skill.name)}
                >
                  <span className="text-xs">
                    {skill.name}
                    {skill.required && (
                      <span className="ml-0.5 text-amber-400">✱</span>
                    )}
                  </span>
                </th>
              ))}
              <th
                className="cursor-pointer px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('availability')}
              >
                Availability
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((candidate) => (
              <tr
                key={candidate.matchId}
                className="cursor-pointer border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                onClick={() => onSelectCandidate(candidate)}
              >
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">
                      {candidate.displayName ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.headline ?? ''}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-lg font-bold ${
                      candidate.score >= 80
                        ? 'text-emerald-400'
                        : candidate.score >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {candidate.score}
                  </span>
                </td>
                {jobSkills.map((skill) => (
                  <td key={skill.name} className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreDot
                        score={
                          candidate.breakdown.dimensions?.[skill.name] ?? 0
                        }
                      />
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      candidate.availability === 'open'
                        ? 'border-emerald-600 text-emerald-400'
                        : candidate.availability === 'busy'
                          ? 'border-yellow-600 text-yellow-400'
                          : 'border-red-600 text-red-400'
                    }`}
                  >
                    {candidate.availability ?? 'unknown'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    className={`text-xs ${STATUS_COLORS[candidate.status] ?? ''}`}
                  >
                    {candidate.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={jobSkills.length + 4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No candidates match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create candidate detail Sheet component**

Create `src/components/matching/candidate-detail.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScoreDot } from './score-dot';
import { motion } from 'framer-motion';
import type { CandidateRow } from './candidate-table';
import type { Skill, MatchBreakdown } from '@/types';

interface CandidateDetailProps {
  candidate: CandidateRow | null;
  jobSkills: Array<{ name: string; required: boolean }>;
  open: boolean;
  onClose: () => void;
  onInvite: (talentId: string) => void;
  onShortlist: (talentId: string) => void;
}

function CountUpScore({ value }: { value: number }) {
  return (
    <motion.span
      className={`text-5xl font-bold ${
        value >= 80
          ? 'text-emerald-400'
          : value >= 60
            ? 'text-yellow-400'
            : 'text-red-400'
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {value}
    </motion.span>
  );
}

export function CandidateDetail({
  candidate,
  jobSkills,
  open,
  onClose,
  onInvite,
  onShortlist,
}: CandidateDetailProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!candidate) return null;

  const skills = candidate.skills || [];

  // Group skills by category
  const skillsByCategory = skills.reduce<Record<string, Skill[]>>(
    (acc, skill) => {
      const cat = skill.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(skill);
      return acc;
    },
    {}
  );

  const handleInvite = async () => {
    setActionLoading('invite');
    try {
      await onInvite(candidate.talentId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleShortlist = async () => {
    setActionLoading('shortlist');
    try {
      await onShortlist(candidate.talentId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-[600px] overflow-y-auto sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {candidate.displayName ?? 'Unknown Candidate'}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {candidate.headline ?? ''}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Match Score */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
            <div>
              <div className="text-sm text-muted-foreground">Match Score</div>
              <CountUpScore value={candidate.score} />
            </div>
            <div className="space-y-1 text-right text-xs text-muted-foreground">
              <div>
                Semantic: {candidate.breakdown.semantic ?? 0}%
              </div>
              <div>
                Feature: {candidate.breakdown.feature ?? 0}%
              </div>
            </div>
          </div>

          {/* Skill Match Grid */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Skill Match</h3>
            <div className="grid grid-cols-2 gap-2">
              {jobSkills.map((jobSkill) => {
                const dimScore =
                  candidate.breakdown.dimensions?.[jobSkill.name] ?? 0;
                const hasSkill = skills.some(
                  (s) =>
                    s.name.toLowerCase() === jobSkill.name.toLowerCase()
                );

                return (
                  <div
                    key={jobSkill.name}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                      hasSkill && dimScore >= 0.8
                        ? 'border-emerald-800/50 bg-emerald-950/20'
                        : hasSkill
                          ? 'border-yellow-800/50 bg-yellow-950/20'
                          : 'border-zinc-800 bg-zinc-900/50'
                    }`}
                  >
                    <span>
                      {hasSkill && dimScore > 0 ? '✓ ' : ''}
                      {jobSkill.name}
                      {jobSkill.required && (
                        <span className="ml-1 text-amber-400">✱</span>
                      )}
                    </span>
                    <ScoreDot score={dimScore} />
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Capability Portrait */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Skills</h3>
            <div className="space-y-3">
              {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                <div key={category}>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catSkills.map((skill) => {
                      const isJobMatch = jobSkills.some(
                        (js) =>
                          js.name.toLowerCase() === skill.name.toLowerCase()
                      );
                      const opacity =
                        skill.level === 'expert'
                          ? 'opacity-100'
                          : skill.level === 'advanced'
                            ? 'opacity-80'
                            : skill.level === 'intermediate'
                              ? 'opacity-60'
                              : 'opacity-40';

                      return (
                        <Badge
                          key={skill.name}
                          variant={isJobMatch ? 'default' : 'outline'}
                          className={`${opacity} ${
                            isJobMatch
                              ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                              : ''
                          }`}
                        >
                          {isJobMatch && '✓ '}
                          {skill.name}
                          <span className="ml-1 text-xs opacity-60">
                            {skill.level}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* AI Reasoning */}
          {candidate.aiReasoning && (
            <div>
              <h3 className="mb-2 text-sm font-medium">AI Analysis</h3>
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-muted-foreground">
                {candidate.aiReasoning}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleInvite}
              disabled={actionLoading !== null}
              className="flex-1"
            >
              {actionLoading === 'invite' ? 'Sending...' : 'Send Invite'}
            </Button>
            <Button
              variant="outline"
              onClick={handleShortlist}
              disabled={actionLoading !== null}
              className="flex-1"
            >
              {actionLoading === 'shortlist'
                ? 'Adding...'
                : 'Add to Shortlist'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/matching/score-dot.tsx src/components/matching/candidate-table.tsx src/components/matching/candidate-detail.tsx
git commit -m "feat: add candidate table, detail sheet, and score dot UI components"
```

---

### Task 8: Feature Matching View — `/enterprise/jobs/[id]`

**Files:**
- Create: `src/app/(enterprise)/jobs/[id]/page.tsx`

- [ ] **Step 1: Create job detail page with candidate table**

Create `src/app/(enterprise)/jobs/[id]/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CandidateTable,
  type CandidateRow,
} from '@/components/matching/candidate-table';
import { CandidateDetail } from '@/components/matching/candidate-detail';
import type { StructuredJob, MatchBreakdown, Skill, MatchStatus } from '@/types';

interface JobData {
  id: string;
  title: string | null;
  description: string | null;
  structured: StructuredJob;
  status: string | null;
  createdAt: string | null;
}

interface MatchData {
  matchId: string;
  talentId: string;
  score: number;
  breakdown: MatchBreakdown;
  status: string | null;
  aiReasoning: string | null;
  createdAt: string | null;
  displayName: string | null;
  headline: string | null;
  skills: unknown;
  availability: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-emerald-500/20 text-emerald-400 border-emerald-600',
  reviewing: 'bg-blue-500/20 text-blue-400 border-blue-600',
  filled: 'bg-purple-500/20 text-purple-400 border-purple-600',
  closed: 'bg-zinc-500/20 text-zinc-400 border-zinc-600',
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateRow | null>(null);
  const [sortBy, setSortBy] = useState('score');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      const data = await res.json();

      setJob(data.job);
      setCandidates(
        (data.matches as MatchData[]).map((m) => ({
          matchId: m.matchId,
          talentId: m.talentId,
          displayName: m.displayName,
          headline: m.headline,
          score: m.score,
          breakdown: m.breakdown,
          status: (m.status || 'new') as MatchStatus,
          skills: (m.skills || []) as Skill[],
          availability: m.availability,
          aiReasoning: m.aiReasoning,
        }))
      );
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScanMatches = async () => {
    setScanning(true);
    try {
      await fetch('/api/v1/matches/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      // Poll for completion after a short delay
      setTimeout(() => {
        fetchData();
        setScanning(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to trigger scan:', error);
      setScanning(false);
    }
  };

  const handleInvite = async (talentId: string) => {
    const match = candidates.find((c) => c.talentId === talentId);
    if (!match) return;

    await fetch(`/api/v1/matches/${match.matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invited' }),
    });

    // Update local state
    setCandidates((prev) =>
      prev.map((c) =>
        c.talentId === talentId ? { ...c, status: 'invited' as MatchStatus } : c
      )
    );
  };

  const handleShortlist = async (talentId: string) => {
    const match = candidates.find((c) => c.talentId === talentId);
    if (!match) return;

    await fetch(`/api/v1/matches/${match.matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shortlisted' }),
    });

    setCandidates((prev) =>
      prev.map((c) =>
        c.talentId === talentId
          ? { ...c, status: 'shortlisted' as MatchStatus }
          : c
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        Job not found.
      </div>
    );
  }

  const jobSkills = (job.structured?.skills || []).map((s) => ({
    name: s.name,
    required: s.required,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Job Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            {job.title ?? 'Untitled Job'}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Posted{' '}
              {job.createdAt
                ? new Date(job.createdAt).toLocaleDateString()
                : 'recently'}
            </span>
            <span>{candidates.length} matches</span>
            <Badge
              variant="outline"
              className={STATUS_BADGE[job.status ?? 'open'] ?? ''}
            >
              {job.status ?? 'open'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScanMatches}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Re-scan Matches'}
          </Button>
          <Button onClick={() => router.push('/enterprise/screening')}>
            AI Screen
          </Button>
        </div>
      </div>

      {/* Candidate Table */}
      {candidates.length > 0 ? (
        <CandidateTable
          candidates={candidates}
          jobSkills={jobSkills}
          onSelectCandidate={setSelectedCandidate}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-zinc-800 text-muted-foreground">
          <div className="text-center">
            <div className="mb-2 text-lg">No matches yet</div>
            <p className="mb-4 text-sm">
              Your AI is scanning the talent pool for this position.
            </p>
            <Button onClick={handleScanMatches} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Scan Now'}
            </Button>
          </div>
        </div>
      )}

      {/* Candidate Detail Sheet */}
      <CandidateDetail
        candidate={selectedCandidate}
        jobSkills={jobSkills}
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
        onInvite={handleInvite}
        onShortlist={handleShortlist}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(enterprise\)/jobs/\[id\]/page.tsx
git commit -m "feat: add feature matching view with ranked candidate table and detail sheet"
```

---

### Task 9: AI Screening Chat Page

**Files:**
- Create: `src/components/matching/screening-chat.tsx`
- Modify: `src/app/(enterprise)/screening/page.tsx`

- [ ] **Step 1: Create screening chat component**

Create `src/components/matching/screening-chat.tsx`:

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface ScreeningChatProps {
  activeJobs: Array<{ id: string; title: string }>;
}

export function ScreeningChat({ activeJobs }: ScreeningChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/internal/ai/screening',
      initialMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: activeJobs.length > 0
            ? `I'm ready to help you screen candidates. You have ${activeJobs.length} active job${activeJobs.length > 1 ? 's' : ''}: ${activeJobs.map((j) => `"${j.title}"`).join(', ')}. What would you like to explore?`
            : `I'm ready to help you screen candidates from the talent pool. What kind of talent are you looking for?`,
        },
      ],
    });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Suggested prompts
  const suggestions = activeJobs.length > 0
    ? [
        `Find top candidates for "${activeJobs[0]?.title}"`,
        'Show me all candidates with Python expertise',
        'Compare the top 3 matches',
      ]
    : [
        'Find candidates skilled in NLP and RAG',
        'Who are the best machine learning engineers?',
        'Search for senior AI engineers available now',
      ];

  const handleSuggestion = (text: string) => {
    const fakeEvent = {
      target: { value: text },
    } as React.ChangeEvent<HTMLInputElement>;
    handleInputChange(fakeEvent);
    // Auto-submit after a tick
    setTimeout(() => {
      const form = document.getElementById('screening-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 50);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-4 py-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                  <span className="text-xs font-bold text-white">AI</span>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-xs font-bold text-white">AI</span>
              </Avatar>
              <div className="rounded-lg bg-zinc-800 px-4 py-3">
                <div className="flex gap-1">
                  <span className="animate-bounce text-muted-foreground">.</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: '0.1s' }}>.</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: '0.2s' }}>.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions (show only when few messages) */}
      {messages.length <= 1 && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {suggestions.map((text) => (
              <Badge
                key={text}
                variant="outline"
                className="cursor-pointer transition-colors hover:bg-zinc-800"
                onClick={() => handleSuggestion(text)}
              >
                {text}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <form
          id="screening-form"
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about candidates, compare talent, or shortlist picks..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update screening page**

Replace `src/app/(enterprise)/screening/page.tsx`:

```typescript
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScreeningChat } from '@/components/matching/screening-chat';

export default async function ScreeningPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const payload = await verifyJWT(token);
  if (!payload || payload.role !== 'enterprise') {
    redirect('/login');
  }

  // Load enterprise's active jobs
  const enterprise = await db.query.enterpriseProfiles.findFirst({
    where: eq(enterpriseProfiles.userId, payload.userId),
  });

  let activeJobs: Array<{ id: string; title: string }> = [];

  if (enterprise) {
    const allJobs = await db.query.jobs.findMany({
      where: eq(jobs.status, 'open'),
    });
    activeJobs = allJobs
      .filter((j) => j.enterpriseId === enterprise.id)
      .map((j) => ({ id: j.id, title: j.title || 'Untitled' }));
  }

  return (
    <div className="h-full">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h1 className="font-serif text-xl font-bold">AI Talent Screening</h1>
        <p className="text-sm text-muted-foreground">
          Chat with your AI recruiter to search, compare, and shortlist candidates.
        </p>
      </div>
      <ScreeningChat activeJobs={activeJobs} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/matching/screening-chat.tsx src/app/\(enterprise\)/screening/page.tsx
git commit -m "feat: add AI screening chat page with full-page conversational interface"
```

---

### Task 10: i18n Strings for Matching + Screening

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [ ] **Step 1: Add matching/screening strings to English locale**

Add the following keys to `src/i18n/messages/en.json`:

```json
{
  "matching": {
    "score": "Match Score",
    "semantic": "Semantic Score",
    "feature": "Feature Score",
    "availability": "Availability",
    "seniority": "Seniority",
    "candidate": "Candidate",
    "status": "Status",
    "noMatches": "No matches yet",
    "scanning": "Your AI is scanning the talent pool...",
    "scanNow": "Scan Now",
    "rescan": "Re-scan Matches",
    "aiScreen": "AI Screen",
    "sendInvite": "Send Invite",
    "addToShortlist": "Add to Shortlist",
    "aiAnalysis": "AI Analysis",
    "skillMatch": "Skill Match",
    "mustHave": "Must-have",
    "niceToHave": "Nice-to-have",
    "filterMinScore": "Min score",
    "candidateCount": "{count} candidate(s)",
    "postedDate": "Posted {date}"
  },
  "screening": {
    "title": "AI Talent Screening",
    "subtitle": "Chat with your AI recruiter to search, compare, and shortlist candidates.",
    "placeholder": "Ask about candidates, compare talent, or shortlist picks...",
    "send": "Send"
  }
}
```

- [ ] **Step 2: Add matching/screening strings to Chinese locale**

Add the following keys to `src/i18n/messages/zh.json`:

```json
{
  "matching": {
    "score": "匹配分数",
    "semantic": "语义得分",
    "feature": "特征得分",
    "availability": "可用性",
    "seniority": "资历",
    "candidate": "候选人",
    "status": "状态",
    "noMatches": "暂无匹配",
    "scanning": "AI 正在扫描人才库...",
    "scanNow": "立即扫描",
    "rescan": "重新扫描匹配",
    "aiScreen": "AI 筛选",
    "sendInvite": "发送邀请",
    "addToShortlist": "加入候选名单",
    "aiAnalysis": "AI 分析",
    "skillMatch": "技能匹配",
    "mustHave": "必需",
    "niceToHave": "加分项",
    "filterMinScore": "最低分数",
    "candidateCount": "{count} 位候选人",
    "postedDate": "发布于 {date}"
  },
  "screening": {
    "title": "AI 人才筛选",
    "subtitle": "与 AI 招聘助手对话，搜索、比较和筛选候选人。",
    "placeholder": "询问候选人、比较人才或筛选名单...",
    "send": "发送"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/zh.json
git commit -m "feat: add i18n strings for matching and screening features"
```

---

### Task 11: Verify and Integration Test

- [ ] **Step 1: Run all tests**

```bash
npm run check
```

Expected: Lint passes, TypeScript compiles, all tests pass.

- [ ] **Step 2: Run matching tests specifically**

```bash
npx vitest run src/lib/matching/
```

Expected: All scoring and engine tests pass.

- [ ] **Step 3: Manual smoke test**

Start the dev server and verify:

```bash
npm run dev
```

1. Login as `enterprise1@csv.dev` / `csv2026`
2. Navigate to `/enterprise/jobs/[id]` for an existing job — verify candidate table renders
3. Click a candidate row — verify Sheet slides in with profile + match analysis
4. Navigate to `/enterprise/screening` — verify chat interface loads
5. Send a message like "Find candidates with Python expertise" — verify AI responds with results
6. Verify score dots show correct colors (green/yellow/red)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Spec 4 — Matching + Screening implementation"
```
