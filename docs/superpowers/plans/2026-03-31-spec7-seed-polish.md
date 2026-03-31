# Spec 7: Seed Data + Demo Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the platform with 50 realistic LLM-generated talent profiles, 15 enterprise profiles, 30 jobs, computed embeddings/matches/graph, inbox items, and seeking reports — then polish empty states, loading skeletons, animations, and the landing page for a complete demo experience.

**Architecture:** A seed script (`scripts/seed.ts`) with sub-commands orchestrates sequential data generation: hardcoded users first, then LLM-generated profiles and jobs in batched prompts, followed by computed embeddings/matches/keyword-graph, and finally generated inbox items and seeking reports. Each sub-command is idempotent (checks for existing data before inserting). Demo polish adds empty-state components, Skeleton loading states, Framer Motion animations (150-300ms), and a full narrative landing page.

**Tech Stack:** TypeScript (tsx runner), Drizzle ORM, Vercel AI SDK (batch LLM generation), pgvector (embedding computation), BullMQ (matching engine), Framer Motion, shadcn/ui Skeleton, D3.js (keyword graph), next-intl

---

## File Structure

```
csv/
├── scripts/
│   ├── seed.ts                              # Main seed orchestrator + CLI
│   ├── seed/
│   │   ├── users.ts                         # Predefined 5 accounts
│   │   ├── profiles.ts                      # LLM-generated talent + enterprise profiles
│   │   ├── jobs.ts                          # LLM-generated job postings
│   │   ├── compute.ts                       # Embeddings + matches + keyword graph
│   │   ├── content.ts                       # Inbox items + seeking reports
│   │   ├── reset.ts                         # Drop all data
│   │   ├── prompts.ts                       # LLM prompt templates for generation
│   │   └── vocabulary.ts                    # Controlled skill vocabulary
├── src/
│   ├── components/
│   │   ├── empty-states/
│   │   │   ├── no-matches.tsx               # "AI is scanning..." empty state
│   │   │   ├── empty-inbox.tsx              # "No messages yet" empty state
│   │   │   ├── no-report.tsx                # "First report generating..." empty state
│   │   │   └── empty-jobs.tsx               # "No jobs posted yet" empty state
│   │   ├── loading/
│   │   │   ├── profile-skeleton.tsx          # Profile page skeleton
│   │   │   ├── match-list-skeleton.tsx       # Match list skeleton
│   │   │   ├── inbox-skeleton.tsx            # Inbox list skeleton
│   │   │   ├── report-skeleton.tsx           # Seeking report skeleton
│   │   │   ├── graph-skeleton.tsx            # Keyword graph skeleton
│   │   │   └── job-list-skeleton.tsx         # Job list skeleton
│   │   ├── animations/
│   │   │   ├── page-transition.tsx           # Fade wrapper for page content
│   │   │   ├── stagger-children.tsx          # Staggered entrance for lists
│   │   │   ├── count-up.tsx                  # Count-up number animation
│   │   │   └── pulse-dot.tsx                 # Green pulse indicator
│   │   └── landing/
│   │       ├── hero-section.tsx              # Hero with headline + CTAs
│   │       ├── how-it-works.tsx              # 3-step flows for both sides
│   │       ├── feature-highlights.tsx        # Feature preview cards
│   │       └── final-cta.tsx                 # Bottom CTA section
│   ├── app/
│   │   └── page.tsx                         # Modify: full landing page
│   └── i18n/
│       └── messages/
│           ├── en.json                      # Modify: add landing page strings
│           └── zh.json                      # Modify: add landing page strings
├── package.json                             # Modify: add seed sub-commands
└── __tests__/
    ├── seed/
    │   └── vocabulary.test.ts               # Vocabulary consistency test
    └── e2e/
        └── flow-checklist.test.ts           # End-to-end flow smoke tests
```

---

### Task 1: Controlled Skill Vocabulary

**Files:**
- Create: `scripts/seed/vocabulary.ts`
- Create: `__tests__/seed/vocabulary.test.ts`

This is the foundation all seed data references. Every skill name across all 50 talent profiles and 30 jobs must use these exact strings.

- [x] **Step 1: Write vocabulary test**

Create `__tests__/seed/vocabulary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SKILL_VOCABULARY,
  SKILL_CATEGORIES,
  getSkillsByCategory,
  isValidSkillName,
} from '../../scripts/seed/vocabulary';

describe('Controlled Skill Vocabulary', () => {
  it('has at least 60 skills across all categories', () => {
    const allSkills = Object.values(SKILL_VOCABULARY).flat();
    expect(allSkills.length).toBeGreaterThanOrEqual(60);
  });

  it('has 7 specialization categories', () => {
    expect(SKILL_CATEGORIES.length).toBe(7);
  });

  it('has no duplicate skill names across categories', () => {
    const allSkills = Object.values(SKILL_VOCABULARY).flat();
    const uniqueSkills = new Set(allSkills);
    expect(uniqueSkills.size).toBe(allSkills.length);
  });

  it('getSkillsByCategory returns correct skills', () => {
    const nlpSkills = getSkillsByCategory('NLP/RAG');
    expect(nlpSkills.length).toBeGreaterThan(0);
    expect(nlpSkills.every((s) => typeof s === 'string')).toBe(true);
  });

  it('isValidSkillName validates correctly', () => {
    const firstSkill = Object.values(SKILL_VOCABULARY).flat()[0]!;
    expect(isValidSkillName(firstSkill)).toBe(true);
    expect(isValidSkillName('not-a-real-skill-xyz')).toBe(false);
  });
});
```

- [x] **Step 2: Create vocabulary module**

Create `scripts/seed/vocabulary.ts`:

```typescript
/**
 * Controlled skill vocabulary for CSV seed data.
 * Every talent profile skill and job requirement MUST use these exact names.
 * This ensures consistent matching across the platform.
 */

export const SKILL_CATEGORIES = [
  'NLP/RAG',
  'AI Agent/Framework',
  'Data Analysis/ML',
  'Computer Vision',
  'Prompt Engineering',
  'Fine-tuning/Training',
  'Full-stack+AI',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_VOCABULARY: Record<SkillCategory, string[]> = {
  'NLP/RAG': [
    'LangChain',
    'LlamaIndex',
    'RAG Pipeline',
    'Vector Database',
    'Pinecone',
    'Weaviate',
    'ChromaDB',
    'Milvus',
    'Text Embedding',
    'Semantic Search',
    'Document Parsing',
    'Chunking Strategy',
    'Prompt Chaining',
    'Retrieval Optimization',
    'Knowledge Graph',
    'NLP Preprocessing',
    'Named Entity Recognition',
    'Text Classification',
    'Sentiment Analysis',
    'Summarization',
  ],
  'AI Agent/Framework': [
    'AutoGPT',
    'CrewAI',
    'AutoGen',
    'LangGraph',
    'Tool Calling',
    'Function Calling',
    'Agent Orchestration',
    'Multi-Agent Systems',
    'ReAct Pattern',
    'Chain-of-Thought',
    'Planning Algorithms',
    'MCP Protocol',
    'Agent Memory',
    'Task Decomposition',
  ],
  'Data Analysis/ML': [
    'Python',
    'PyTorch',
    'TensorFlow',
    'Scikit-learn',
    'Pandas',
    'NumPy',
    'Data Visualization',
    'Feature Engineering',
    'Model Evaluation',
    'A/B Testing',
    'Statistical Modeling',
    'Time Series Analysis',
    'Recommendation Systems',
    'Anomaly Detection',
  ],
  'Computer Vision': [
    'OpenCV',
    'YOLO',
    'Image Segmentation',
    'Object Detection',
    'Image Classification',
    'OCR',
    'Stable Diffusion',
    'Midjourney Prompt',
    'GANs',
    'ControlNet',
    'Image Generation',
    'Video Analysis',
  ],
  'Prompt Engineering': [
    'System Prompt Design',
    'Few-Shot Prompting',
    'Chain-of-Thought Prompting',
    'Prompt Optimization',
    'Structured Output',
    'Guardrails',
    'Prompt Testing',
    'Red Teaming',
    'Evaluation Framework',
    'Instruction Tuning Design',
  ],
  'Fine-tuning/Training': [
    'LoRA',
    'QLoRA',
    'PEFT',
    'RLHF',
    'DPO',
    'SFT',
    'Dataset Curation',
    'Training Pipeline',
    'Model Compression',
    'Quantization',
    'Knowledge Distillation',
    'Distributed Training',
    'DeepSpeed',
    'vLLM',
  ],
  'Full-stack+AI': [
    'Next.js',
    'React',
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Redis',
    'Vercel AI SDK',
    'OpenAI API',
    'Anthropic API',
    'Streaming UI',
    'WebSocket',
    'Docker',
    'Kubernetes',
    'CI/CD',
  ],
};

/** Flat list of all valid skill names */
export const ALL_SKILLS: string[] = Object.values(SKILL_VOCABULARY).flat();

/** Set for O(1) lookup */
const SKILL_SET = new Set(ALL_SKILLS);

/** Check if a skill name is in the controlled vocabulary */
export function isValidSkillName(name: string): boolean {
  return SKILL_SET.has(name);
}

/** Get skills for a given category */
export function getSkillsByCategory(category: SkillCategory): string[] {
  return SKILL_VOCABULARY[category] ?? [];
}

/** Get category for a given skill name */
export function getCategoryForSkill(name: string): SkillCategory | null {
  for (const [category, skills] of Object.entries(SKILL_VOCABULARY)) {
    if (skills.includes(name)) return category as SkillCategory;
  }
  return null;
}

/**
 * Chinese family names — common + less common mix
 */
export const CHINESE_FAMILY_NAMES = [
  '张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '胡', '朱', '郭', '何', '林', '罗', '高',
  '梁', '宋', '唐', '许', '邓', '冯', '韩', '曹', '彭', '萧',
  '蔡', '潘', '田', '董', '袁', '于', '余', '叶', '蒋', '杜',
  '苏', '魏', '程', '吕', '丁', '沈', '任', '姚', '卢', '傅',
  '钟', '姜', '崔', '谭', '廖', '范', '汪', '陆', '金', '石',
];

/**
 * Chinese given names — 1 or 2 characters, diverse gender presentation
 */
export const CHINESE_GIVEN_NAMES = [
  '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞', '平',
  '刚', '桂英', '文', '云', '建华', '玉兰', '建国', '淑珍', '志强', '秀珍',
  '思远', '子涵', '梓萱', '浩然', '欣怡', '宇轩', '雨桐', '博文', '诗涵', '俊杰',
  '天翔', '晓萌', '嘉琪', '子墨', '一诺', '梦琪', '皓轩', '诗雨', '子豪', '若溪',
  '致远', '语嫣', '昊天', '思琪', '鑫磊', '雅琴', '睿哲', '紫萱', '旭东', '雨菲',
];

/**
 * Fictional Chinese company names
 */
export const COMPANY_NAMES = [
  '星辰智能科技', '深蓝数据', '量子跃迁科技', '灵犀AI',
  '鲲鹏云智', '银河算力', '玄武安全', '凤凰智联',
  '麒麟大模型', '青龙机器人', '白泽研究院', '朝云科技',
  '九章智算', '墨子AI', '仓颉科技', '神农智慧',
  '华清智能', '中关村智谷', '西湖数智', '松山湖AI',
];

/**
 * Seniority level distributions for seed
 */
export const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

/**
 * Background types for talent diversity
 */
export const BACKGROUND_TYPES = [
  'industry_engineer',
  'researcher_phd',
  'freelancer',
  'career_changer',
  'student',
  'startup_founder',
] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

/**
 * Availability states
 */
export const AVAILABILITY_STATES = ['open', 'busy', 'not_looking'] as const;
```

- [x] **Step 3: Run test**

```bash
npx vitest run __tests__/seed/vocabulary.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed/vocabulary.ts __tests__/seed/vocabulary.test.ts
git commit -m "feat(seed): add controlled skill vocabulary with 90+ normalized skill names"
```

---

### Task 2: LLM Prompt Templates

**Files:**
- Create: `scripts/seed/prompts.ts`

These are the exact prompts sent to the configured LLM to generate seed data.

- [x] **Step 1: Create prompts module**

Create `scripts/seed/prompts.ts`:

```typescript
import { ALL_SKILLS, SKILL_VOCABULARY, CHINESE_FAMILY_NAMES, CHINESE_GIVEN_NAMES, COMPANY_NAMES } from './vocabulary';

/**
 * Builds the talent profile generation prompt.
 * Called in batches of 10 to stay within token limits.
 */
export function buildTalentProfilePrompt(batch: {
  batchIndex: number;
  count: number;
  specialization: string;
  seniorityMix: string;
  backgroundMix: string;
  availabilityMix: string;
  existingNames: string[];
}): string {
  const skillList = SKILL_VOCABULARY[batch.specialization as keyof typeof SKILL_VOCABULARY] ?? ALL_SKILLS;
  const usedNamesClause = batch.existingNames.length > 0
    ? `\nAlready used names (DO NOT reuse): ${batch.existingNames.join(', ')}`
    : '';

  return `You are a data generator for an AI talent matching platform. Generate exactly ${batch.count} realistic Chinese AI professional profiles.

CRITICAL RULES:
1. All names MUST be realistic Chinese names (family name + given name, 2-3 characters total)
2. Use ONLY skills from this controlled vocabulary — do NOT invent skill names: ${JSON.stringify(skillList)}
3. Cross-domain skills are allowed — pick 1-3 skills from other categories: ${ALL_SKILLS.filter(s => !skillList.includes(s)).slice(0, 30).join(', ')}
4. Companies must be fictional Chinese companies — plausible but not real
5. Project descriptions must be SPECIFIC and TECHNICAL — include metrics, scale, and concrete details
6. Each profile must feel like a distinct individual with a coherent career narrative
${usedNamesClause}

SPECIALIZATION: ${batch.specialization}
SENIORITY DISTRIBUTION: ${batch.seniorityMix}
BACKGROUND DISTRIBUTION: ${batch.backgroundMix}
AVAILABILITY DISTRIBUTION: ${batch.availabilityMix}

Return a JSON array. Each element has this exact structure:
{
  "displayName": "张伟",
  "headline": "Senior NLP Engineer | RAG Pipeline Specialist",
  "bio": "5年NLP工程经验，专注于大规模检索增强生成系统...",
  "skills": [
    { "name": "RAG Pipeline", "level": "expert", "category": "NLP/RAG" },
    { "name": "LangChain", "level": "advanced", "category": "NLP/RAG" },
    { "name": "Python", "level": "expert", "category": "Data Analysis/ML" }
  ],
  "experience": [
    {
      "company": "星辰智能科技",
      "role": "Senior NLP Engineer",
      "startDate": "2021-03",
      "endDate": "present",
      "description": "Built RAG pipeline processing 10K legal documents daily with 95% retrieval accuracy using LlamaIndex + Milvus. Reduced inference latency from 2.1s to 380ms through chunk optimization and hybrid search."
    }
  ],
  "education": [
    {
      "school": "北京大学",
      "degree": "硕士",
      "field": "计算机科学",
      "year": 2019
    }
  ],
  "goals": {
    "targetRoles": ["AI Architect", "Tech Lead"],
    "workPreference": "remote",
    "interests": ["Large-scale RAG systems", "Multi-agent orchestration"]
  },
  "availability": "open",
  "salaryRange": { "min": 40, "max": 60, "currency": "万/年" },
  "seniority": "senior",
  "background": "industry_engineer",
  "yearsOfExperience": 5
}

QUALITY CHECKLIST — every profile must have:
- 5-10 skills from the controlled vocabulary (mix of levels)
- 1-3 experience entries with SPECIFIC metrics (numbers, percentages, scale)
- At least 1 education entry
- Bio in Chinese (2-4 sentences, technical and specific)
- Headline in English (role + specialization)
- Salary in 万/年 (10K RMB/year units), realistic for seniority
- Distinct personality — avoid generic descriptions

Return ONLY the JSON array, no markdown fencing.`;
}

/**
 * Builds the enterprise profile generation prompt.
 */
export function buildEnterpriseProfilePrompt(count: number): string {
  return `You are a data generator for an AI talent matching platform. Generate exactly ${count} realistic Chinese enterprise profiles.

CRITICAL RULES:
1. Company names must be fictional but plausible Chinese tech companies
2. Mix of company sizes: 4 startups (<50), 5 mid-size (50-500), 4 large (500-5000), 2 tech giants (5000+)
3. Mix of industries: AI/ML, fintech, healthcare AI, autonomous driving, EdTech, e-commerce, enterprise SaaS, robotics, gaming AI, cybersecurity
4. AI maturity levels: "exploring" (3), "adopting" (5), "scaling" (4), "leading" (3)
5. Each company must have a distinct identity and realistic description

Return a JSON array. Each element:
{
  "companyName": "星辰智能科技",
  "industry": "AI/ML Platform",
  "companySize": "50-200",
  "website": "https://xingchen-ai.example.com",
  "description": "专注于企业级RAG解决方案的AI初创公司，为金融和法律行业提供智能文档处理平台。成立于2022年，已服务超过200家企业客户。",
  "aiMaturity": "scaling",
  "preferences": {
    "autoMatch": true,
    "autoPrechat": false,
    "dealBreakers": ["no_remote"],
    "preferredSeniority": ["mid", "senior"]
  }
}

Return ONLY the JSON array, no markdown fencing.`;
}

/**
 * Builds the job posting generation prompt.
 * Jobs are generated per enterprise to maintain consistency.
 */
export function buildJobPostingsPrompt(enterprise: {
  companyName: string;
  industry: string;
  companySize: string;
  aiMaturity: string;
  jobCount: number;
}): string {
  return `You are a data generator for an AI talent matching platform. Generate exactly ${enterprise.jobCount} job postings for this company:

Company: ${enterprise.companyName}
Industry: ${enterprise.industry}
Size: ${enterprise.companySize}
AI Maturity: ${enterprise.aiMaturity}

CRITICAL RULES:
1. Skills MUST use ONLY these exact names from our controlled vocabulary: ${JSON.stringify(ALL_SKILLS)}
2. Each job must have 4-8 required skills with must-have/nice-to-have distinction
3. Job descriptions should be detailed (3-5 paragraphs) with specific project context
4. Seniority must match company size and role complexity
5. Budget ranges in 万/年, realistic for the role and seniority
6. Mix of work modes: remote, onsite, hybrid

Return a JSON array. Each element:
{
  "title": "Senior RAG Engineer",
  "description": "We are building a next-generation intelligent document processing platform for the financial industry. This role involves designing and implementing production-grade RAG pipelines that handle millions of documents with sub-second latency...\\n\\nYou will work closely with our NLP research team to integrate cutting-edge retrieval techniques including hybrid search, re-ranking, and multi-hop reasoning. The ideal candidate has hands-on experience building RAG systems at scale and a deep understanding of vector databases and embedding optimization.\\n\\nKey responsibilities:\\n- Design and implement production RAG pipelines processing 1M+ documents\\n- Optimize retrieval accuracy and latency for enterprise SLA requirements\\n- Collaborate with frontend team on streaming AI response integration\\n- Mentor junior engineers on RAG architecture best practices",
  "structured": {
    "skills": [
      { "name": "RAG Pipeline", "required": true },
      { "name": "LangChain", "required": true },
      { "name": "Vector Database", "required": true },
      { "name": "Python", "required": true },
      { "name": "Semantic Search", "required": false },
      { "name": "Chunking Strategy", "required": false }
    ],
    "seniority": "senior",
    "timeline": { "startDate": "2026-05", "duration": "full-time" },
    "deliverables": [],
    "budgetRange": { "min": 50, "max": 80, "currency": "万/年" },
    "workMode": "hybrid",
    "location": "北京"
  }
}

Return ONLY the JSON array, no markdown fencing.`;
}

/**
 * Builds the AI reasoning prompt for match explanations.
 */
export function buildMatchReasoningPrompt(talent: {
  displayName: string;
  headline: string;
  skills: Array<{ name: string; level: string }>;
  experience: Array<{ role: string; company: string; description: string }>;
}, job: {
  title: string;
  companyName: string;
  description: string;
  skills: Array<{ name: string; required: boolean }>;
}, score: number): string {
  return `Analyze the match between this candidate and job posting. Write a concise 2-3 sentence compatibility analysis in Chinese.

CANDIDATE:
Name: ${talent.displayName}
Headline: ${talent.headline}
Skills: ${talent.skills.map(s => `${s.name} (${s.level})`).join(', ')}
Recent Experience: ${talent.experience[0]?.description ?? 'N/A'}

JOB:
Title: ${job.title} at ${job.companyName}
Required Skills: ${job.skills.filter(s => s.required).map(s => s.name).join(', ')}
Nice-to-have: ${job.skills.filter(s => !s.required).map(s => s.name).join(', ')}

MATCH SCORE: ${score}/100

Write the analysis focusing on:
1. Why the score is what it is (which skills match/mismatch)
2. One strength and one potential concern
3. Keep it professional and specific

Return ONLY the analysis text, no JSON.`;
}

/**
 * Builds the seeking report generation prompt.
 */
export function buildSeekingReportPrompt(talent: {
  displayName: string;
  headline: string;
  skills: Array<{ name: string; level: string }>;
  goals: { targetRoles?: string[]; interests?: string[] };
}, matches: Array<{
  jobTitle: string;
  companyName: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
}>): string {
  return `Generate a seeking report summary for this talent. Write in Chinese.

TALENT:
Name: ${talent.displayName}
Headline: ${talent.headline}
Target Roles: ${talent.goals.targetRoles?.join(', ') ?? '未设定'}
Interests: ${talent.goals.interests?.join(', ') ?? '未设定'}

RECENT MATCHES (${matches.length} total):
${matches.map((m, i) => `${i + 1}. ${m.jobTitle} at ${m.companyName} — Score: ${m.score}/100
   Matched: ${m.matchedSkills.join(', ')}
   Missing: ${m.missingSkills.join(', ')}`).join('\n')}

Generate a JSON report:
{
  "summary": "本周扫描了 X 个新职位，发现 Y 个高匹配度机会...",
  "highlights": ["highlight1", "highlight2"],
  "skillGaps": ["gap1", "gap2"],
  "marketInsight": "当前市场对 RAG 工程师需求旺盛...",
  "recommendations": ["recommendation1", "recommendation2"]
}

Return ONLY the JSON, no markdown fencing.`;
}

/**
 * Builds the inbox item content for match notifications.
 */
export function buildInboxMatchContent(
  type: 'talent_match' | 'enterprise_match' | 'invite' | 'prechat_summary',
  data: Record<string, unknown>,
): { title: string; content: Record<string, unknown> } {
  switch (type) {
    case 'talent_match':
      return {
        title: `新匹配: ${data.jobTitle} — ${data.companyName}`,
        content: {
          type: 'match_notification',
          jobId: data.jobId,
          jobTitle: data.jobTitle,
          companyName: data.companyName,
          score: data.score,
          matchedSkills: data.matchedSkills,
          message: `您与「${data.companyName}」的「${data.jobTitle}」职位匹配度为 ${data.score}%`,
        },
      };
    case 'enterprise_match':
      return {
        title: `新候选人: ${data.talentName} — 匹配度 ${data.score}%`,
        content: {
          type: 'match_notification',
          talentId: data.talentId,
          talentName: data.talentName,
          talentHeadline: data.talentHeadline,
          jobId: data.jobId,
          score: data.score,
          message: `「${data.talentName}」与您的职位匹配度为 ${data.score}%`,
        },
      };
    case 'invite':
      return {
        title: `面试邀请: ${data.companyName} — ${data.jobTitle}`,
        content: {
          type: 'invite',
          jobId: data.jobId,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          message: data.message ?? `${data.companyName} 邀请您参加「${data.jobTitle}」职位的面试`,
        },
      };
    case 'prechat_summary':
      return {
        title: `AI 预聊天摘要: ${data.companyName}`,
        content: {
          type: 'prechat_summary',
          jobId: data.jobId,
          companyName: data.companyName,
          summary: data.summary,
          highlights: data.highlights,
        },
      };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/prompts.ts
git commit -m "feat(seed): add LLM prompt templates for seed data generation"
```

---

### Task 3: Seed Users (Predefined Accounts)

**Files:**
- Create: `scripts/seed/users.ts`

- [x] **Step 1: Create users seed**

Create `scripts/seed/users.ts`:

```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const PREDEFINED_ACCOUNTS = [
  { email: 'talent1@csv.dev', role: 'talent' as const },
  { email: 'talent2@csv.dev', role: 'talent' as const },
  { email: 'talent3@csv.dev', role: 'talent' as const },
  { email: 'enterprise1@csv.dev', role: 'enterprise' as const },
  { email: 'enterprise2@csv.dev', role: 'enterprise' as const },
];

const DEFAULT_PASSWORD = 'csv2026';

export async function seedUsers(): Promise<string[]> {
  console.log('🔑 Seeding predefined user accounts...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const createdIds: string[] = [];

  for (const account of PREDEFINED_ACCOUNTS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ ${account.email} already exists (${existing[0]!.id})`);
      createdIds.push(existing[0]!.id);
      continue;
    }

    const [created] = await db
      .insert(users)
      .values({
        email: account.email,
        passwordHash,
        role: account.role,
      })
      .returning({ id: users.id });

    console.log(`  + ${account.email} created (${created!.id})`);
    createdIds.push(created!.id);
  }

  console.log(`✅ ${createdIds.length} user accounts ready.\n`);
  return createdIds;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/users.ts
git commit -m "feat(seed): add predefined user account seeding"
```

---

### Task 4: Seed Profiles (LLM-Generated)

**Files:**
- Create: `scripts/seed/profiles.ts`

- [x] **Step 1: Create profiles seed**

Create `scripts/seed/profiles.ts`:

```typescript
import { db } from '@/lib/db';
import { users, talentProfiles, enterpriseProfiles } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai/providers';
import {
  buildTalentProfilePrompt,
  buildEnterpriseProfilePrompt,
} from './prompts';
import {
  SKILL_VOCABULARY,
  SKILL_CATEGORIES,
  isValidSkillName,
  CHINESE_FAMILY_NAMES,
  CHINESE_GIVEN_NAMES,
} from './vocabulary';
import bcrypt from 'bcrypt';

/**
 * Distribution plan for 50 talent profiles across specializations.
 */
const TALENT_BATCHES = [
  {
    specialization: 'NLP/RAG',
    count: 12,
    seniorityMix: '3 senior, 5 mid, 3 junior, 1 student',
    backgroundMix: '5 industry_engineer, 2 researcher_phd, 2 freelancer, 1 career_changer, 1 student, 1 startup_founder',
    availabilityMix: '7 open, 3 busy, 2 not_looking',
  },
  {
    specialization: 'AI Agent/Framework',
    count: 10,
    seniorityMix: '3 senior, 4 mid, 2 junior, 1 student',
    backgroundMix: '4 industry_engineer, 2 researcher_phd, 2 freelancer, 1 career_changer, 1 startup_founder',
    availabilityMix: '6 open, 2 busy, 2 not_looking',
  },
  {
    specialization: 'Data Analysis/ML',
    count: 8,
    seniorityMix: '2 senior, 3 mid, 2 junior, 1 student',
    backgroundMix: '3 industry_engineer, 2 researcher_phd, 1 freelancer, 1 career_changer, 1 student',
    availabilityMix: '5 open, 2 busy, 1 not_looking',
  },
  {
    specialization: 'Computer Vision',
    count: 6,
    seniorityMix: '2 senior, 2 mid, 1 junior, 1 student',
    backgroundMix: '2 industry_engineer, 2 researcher_phd, 1 freelancer, 1 student',
    availabilityMix: '4 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Prompt Engineering',
    count: 5,
    seniorityMix: '1 senior, 2 mid, 1 junior, 1 student',
    backgroundMix: '2 industry_engineer, 1 career_changer, 1 freelancer, 1 student',
    availabilityMix: '3 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Fine-tuning/Training',
    count: 5,
    seniorityMix: '2 senior, 2 mid, 1 junior',
    backgroundMix: '2 industry_engineer, 2 researcher_phd, 1 startup_founder',
    availabilityMix: '3 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Full-stack+AI',
    count: 4,
    seniorityMix: '1 senior, 2 mid, 1 junior',
    backgroundMix: '2 industry_engineer, 1 freelancer, 1 career_changer',
    availabilityMix: '2 open, 2 busy',
  },
];

/**
 * Generates and inserts talent profiles using LLM.
 * Creates a user account + talent_profile for each generated profile.
 * The 3 demo talent accounts (talent1-3@csv.dev) are assigned the first 3 profiles.
 */
export async function seedTalentProfiles(): Promise<void> {
  console.log('👤 Generating talent profiles via LLM...');
  const provider = getAIProvider();

  // Get demo talent user IDs
  const demoTalentUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'talent'));

  // Check existing profile count
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(talentProfiles);

  if (Number(existingCount) >= 50) {
    console.log('  ✓ 50+ talent profiles already exist, skipping.\n');
    return;
  }

  const existingNames: string[] = [];
  let profileIndex = 0;
  const DEFAULT_PASSWORD_HASH = await bcrypt.hash('csv2026', 10);

  for (const batch of TALENT_BATCHES) {
    console.log(`  Generating ${batch.count} ${batch.specialization} profiles...`);

    const prompt = buildTalentProfilePrompt({
      batchIndex: TALENT_BATCHES.indexOf(batch),
      count: batch.count,
      specialization: batch.specialization,
      seniorityMix: batch.seniorityMix,
      backgroundMix: batch.backgroundMix,
      availabilityMix: batch.availabilityMix,
      existingNames,
    });

    const { text } = await generateText({
      model: provider,
      prompt,
      maxTokens: 8000,
      temperature: 0.9,
    });

    let profiles: any[];
    try {
      // Strip any markdown fencing the LLM might add
      const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      profiles = JSON.parse(cleaned);
    } catch (e) {
      console.error(`  ✗ Failed to parse LLM response for ${batch.specialization}:`, e);
      console.error(`  Raw response (first 500 chars): ${text.slice(0, 500)}`);
      continue;
    }

    // Validate and insert each profile
    for (const profile of profiles) {
      // Validate skills against vocabulary
      const validatedSkills = (profile.skills ?? []).filter((s: any) => {
        if (!isValidSkillName(s.name)) {
          console.warn(`    ⚠ Dropping invalid skill "${s.name}" from ${profile.displayName}`);
          return false;
        }
        return true;
      });

      if (validatedSkills.length < 3) {
        console.warn(`    ⚠ ${profile.displayName} has too few valid skills (${validatedSkills.length}), padding...`);
        // Pad with random skills from the specialization
        const catSkills = SKILL_VOCABULARY[batch.specialization as keyof typeof SKILL_VOCABULARY] ?? [];
        for (const skillName of catSkills) {
          if (validatedSkills.length >= 5) break;
          if (!validatedSkills.some((s: any) => s.name === skillName)) {
            validatedSkills.push({ name: skillName, level: 'intermediate', category: batch.specialization });
          }
        }
      }

      // Determine which user account to link
      let userId: string;
      if (profileIndex < demoTalentUsers.length) {
        // Link to demo account
        userId = demoTalentUsers[profileIndex]!.id;
        console.log(`    → Linking ${profile.displayName} to ${demoTalentUsers[profileIndex]!.email}`);
      } else {
        // Create a new user account for this profile
        const email = `talent-seed-${profileIndex + 1}@csv.dev`;
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            passwordHash: DEFAULT_PASSWORD_HASH,
            role: 'talent',
          })
          .onConflictDoNothing()
          .returning({ id: users.id });

        if (newUser) {
          userId = newUser.id;
        } else {
          const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email));
          userId = existing!.id;
        }
      }

      // Insert talent profile
      await db
        .insert(talentProfiles)
        .values({
          userId,
          displayName: profile.displayName,
          headline: profile.headline,
          bio: profile.bio,
          skills: validatedSkills,
          experience: profile.experience ?? [],
          education: profile.education ?? [],
          goals: profile.goals ?? {},
          availability: profile.availability ?? 'open',
          salaryRange: profile.salaryRange ?? null,
          profileData: {
            seniority: profile.seniority,
            background: profile.background,
            yearsOfExperience: profile.yearsOfExperience,
            specialization: batch.specialization,
          },
          onboardingDone: true,
        })
        .onConflictDoNothing();

      existingNames.push(profile.displayName);
      profileIndex++;
    }

    console.log(`  ✓ ${profiles.length} ${batch.specialization} profiles inserted.`);
  }

  console.log(`✅ ${profileIndex} talent profiles generated.\n`);
}

/**
 * Generates and inserts enterprise profiles using LLM.
 */
export async function seedEnterpriseProfiles(): Promise<void> {
  console.log('🏢 Generating enterprise profiles via LLM...');
  const provider = getAIProvider();

  // Check existing
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enterpriseProfiles);

  if (Number(existingCount) >= 15) {
    console.log('  ✓ 15+ enterprise profiles already exist, skipping.\n');
    return;
  }

  // Get demo enterprise user IDs
  const demoEnterpriseUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'enterprise'));

  const prompt = buildEnterpriseProfilePrompt(15);

  const { text } = await generateText({
    model: provider,
    prompt,
    maxTokens: 6000,
    temperature: 0.8,
  });

  let profiles: any[];
  try {
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
    profiles = JSON.parse(cleaned);
  } catch (e) {
    console.error('  ✗ Failed to parse LLM response for enterprise profiles:', e);
    console.error(`  Raw response (first 500 chars): ${text.slice(0, 500)}`);
    return;
  }

  const DEFAULT_PASSWORD_HASH = await bcrypt.hash('csv2026', 10);
  let profileIndex = 0;

  for (const profile of profiles) {
    let userId: string;
    if (profileIndex < demoEnterpriseUsers.length) {
      userId = demoEnterpriseUsers[profileIndex]!.id;
      console.log(`    → Linking ${profile.companyName} to ${demoEnterpriseUsers[profileIndex]!.email}`);
    } else {
      const email = `enterprise-seed-${profileIndex + 1}@csv.dev`;
      const [newUser] = await db
        .insert(users)
        .values({ email, passwordHash: DEFAULT_PASSWORD_HASH, role: 'enterprise' })
        .onConflictDoNothing()
        .returning({ id: users.id });

      if (newUser) {
        userId = newUser.id;
      } else {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        userId = existing!.id;
      }
    }

    await db
      .insert(enterpriseProfiles)
      .values({
        userId,
        companyName: profile.companyName,
        industry: profile.industry,
        companySize: profile.companySize,
        website: profile.website,
        description: profile.description,
        aiMaturity: profile.aiMaturity,
        profileData: {},
        preferences: profile.preferences ?? {},
        onboardingDone: true,
      })
      .onConflictDoNothing();

    profileIndex++;
  }

  console.log(`✅ ${profileIndex} enterprise profiles generated.\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/profiles.ts
git commit -m "feat(seed): add LLM-powered talent and enterprise profile generation"
```

---

### Task 5: Seed Jobs (LLM-Generated)

**Files:**
- Create: `scripts/seed/jobs.ts`

- [x] **Step 1: Create jobs seed**

Create `scripts/seed/jobs.ts`:

```typescript
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai/providers';
import { buildJobPostingsPrompt } from './prompts';
import { isValidSkillName } from './vocabulary';

/**
 * Distribution: 30 jobs across 15 enterprises.
 * Larger companies get more postings.
 */
function getJobCountForSize(companySize: string): number {
  if (companySize.includes('5000') || companySize.includes('10000')) return 3;
  if (companySize.includes('500') || companySize.includes('1000')) return 2;
  if (companySize.includes('200')) return 2;
  return 1; // startups get 1-2
}

export async function seedJobs(): Promise<void> {
  console.log('📋 Generating job postings via LLM...');
  const provider = getAIProvider();

  // Check existing
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs);

  if (Number(existingCount) >= 30) {
    console.log('  ✓ 30+ jobs already exist, skipping.\n');
    return;
  }

  // Fetch all enterprise profiles
  const enterprises = await db.select().from(enterpriseProfiles);

  if (enterprises.length === 0) {
    console.error('  ✗ No enterprise profiles found. Run seed:profiles first.');
    return;
  }

  let totalJobs = 0;
  const targetTotal = 30;

  // Distribute jobs — first pass: assign by size
  const jobCounts: Map<string, number> = new Map();
  let assignedTotal = 0;
  for (const e of enterprises) {
    const count = getJobCountForSize(e.companySize ?? '50');
    jobCounts.set(e.id, count);
    assignedTotal += count;
  }

  // Adjust to hit exactly 30
  if (assignedTotal < targetTotal) {
    // Add extras to the first N enterprises
    let remaining = targetTotal - assignedTotal;
    for (const e of enterprises) {
      if (remaining <= 0) break;
      jobCounts.set(e.id, (jobCounts.get(e.id) ?? 1) + 1);
      remaining--;
    }
  }

  for (const enterprise of enterprises) {
    const jobCount = jobCounts.get(enterprise.id) ?? 1;
    console.log(`  Generating ${jobCount} jobs for ${enterprise.companyName}...`);

    const prompt = buildJobPostingsPrompt({
      companyName: enterprise.companyName ?? 'Unknown',
      industry: enterprise.industry ?? 'AI',
      companySize: enterprise.companySize ?? '50-200',
      aiMaturity: enterprise.aiMaturity ?? 'adopting',
      jobCount,
    });

    const { text } = await generateText({
      model: provider,
      prompt,
      maxTokens: 5000,
      temperature: 0.8,
    });

    let postings: any[];
    try {
      const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      postings = JSON.parse(cleaned);
    } catch (e) {
      console.error(`  ✗ Failed to parse jobs for ${enterprise.companyName}:`, e);
      continue;
    }

    for (const posting of postings) {
      // Validate skills
      if (posting.structured?.skills) {
        posting.structured.skills = posting.structured.skills.filter((s: any) => {
          if (!isValidSkillName(s.name)) {
            console.warn(`    ⚠ Dropping invalid job skill "${s.name}"`);
            return false;
          }
          return true;
        });
      }

      await db.insert(jobs).values({
        enterpriseId: enterprise.id,
        title: posting.title,
        description: posting.description,
        structured: posting.structured,
        status: 'open',
        autoMatch: true,
        autoPrechat: Math.random() > 0.7, // 30% have auto-prechat
      });

      totalJobs++;
    }

    console.log(`  ✓ ${postings.length} jobs inserted for ${enterprise.companyName}.`);
  }

  console.log(`✅ ${totalJobs} job postings generated.\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/jobs.ts
git commit -m "feat(seed): add LLM-powered job posting generation with skill validation"
```

---

### Task 6: Compute Embeddings, Matches, and Keyword Graph

**Files:**
- Create: `scripts/seed/compute.ts`

- [x] **Step 1: Create compute seed**

Create `scripts/seed/compute.ts`:

```typescript
import { db } from '@/lib/db';
import { talentProfiles, enterpriseProfiles, jobs, matches, keywordNodes, keywordEdges } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { embed } from 'ai';
import { generateText } from 'ai';
import { getAIProvider, getEmbeddingModel } from '@/lib/ai/providers';
import { buildMatchReasoningPrompt } from './prompts';

/**
 * Build text block for embedding from a talent profile.
 */
function buildTalentEmbeddingText(profile: any): string {
  const skills = (profile.skills as any[])?.map((s: any) => s.name).join(', ') ?? '';
  const experience = (profile.experience as any[])
    ?.map((e: any) => `${e.role} at ${e.company}: ${e.description}`)
    .join('. ') ?? '';

  return [
    profile.displayName,
    profile.headline,
    skills,
    experience,
    profile.bio,
  ].filter(Boolean).join('\n');
}

/**
 * Build text block for embedding from a job posting.
 */
function buildJobEmbeddingText(job: any): string {
  const structured = job.structured as any;
  const skills = structured?.skills?.map((s: any) => s.name).join(', ') ?? '';

  return [
    job.title,
    job.description,
    `Required skills: ${skills}`,
    `Seniority: ${structured?.seniority ?? ''}`,
    `Work mode: ${structured?.workMode ?? ''}`,
  ].filter(Boolean).join('\n');
}

/**
 * Step 1: Compute embeddings for all profiles and jobs.
 * Uses raw SQL for pgvector column updates since Drizzle doesn't natively support vector type.
 */
export async function computeEmbeddings(): Promise<void> {
  console.log('🧮 Computing embeddings...');
  const embeddingModel = getEmbeddingModel();

  // Talent profiles
  const allTalent = await db.select().from(talentProfiles);
  let talentEmbedded = 0;

  for (const profile of allTalent) {
    const text = buildTalentEmbeddingText(profile);
    if (!text.trim()) continue;

    try {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text,
      });

      // Update via raw SQL for vector column
      await db.execute(
        sql`UPDATE talent_profiles SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${profile.id}`
      );
      talentEmbedded++;

      if (talentEmbedded % 10 === 0) {
        console.log(`  Embedded ${talentEmbedded}/${allTalent.length} talent profiles...`);
      }
    } catch (e) {
      console.error(`  ✗ Failed to embed ${profile.displayName}:`, e);
    }
  }

  console.log(`  ✓ ${talentEmbedded} talent embeddings computed.`);

  // Jobs
  const allJobs = await db.select().from(jobs);
  let jobsEmbedded = 0;

  for (const job of allJobs) {
    const text = buildJobEmbeddingText(job);
    if (!text.trim()) continue;

    try {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text,
      });

      await db.execute(
        sql`UPDATE jobs SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${job.id}`
      );
      jobsEmbedded++;
    } catch (e) {
      console.error(`  ✗ Failed to embed job "${job.title}":`, e);
    }
  }

  console.log(`  ✓ ${jobsEmbedded} job embeddings computed.`);
  console.log(`✅ Embeddings complete: ${talentEmbedded} profiles + ${jobsEmbedded} jobs.\n`);
}

/**
 * Step 2: Run matching engine — for each job, find top talent matches.
 * Uses pgvector cosine similarity for semantic match + feature scoring.
 */
export async function computeMatches(): Promise<void> {
  console.log('🔗 Computing matches...');
  const provider = getAIProvider();

  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches);

  if (Number(existingCount) >= 100) {
    console.log('  ✓ 100+ matches already exist, skipping.\n');
    return;
  }

  const allJobs = await db.select().from(jobs);
  const allTalent = await db.select().from(talentProfiles);

  // Build enterprise lookup for company names in reasoning
  const allEnterprises = await db.select().from(enterpriseProfiles);
  const enterpriseMap = new Map(allEnterprises.map(e => [e.id, e]));

  let totalMatches = 0;
  let reasoningsGenerated = 0;

  for (const job of allJobs) {
    const structured = job.structured as any;
    const jobSkills = (structured?.skills ?? []) as Array<{ name: string; required: boolean }>;

    // Query pgvector for top 50 by cosine similarity
    const candidates = await db.execute(
      sql`SELECT id, display_name, headline, skills, experience,
                 1 - (embedding <=> (SELECT embedding FROM jobs WHERE id = ${job.id})) as semantic_score
           FROM talent_profiles
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> (SELECT embedding FROM jobs WHERE id = ${job.id})
           LIMIT 50`
    );

    const matchResults: Array<{
      talentId: string;
      score: number;
      breakdown: any;
      talentData: any;
    }> = [];

    for (const candidate of candidates.rows ?? candidates) {
      const c = candidate as any;
      const talentSkills = (typeof c.skills === 'string' ? JSON.parse(c.skills) : c.skills) as Array<{ name: string; level: string }>;
      const semanticScore = parseFloat(c.semantic_score) || 0;

      // Feature scoring
      let featureScore = 0;
      let totalWeight = 0;
      const breakdown: Record<string, number> = {};

      for (const jobSkill of jobSkills) {
        const weight = jobSkill.required ? 2.0 : 1.0;
        totalWeight += weight;

        const match = talentSkills.find(
          (ts) => ts.name.toLowerCase() === jobSkill.name.toLowerCase()
        );

        if (match) {
          const levelScores: Record<string, number> = {
            expert: 1.0,
            advanced: 0.8,
            intermediate: 0.6,
            beginner: 0.4,
          };
          const levelScore = levelScores[match.level] ?? 0.5;
          featureScore += weight * levelScore;
          breakdown[jobSkill.name] = levelScore;
        } else {
          breakdown[jobSkill.name] = 0;
        }
      }

      const normalizedFeature = totalWeight > 0 ? featureScore / totalWeight : 0;

      // Combined score: 0.4 * semantic + 0.6 * feature, scaled to 0-100
      const combinedScore = Math.round(
        (0.4 * semanticScore + 0.6 * normalizedFeature) * 100
      );

      // Clamp to valid range
      const finalScore = Math.max(0, Math.min(100, combinedScore));

      matchResults.push({
        talentId: c.id,
        score: finalScore,
        breakdown: {
          semanticScore: Math.round(semanticScore * 100),
          featureScore: Math.round(normalizedFeature * 100),
          skills: breakdown,
        },
        talentData: {
          displayName: c.display_name,
          headline: c.headline,
          skills: talentSkills,
          experience: typeof c.experience === 'string' ? JSON.parse(c.experience) : c.experience,
        },
      });
    }

    // Sort by score descending
    matchResults.sort((a, b) => b.score - a.score);

    // Insert top matches (all 50 — gives range of scores)
    for (const result of matchResults) {
      await db
        .insert(matches)
        .values({
          jobId: job.id,
          talentId: result.talentId,
          score: result.score,
          breakdown: result.breakdown,
          status: result.score >= 80 ? 'new' : 'new',
        })
        .onConflictDoNothing();

      totalMatches++;
    }

    // Generate AI reasoning for top 10 matches
    const enterprise = enterpriseMap.get(job.enterpriseId!);
    const top10 = matchResults.slice(0, 10);

    for (const topMatch of top10) {
      if (reasoningsGenerated >= 100) break; // Cap total reasoning calls

      try {
        const prompt = buildMatchReasoningPrompt(
          {
            displayName: topMatch.talentData.displayName,
            headline: topMatch.talentData.headline,
            skills: topMatch.talentData.skills,
            experience: topMatch.talentData.experience ?? [],
          },
          {
            title: job.title ?? '',
            companyName: enterprise?.companyName ?? '',
            description: job.description ?? '',
            skills: jobSkills,
          },
          topMatch.score,
        );

        const { text: reasoning } = await generateText({
          model: provider,
          prompt,
          maxTokens: 300,
          temperature: 0.7,
        });

        await db.execute(
          sql`UPDATE matches SET ai_reasoning = ${reasoning}, status = 'viewed'
              WHERE job_id = ${job.id} AND talent_id = ${topMatch.talentId}`
        );

        reasoningsGenerated++;
      } catch (e) {
        console.warn(`  ⚠ Failed to generate reasoning for match, continuing...`);
      }
    }

    console.log(`  ✓ ${matchResults.length} matches for "${job.title}" (top score: ${matchResults[0]?.score ?? 0})`);
  }

  console.log(`✅ ${totalMatches} matches computed, ${reasoningsGenerated} AI reasonings generated.\n`);
}

/**
 * Ensure at least 3 high matches (score >= 80) per demo talent account.
 * If a demo account doesn't have enough high matches, boost their scores.
 */
export async function ensureDemoHighMatches(): Promise<void> {
  console.log('🎯 Ensuring demo accounts have high matches...');

  const demoTalentEmails = ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev'];
  const demoUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`email = ANY(${demoTalentEmails})`);

  // We need to import users from schema to use this
  // Actually let's use a raw query approach

  for (const user of demoUsers) {
    const profile = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);

    if (profile.length === 0) continue;
    const talentId = profile[0]!.id;

    // Count high matches
    const [{ count: highCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(sql`talent_id = ${talentId} AND score >= 80`);

    const needed = 3 - Number(highCount);
    if (needed <= 0) {
      console.log(`  ✓ ${user.email} already has ${highCount} high matches.`);
      continue;
    }

    // Boost top N matches below 80 to 80-95 range
    console.log(`  ↑ Boosting ${needed} matches for ${user.email}...`);
    await db.execute(
      sql`UPDATE matches
          SET score = 80 + (random() * 15)::int
          WHERE id IN (
            SELECT id FROM matches
            WHERE talent_id = ${talentId} AND score < 80
            ORDER BY score DESC
            LIMIT ${needed}
          )`
    );
  }

  console.log(`✅ Demo high matches ensured.\n`);
}

/**
 * Step 3: Build keyword graph from job skills.
 */
export async function buildKeywordGraph(): Promise<void> {
  console.log('🕸️  Building keyword graph...');

  // Check existing
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(keywordNodes);

  if (Number(existingCount) >= 40) {
    console.log('  ✓ Keyword graph already built, skipping.\n');
    return;
  }

  const allJobs = await db.select().from(jobs);

  // Extract skills and count occurrences
  const skillCounts: Map<string, number> = new Map();
  const coOccurrences: Map<string, number> = new Map();

  for (const job of allJobs) {
    const structured = job.structured as any;
    const skills = (structured?.skills ?? []) as Array<{ name: string }>;
    const skillNames = skills.map((s) => s.name);

    // Count individual skills
    for (const name of skillNames) {
      skillCounts.set(name, (skillCounts.get(name) ?? 0) + 1);
    }

    // Count co-occurrences (pairs)
    for (let i = 0; i < skillNames.length; i++) {
      for (let j = i + 1; j < skillNames.length; j++) {
        const key = [skillNames[i], skillNames[j]].sort().join('|||');
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }
  }

  // Insert keyword nodes
  const nodeIdMap: Map<string, string> = new Map();

  for (const [keyword, count] of skillCounts) {
    // Mark as trending if appears in >30% of jobs (simulated for seed)
    const trending = count > allJobs.length * 0.3;

    const [node] = await db
      .insert(keywordNodes)
      .values({
        keyword,
        jobCount: count,
        trending,
      })
      .onConflictDoNothing()
      .returning({ id: keywordNodes.id });

    if (node) {
      nodeIdMap.set(keyword, node.id);
    } else {
      // Already exists, fetch ID
      const [existing] = await db
        .select({ id: keywordNodes.id })
        .from(keywordNodes)
        .where(eq(keywordNodes.keyword, keyword));
      if (existing) nodeIdMap.set(keyword, existing.id);
    }
  }

  console.log(`  ✓ ${nodeIdMap.size} keyword nodes created.`);

  // Insert edges
  let edgeCount = 0;
  for (const [key, weight] of coOccurrences) {
    if (weight < 1) continue; // Skip very weak connections

    const [skill1, skill2] = key.split('|||');
    const sourceId = nodeIdMap.get(skill1!);
    const targetId = nodeIdMap.get(skill2!);

    if (!sourceId || !targetId) continue;

    await db
      .insert(keywordEdges)
      .values({
        sourceId,
        targetId,
        weight,
      })
      .onConflictDoNothing();

    edgeCount++;
  }

  console.log(`  ✓ ${edgeCount} keyword edges created.`);
  console.log(`✅ Keyword graph built: ${nodeIdMap.size} nodes, ${edgeCount} edges.\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/compute.ts
git commit -m "feat(seed): add embedding computation, matching engine, and keyword graph builder"
```

---

### Task 7: Seed Content (Inbox Items + Seeking Reports)

**Files:**
- Create: `scripts/seed/content.ts`

- [x] **Step 1: Create content seed**

Create `scripts/seed/content.ts`:

```typescript
import { db } from '@/lib/db';
import {
  users,
  talentProfiles,
  enterpriseProfiles,
  jobs,
  matches,
  inboxItems,
  seekingReports,
} from '@/lib/db/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai/providers';
import { buildSeekingReportPrompt, buildInboxMatchContent } from './prompts';

/**
 * Generate ~50 inbox items across all users.
 * Types: match_notification, invite, prechat_summary, system
 */
export async function seedInboxItems(): Promise<void> {
  console.log('📬 Generating inbox items...');

  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inboxItems);

  if (Number(existingCount) >= 40) {
    console.log('  ✓ 40+ inbox items already exist, skipping.\n');
    return;
  }

  // Get all matches with score >= 60 for notifications
  const highMatches = await db.execute(
    sql`SELECT m.id, m.job_id, m.talent_id, m.score,
               tp.display_name as talent_name, tp.headline as talent_headline, tp.user_id as talent_user_id,
               j.title as job_title, j.enterprise_id,
               ep.company_name, ep.user_id as enterprise_user_id
         FROM matches m
         JOIN talent_profiles tp ON m.talent_id = tp.id
         JOIN jobs j ON m.job_id = j.id
         JOIN enterprise_profiles ep ON j.enterprise_id = ep.id
         WHERE m.score >= 60
         ORDER BY m.score DESC
         LIMIT 80`
  );

  const rows = (highMatches.rows ?? highMatches) as any[];
  let inboxCount = 0;
  const targetCount = 50;

  // 1. Match notifications for talent users (score >= 70) — ~20 items
  const talentNotifications = rows.filter((r: any) => r.score >= 70).slice(0, 20);
  for (const row of talentNotifications) {
    if (inboxCount >= targetCount) break;

    const { title, content } = buildInboxMatchContent('talent_match', {
      jobId: row.job_id,
      jobTitle: row.job_title,
      companyName: row.company_name,
      score: Math.round(row.score),
      matchedSkills: [],
    });

    await db.insert(inboxItems).values({
      userId: row.talent_user_id,
      itemType: 'match_notification',
      title,
      content,
      read: Math.random() > 0.6, // 40% unread
    });
    inboxCount++;
  }
  console.log(`  ✓ ${talentNotifications.length} talent match notifications.`);

  // 2. Match notifications for enterprise users (score >= 75) — ~15 items
  const enterpriseNotifications = rows.filter((r: any) => r.score >= 75).slice(0, 15);
  for (const row of enterpriseNotifications) {
    if (inboxCount >= targetCount) break;

    const { title, content } = buildInboxMatchContent('enterprise_match', {
      talentId: row.talent_id,
      talentName: row.talent_name,
      talentHeadline: row.talent_headline,
      jobId: row.job_id,
      score: Math.round(row.score),
    });

    await db.insert(inboxItems).values({
      userId: row.enterprise_user_id,
      itemType: 'match_notification',
      title,
      content,
      read: Math.random() > 0.5,
    });
    inboxCount++;
  }
  console.log(`  ✓ ${enterpriseNotifications.length} enterprise match notifications.`);

  // 3. Invites for demo talent accounts — ~5 items
  const demoTalentUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`email LIKE 'talent%@csv.dev' AND email NOT LIKE 'talent-seed%'`);

  for (const user of demoTalentUsers.slice(0, 3)) {
    if (inboxCount >= targetCount) break;

    // Find a high-match job for this user
    const profile = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);

    if (profile.length === 0) continue;

    const topMatch = await db.execute(
      sql`SELECT m.job_id, m.score, j.title as job_title, ep.company_name
           FROM matches m
           JOIN jobs j ON m.job_id = j.id
           JOIN enterprise_profiles ep ON j.enterprise_id = ep.id
           WHERE m.talent_id = ${profile[0]!.id}
           ORDER BY m.score DESC LIMIT 1`
    );

    const matchRow = ((topMatch.rows ?? topMatch) as any[])[0];
    if (!matchRow) continue;

    const { title, content } = buildInboxMatchContent('invite', {
      jobId: matchRow.job_id,
      companyName: matchRow.company_name,
      jobTitle: matchRow.job_title,
    });

    await db.insert(inboxItems).values({
      userId: user.id,
      itemType: 'invite',
      title,
      content,
      read: false,
    });
    inboxCount++;
  }
  console.log(`  ✓ Invites for demo talent accounts.`);

  // 4. Pre-chat summaries — ~5 items
  for (const user of demoTalentUsers.slice(0, 2)) {
    if (inboxCount >= targetCount) break;

    const { title, content } = buildInboxMatchContent('prechat_summary', {
      jobId: 'placeholder',
      companyName: '星辰智能科技',
      summary: '在与星辰智能科技的AI预聊天中，对方对您的RAG Pipeline经验非常感兴趣，特别是大规模文档处理和检索优化方面的能力。团队正在寻找能够独立负责核心检索系统架构的高级工程师。',
      highlights: ['对RAG经验高度认可', '团队技术氛围好', '远程工作友好'],
    });

    await db.insert(inboxItems).values({
      userId: user.id,
      itemType: 'prechat_summary',
      title,
      content,
      read: false,
    });
    inboxCount++;
  }
  console.log(`  ✓ Pre-chat summaries.`);

  // 5. System notifications — fill remaining
  const systemMessages = [
    { title: '个人资料完善度提升至 95%', type: 'system' as const },
    { title: '新技能趋势: Agent Framework 需求增长 45%', type: 'system' as const },
    { title: '本周市场报告已生成', type: 'system' as const },
    { title: '您的 AI 伙伴发现了 3 个新机会', type: 'system' as const },
    { title: '技能图谱已更新', type: 'system' as const },
  ];

  for (const msg of systemMessages) {
    if (inboxCount >= targetCount) break;

    // Send to all demo talent users
    for (const user of demoTalentUsers) {
      if (inboxCount >= targetCount) break;

      await db.insert(inboxItems).values({
        userId: user.id,
        itemType: 'system',
        title: msg.title,
        content: { type: 'system', message: msg.title },
        read: Math.random() > 0.3,
      });
      inboxCount++;
    }
  }

  console.log(`✅ ${inboxCount} inbox items generated.\n`);
}

/**
 * Generate seeking reports for the 3 demo talent accounts.
 */
export async function seedSeekingReports(): Promise<void> {
  console.log('📊 Generating seeking reports...');
  const provider = getAIProvider();

  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(seekingReports);

  if (Number(existingCount) >= 3) {
    console.log('  ✓ 3+ seeking reports already exist, skipping.\n');
    return;
  }

  const demoTalentUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`email LIKE 'talent%@csv.dev' AND email NOT LIKE 'talent-seed%'`)
    .limit(3);

  for (const user of demoTalentUsers) {
    const [profile] = await db
      .select()
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);

    if (!profile) {
      console.log(`  ⚠ No profile for ${user.email}, skipping.`);
      continue;
    }

    // Get their matches
    const userMatches = await db.execute(
      sql`SELECT m.score, m.breakdown, j.title as job_title, ep.company_name,
                 j.structured
           FROM matches m
           JOIN jobs j ON m.job_id = j.id
           JOIN enterprise_profiles ep ON j.enterprise_id = ep.id
           WHERE m.talent_id = ${profile.id}
           ORDER BY m.score DESC
           LIMIT 10`
    );

    const matchRows = (userMatches.rows ?? userMatches) as any[];
    const talentSkills = (profile.skills as any[]) ?? [];

    const matchesForPrompt = matchRows.map((m: any) => {
      const jobSkills = (typeof m.structured === 'string' ? JSON.parse(m.structured) : m.structured)?.skills ?? [];
      const talentSkillNames = talentSkills.map((s: any) => s.name);
      const jobSkillNames = jobSkills.map((s: any) => s.name);

      return {
        jobTitle: m.job_title,
        companyName: m.company_name,
        score: Math.round(m.score),
        matchedSkills: jobSkillNames.filter((n: string) => talentSkillNames.includes(n)),
        missingSkills: jobSkillNames.filter((n: string) => !talentSkillNames.includes(n)),
      };
    });

    const prompt = buildSeekingReportPrompt(
      {
        displayName: profile.displayName ?? '',
        headline: profile.headline ?? '',
        skills: talentSkills,
        goals: (profile.goals as any) ?? {},
      },
      matchesForPrompt,
    );

    try {
      const { text } = await generateText({
        model: provider,
        prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      let reportData: any;
      try {
        const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
        reportData = JSON.parse(cleaned);
      } catch {
        reportData = {
          summary: text,
          highlights: [],
          skillGaps: [],
          marketInsight: '',
          recommendations: [],
        };
      }

      // Augment with match data
      reportData.matches = matchesForPrompt;
      reportData.totalScanned = 30;
      reportData.highMatches = matchesForPrompt.filter((m: any) => m.score >= 80).length;
      reportData.mediumMatches = matchesForPrompt.filter((m: any) => m.score >= 60 && m.score < 80).length;

      await db.insert(seekingReports).values({
        talentId: profile.id,
        reportData,
      });

      console.log(`  ✓ Report generated for ${user.email} (${profile.displayName}).`);
    } catch (e) {
      console.error(`  ✗ Failed to generate report for ${user.email}:`, e);
    }
  }

  console.log(`✅ Seeking reports generated.\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed/content.ts
git commit -m "feat(seed): add inbox item and seeking report generation"
```

---

### Task 8: Seed Reset and Main Orchestrator

**Files:**
- Create: `scripts/seed/reset.ts`
- Create: `scripts/seed.ts`
- Modify: `package.json`

- [x] **Step 1: Create reset script**

Create `scripts/seed/reset.ts`:

```typescript
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Drop all data from all tables in correct order (respecting foreign keys).
 */
export async function resetDatabase(): Promise<void> {
  console.log('🗑️  Resetting database...');

  const tables = [
    'seeking_reports',
    'keyword_edges',
    'keyword_nodes',
    'inbox_items',
    'matches',
    'chat_messages',
    'chat_sessions',
    'api_keys',
    'jobs',
    'enterprise_profiles',
    'talent_profiles',
    'users',
  ];

  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM ${table}`));
    console.log(`  ✓ Cleared ${table}`);
  }

  console.log('✅ Database reset complete.\n');
}
```

- [x] **Step 2: Create main orchestrator**

Create `scripts/seed.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();

import { seedUsers } from './seed/users';
import { seedTalentProfiles, seedEnterpriseProfiles } from './seed/profiles';
import { seedJobs } from './seed/jobs';
import {
  computeEmbeddings,
  computeMatches,
  ensureDemoHighMatches,
  buildKeywordGraph,
} from './seed/compute';
import { seedInboxItems, seedSeekingReports } from './seed/content';
import { resetDatabase } from './seed/reset';

const COMMANDS: Record<string, () => Promise<void>> = {
  seed: async () => {
    console.log('═══════════════════════════════════════');
    console.log('  CSV Full Seed — Starting...');
    console.log('═══════════════════════════════════════\n');

    await seedUsers();
    await seedTalentProfiles();
    await seedEnterpriseProfiles();
    await seedJobs();
    await computeEmbeddings();
    await computeMatches();
    await ensureDemoHighMatches();
    await buildKeywordGraph();
    await seedInboxItems();
    await seedSeekingReports();

    console.log('═══════════════════════════════════════');
    console.log('  ✅ Full seed complete!');
    console.log('═══════════════════════════════════════');
  },

  'seed:users': async () => {
    await seedUsers();
  },

  'seed:profiles': async () => {
    await seedTalentProfiles();
    await seedEnterpriseProfiles();
  },

  'seed:jobs': async () => {
    await seedJobs();
  },

  'seed:compute': async () => {
    await computeEmbeddings();
    await computeMatches();
    await ensureDemoHighMatches();
    await buildKeywordGraph();
  },

  'seed:content': async () => {
    await seedInboxItems();
    await seedSeekingReports();
  },

  'seed:reset': async () => {
    const confirm = process.argv.includes('--yes');
    if (!confirm) {
      console.log('⚠️  This will DELETE ALL DATA. Run with --yes to confirm.');
      console.log('   npx tsx scripts/seed.ts seed:reset --yes');
      process.exit(1);
    }
    await resetDatabase();
    // Re-seed everything
    console.log('Re-seeding from scratch...');
    await COMMANDS['seed']!();
  },
};

async function main() {
  const command = process.argv[2] ?? 'seed';

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  try {
    await handler();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
```

- [x] **Step 3: Add npm scripts to package.json**

Add to `package.json` `scripts` section:

```json
{
  "seed": "npx tsx scripts/seed.ts seed",
  "seed:users": "npx tsx scripts/seed.ts seed:users",
  "seed:profiles": "npx tsx scripts/seed.ts seed:profiles",
  "seed:jobs": "npx tsx scripts/seed.ts seed:jobs",
  "seed:compute": "npx tsx scripts/seed.ts seed:compute",
  "seed:content": "npx tsx scripts/seed.ts seed:content",
  "seed:reset": "npx tsx scripts/seed.ts seed:reset"
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts scripts/seed/reset.ts package.json
git commit -m "feat(seed): add main orchestrator with sub-commands and reset capability"
```

---

### Task 9: Empty State Components

**Files:**
- Create: `src/components/empty-states/no-matches.tsx`
- Create: `src/components/empty-states/empty-inbox.tsx`
- Create: `src/components/empty-states/no-report.tsx`
- Create: `src/components/empty-states/empty-jobs.tsx`

- [x] **Step 1: Create empty state components**

Create `src/components/empty-states/no-matches.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

export function NoMatches() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <motion.div
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <h3 className="text-lg font-medium mb-2">AI 正在扫描市场...</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your AI companion is scanning the market for matching opportunities. This usually takes a few minutes after your profile is set up.
      </p>
    </motion.div>
  );
}
```

Create `src/components/empty-states/empty-inbox.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

export function EmptyInbox() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
        <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">还没有消息</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No messages yet. Your AI companion is working on finding the best opportunities for you.
      </p>
    </motion.div>
  );
}
```

Create `src/components/empty-states/no-report.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

export function NoReport() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <motion.div
          className="absolute -bottom-1 -right-1"
          animate={{ rotate: [0, 15, 0, -15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
          </div>
        </motion.div>
      </div>
      <h3 className="text-lg font-medium mb-2">报告生成中...</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your first seeking report is being generated. Check back soon — your AI is analyzing the market for you.
      </p>
    </motion.div>
  );
}
```

Create `src/components/empty-states/empty-jobs.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function EmptyJobs() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
        <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">还没有发布职位</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        No jobs posted yet. Post your first job to start finding the best AI talent.
      </p>
      <Button asChild>
        <Link href="/enterprise/jobs/new">Post a Job</Link>
      </Button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/empty-states/
git commit -m "feat(ui): add empty state components for matches, inbox, reports, and jobs"
```

---

### Task 10: Loading Skeleton Components

**Files:**
- Create: `src/components/loading/profile-skeleton.tsx`
- Create: `src/components/loading/match-list-skeleton.tsx`
- Create: `src/components/loading/inbox-skeleton.tsx`
- Create: `src/components/loading/report-skeleton.tsx`
- Create: `src/components/loading/graph-skeleton.tsx`
- Create: `src/components/loading/job-list-skeleton.tsx`

- [x] **Step 1: Create skeleton components**

Create `src/components/loading/profile-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Skill clusters */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `src/components/loading/match-list-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function MatchListSkeleton() {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-24 rounded" />
      </div>

      {/* Table header */}
      <div className="grid grid-cols-6 gap-4 py-2 border-b">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 py-3 border-b border-muted">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-12 rounded" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/loading/inbox-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function InboxSkeleton() {
  return (
    <div className="space-y-2 animate-in fade-in duration-200">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded" />
        ))}
      </div>

      {/* Items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 border rounded-lg">
          <Skeleton className="h-3 w-3 rounded-full mt-1.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/loading/report-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary */}
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Match cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-28 rounded" />
            <Skeleton className="h-9 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/loading/graph-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function GraphSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Search bar */}
      <Skeleton className="h-10 w-64 rounded" />

      {/* Graph area placeholder */}
      <div className="relative h-[500px] border rounded-lg bg-muted/30 flex items-center justify-center">
        {/* Fake nodes scattered around */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${40 + Math.random() * 40}px`,
              height: '28px',
              left: `${15 + Math.random() * 70}%`,
              top: `${15 + Math.random() * 70}%`,
            }}
          />
        ))}
        <p className="text-sm text-muted-foreground z-10">Loading graph...</p>
      </div>
    </div>
  );
}
```

Create `src/components/loading/job-list-skeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function JobListSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28 rounded" />
      </div>

      {/* Job cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/loading/
git commit -m "feat(ui): add loading skeleton components for all major views"
```

---

### Task 11: Animation Utility Components

**Files:**
- Create: `src/components/animations/page-transition.tsx`
- Create: `src/components/animations/stagger-children.tsx`
- Create: `src/components/animations/count-up.tsx`
- Create: `src/components/animations/pulse-dot.tsx`

- [x] **Step 1: Create animation components**

Create `src/components/animations/page-transition.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

Create `src/components/animations/stagger-children.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  /** Delay between each child in ms */
  staggerMs?: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

export function StaggerChildren({
  children,
  className,
  staggerMs = 100,
}: StaggerChildrenProps) {
  const containerVariant = {
    ...container,
    show: {
      ...container.show,
      transition: { staggerChildren: staggerMs / 1000 },
    },
  };

  return (
    <motion.div
      variants={containerVariant}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Wrap each child item with this for stagger effect */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
```

Create `src/components/animations/count-up.tsx`:

```typescript
'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface CountUpProps {
  /** Target number to count up to */
  value: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Suffix (e.g., "%", "+") */
  suffix?: string;
  /** Prefix (e.g., "#") */
  prefix?: string;
  className?: string;
}

export function CountUp({
  value,
  duration = 400,
  suffix = '',
  prefix = '',
  className,
}: CountUpProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: duration / 1000,
      ease: 'easeOut',
      onUpdate: (latest) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = `${prefix}${Math.round(latest)}${suffix}`;
        }
      },
    });

    return controls.stop;
  }, [value, duration, prefix, suffix, motionValue]);

  return (
    <span ref={nodeRef} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
```

Create `src/components/animations/pulse-dot.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

interface PulseDotProps {
  /** Color class for the dot */
  color?: 'green' | 'blue' | 'yellow' | 'red';
  /** Size in pixels */
  size?: number;
  className?: string;
}

const colorMap = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export function PulseDot({
  color = 'green',
  size = 8,
  className = '',
}: PulseDotProps) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <motion.span
        className={`absolute inline-flex h-full w-full rounded-full ${colorMap[color]} opacity-75`}
        animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span
        className={`relative inline-flex rounded-full ${colorMap[color]}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/animations/
git commit -m "feat(ui): add animation utility components (page transition, stagger, count-up, pulse)"
```

---

### Task 12: Landing Page Sections

**Files:**
- Create: `src/components/landing/hero-section.tsx`
- Create: `src/components/landing/how-it-works.tsx`
- Create: `src/components/landing/feature-highlights.tsx`
- Create: `src/components/landing/final-cta.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [x] **Step 1: Add landing page i18n strings**

Add the following keys to both `en.json` and `zh.json` under a `"landing"` section (extending existing keys):

In `src/i18n/messages/en.json`, merge into `landing`:

```json
{
  "landing": {
    "headline": "Your AI Companion for the AI Era",
    "subheadline": "CSV connects AI talent with enterprises through intelligent matching and conversational AI.",
    "ctaTalent": "Find Opportunities",
    "ctaEnterprise": "Find Talent",
    "howItWorks": "How It Works",
    "talentStep1Title": "Meet Your AI Companion",
    "talentStep1Desc": "A conversational onboarding experience that builds your professional portrait through dialogue — no forms to fill.",
    "talentStep2Title": "AI Scans the Market 24/7",
    "talentStep2Desc": "Your companion continuously scans job postings, computes match scores, and generates personalized seeking reports.",
    "talentStep3Title": "Land Your Next Opportunity",
    "talentStep3Desc": "Review AI-curated matches, get tailored resume suggestions, and receive pre-chat summaries from interested companies.",
    "enterpriseStep1Title": "Describe Your Ideal Candidate",
    "enterpriseStep1Desc": "Paste a JD, link a URL, or just describe what you need. AI structures your requirements automatically.",
    "enterpriseStep2Title": "AI Finds the Best Matches",
    "enterpriseStep2Desc": "Semantic + feature matching across the talent pool. Every candidate scored and ranked with per-skill breakdown.",
    "enterpriseStep3Title": "Screen and Connect",
    "enterpriseStep3Desc": "AI screening chat, candidate comparison, automated pre-chats — hire faster with AI doing the heavy lifting.",
    "featureTitle": "Built for the AI Talent Market",
    "feature1Title": "Capability Portrait",
    "feature1Desc": "Visual skill clusters with proficiency-weighted tags. Your professional identity at a glance.",
    "feature2Title": "Opportunity Fair",
    "feature2Desc": "Interactive keyword graph showing market trends. Find your skills, discover adjacent opportunities.",
    "feature3Title": "AI Coach",
    "feature3Desc": "Mock interviews, resume review, skill gap analysis — personalized career coaching available 24/7.",
    "feature4Title": "Intelligent Matching",
    "feature4Desc": "Semantic embeddings + structured scoring. Not just keyword matching — real understanding of capability fit.",
    "finalCtaTitle": "Ready to Find Your Match?",
    "finalCtaDesc": "Join the AI-native talent marketplace. Whether you're building with AI or building AI, CSV connects you with the right opportunity."
  }
}
```

In `src/i18n/messages/zh.json`, merge into `landing`:

```json
{
  "landing": {
    "headline": "AI 时代的 AI 伙伴",
    "subheadline": "CSV 通过智能匹配和对话式 AI，连接 AI 人才与企业。",
    "ctaTalent": "寻找机会",
    "ctaEnterprise": "寻找人才",
    "howItWorks": "如何运作",
    "talentStep1Title": "认识你的 AI 伙伴",
    "talentStep1Desc": "对话式入职体验，通过交流构建你的职业画像 —— 无需填写表单。",
    "talentStep2Title": "AI 全天候扫描市场",
    "talentStep2Desc": "你的伙伴持续扫描职位，计算匹配分数，生成个性化求职报告。",
    "talentStep3Title": "把握下一个机会",
    "talentStep3Desc": "查看 AI 精选匹配，获取定制简历建议，接收感兴趣企业的预聊天摘要。",
    "enterpriseStep1Title": "描述理想候选人",
    "enterpriseStep1Desc": "粘贴 JD、链接 URL 或直接描述需求。AI 自动结构化你的需求。",
    "enterpriseStep2Title": "AI 寻找最佳匹配",
    "enterpriseStep2Desc": "语义 + 特征匹配覆盖整个人才池。每位候选人都有评分和按技能细分的排名。",
    "enterpriseStep3Title": "筛选与对接",
    "enterpriseStep3Desc": "AI 筛选对话、候选人对比、自动预聊天 —— 让 AI 完成繁重工作，加速招聘。",
    "featureTitle": "为 AI 人才市场而生",
    "feature1Title": "能力画像",
    "feature1Desc": "可视化技能集群，按熟练度加权。一眼看清你的职业身份。",
    "feature2Title": "机会集市",
    "feature2Desc": "交互式关键词图谱展示市场趋势。发现技能关联，探索新机会。",
    "feature3Title": "AI 教练",
    "feature3Desc": "模拟面试、简历评审、技能差距分析 —— 全天候个性化职业辅导。",
    "feature4Title": "智能匹配",
    "feature4Desc": "语义嵌入 + 结构化评分。不是简单的关键词匹配 —— 是对能力适配度的深度理解。",
    "finalCtaTitle": "准备好找到你的匹配了吗？",
    "finalCtaDesc": "加入 AI 原生人才市场。无论你是用 AI 还是做 AI，CSV 为你连接合适的机会。"
  }
}
```

- [x] **Step 2: Create hero section**

Create `src/components/landing/hero-section.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <motion.h1
          className="font-serif text-5xl md:text-7xl font-bold tracking-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {t('headline')}
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
        >
          {t('subheadline')}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
        >
          <Button asChild size="lg" className="text-base px-8">
            <Link href="/login">{t('ctaTalent')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base px-8">
            <Link href="/login">{t('ctaEnterprise')}</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
```

- [x] **Step 3: Create how-it-works section**

Create `src/components/landing/how-it-works.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center max-w-xs"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: number * 0.1 }}
    >
      <div className="h-12 w-12 rounded-full border-2 border-primary flex items-center justify-center text-lg font-semibold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}

export function HowItWorks() {
  const t = useTranslations('landing');

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.25 }}
        >
          {t('howItWorks')}
        </motion.h2>

        {/* Talent flow */}
        <div className="mb-16">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground text-center mb-8">
            {t('ctaTalent')}
          </h3>
          <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-12">
            <Step number={1} title={t('talentStep1Title')} description={t('talentStep1Desc')} />
            <Step number={2} title={t('talentStep2Title')} description={t('talentStep2Desc')} />
            <Step number={3} title={t('talentStep3Title')} description={t('talentStep3Desc')} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-muted my-12" />

        {/* Enterprise flow */}
        <div>
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground text-center mb-8">
            {t('ctaEnterprise')}
          </h3>
          <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-12">
            <Step number={1} title={t('enterpriseStep1Title')} description={t('enterpriseStep1Desc')} />
            <Step number={2} title={t('enterpriseStep2Title')} description={t('enterpriseStep2Desc')} />
            <Step number={3} title={t('enterpriseStep3Title')} description={t('enterpriseStep3Desc')} />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [x] **Step 4: Create feature highlights section**

Create `src/components/landing/feature-highlights.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface FeatureCardProps {
  title: string;
  description: string;
  index: number;
}

function FeatureCard({ title, description, index }: FeatureCardProps) {
  return (
    <motion.div
      className="border rounded-xl p-6 bg-card hover:border-primary/50 transition-colors duration-200"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: index * 0.08 }}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

export function FeatureHighlights() {
  const t = useTranslations('landing');

  const features = [
    { title: t('feature1Title'), description: t('feature1Desc') },
    { title: t('feature2Title'), description: t('feature2Desc') },
    { title: t('feature3Title'), description: t('feature3Desc') },
    { title: t('feature4Title'), description: t('feature4Desc') },
  ];

  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          className="font-serif text-3xl md:text-4xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.25 }}
        >
          {t('featureTitle')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={i} title={feature.title} description={feature.description} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [x] **Step 5: Create final CTA section**

Create `src/components/landing/final-cta.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  const t = useTranslations('landing');

  return (
    <section className="py-24 px-6">
      <motion.div
        className="max-w-2xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
          {t('finalCtaTitle')}
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          {t('finalCtaDesc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="text-base px-8">
            <Link href="/login">{t('ctaTalent')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base px-8">
            <Link href="/login">{t('ctaEnterprise')}</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
```

- [x] **Step 6: Update landing page**

Replace `src/app/page.tsx`:

```typescript
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeatureHighlights } from '@/components/landing/feature-highlights';
import { FinalCta } from '@/components/landing/final-cta';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <HeroSection />
      <HowItWorks />
      <FeatureHighlights />
      <FinalCta />
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/ src/app/page.tsx src/i18n/messages/
git commit -m "feat(landing): add full narrative landing page with hero, how-it-works, features, and CTA"
```

---

### Task 13: Integrate Empty States and Skeletons into Existing Pages

**Files:**
- Modify: `src/app/(talent)/seeking/page.tsx`
- Modify: `src/app/(talent)/inbox/page.tsx`
- Modify: `src/app/(talent)/home/page.tsx`
- Modify: `src/app/(talent)/fair/page.tsx`
- Modify: `src/app/(enterprise)/dashboard/page.tsx`
- Modify: `src/app/(enterprise)/inbox/page.tsx`
- Modify: `src/app/(enterprise)/jobs/page.tsx`

This task wires up the skeleton and empty state components into the existing pages from Specs 2-6. Each page should show the skeleton during loading (via `loading.tsx` or Suspense) and the empty state when data is empty.

- [x] **Step 1: Add loading.tsx files for each route**

Create `src/app/(talent)/home/loading.tsx`:

```typescript
import { ProfileSkeleton } from '@/components/loading/profile-skeleton';

export default function HomeLoading() {
  return <ProfileSkeleton />;
}
```

Create `src/app/(talent)/seeking/loading.tsx`:

```typescript
import { ReportSkeleton } from '@/components/loading/report-skeleton';

export default function SeekingLoading() {
  return <ReportSkeleton />;
}
```

Create `src/app/(talent)/inbox/loading.tsx`:

```typescript
import { InboxSkeleton } from '@/components/loading/inbox-skeleton';

export default function InboxLoading() {
  return <InboxSkeleton />;
}
```

Create `src/app/(talent)/fair/loading.tsx`:

```typescript
import { GraphSkeleton } from '@/components/loading/graph-skeleton';

export default function FairLoading() {
  return <GraphSkeleton />;
}
```

Create `src/app/(enterprise)/dashboard/loading.tsx`:

```typescript
import { JobListSkeleton } from '@/components/loading/job-list-skeleton';

export default function DashboardLoading() {
  return <JobListSkeleton />;
}
```

Create `src/app/(enterprise)/inbox/loading.tsx`:

```typescript
import { InboxSkeleton } from '@/components/loading/inbox-skeleton';

export default function EnterpriseInboxLoading() {
  return <InboxSkeleton />;
}
```

Create `src/app/(enterprise)/jobs/loading.tsx`:

```typescript
import { JobListSkeleton } from '@/components/loading/job-list-skeleton';

export default function JobsLoading() {
  return <JobListSkeleton />;
}
```

- [x] **Step 2: Wire empty states into page components**

For each existing page, add conditional rendering. The exact integration depends on Spec 2-6 implementations, but the pattern is:

In any page that fetches data (e.g., seeking report page), wrap the content:

```typescript
// Example pattern for src/app/(talent)/seeking/page.tsx
import { NoReport } from '@/components/empty-states/no-report';
import { PageTransition } from '@/components/animations/page-transition';

export default async function SeekingPage() {
  const report = await getLatestReport(userId);

  if (!report) {
    return <NoReport />;
  }

  return (
    <PageTransition>
      {/* existing report content */}
    </PageTransition>
  );
}
```

Apply this pattern to each page:
- `/talent/home` — no empty state needed (redirects to onboarding if not done)
- `/talent/seeking` — uses `<NoReport />` when no report exists
- `/talent/inbox` — uses `<EmptyInbox />` when no inbox items
- `/talent/fair` — graph renders after data loads (skeleton during load)
- `/enterprise/dashboard` — uses `<EmptyJobs />` in the jobs section if no jobs
- `/enterprise/inbox` — uses `<EmptyInbox />`
- `/enterprise/jobs` — uses `<EmptyJobs />`

- [ ] **Step 3: Commit**

```bash
git add src/app/
git commit -m "feat(ui): integrate loading skeletons and empty states into all pages"
```

---

### Task 14: End-to-End Flow Checklist Tests

**Files:**
- Create: `__tests__/e2e/flow-checklist.test.ts`

These are smoke tests that verify the seed data creates a coherent demo experience.

- [x] **Step 1: Create flow checklist test**

Create `__tests__/e2e/flow-checklist.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import {
  users,
  talentProfiles,
  enterpriseProfiles,
  jobs,
  matches,
  inboxItems,
  seekingReports,
  keywordNodes,
  keywordEdges,
} from '@/lib/db/schema';
import { eq, sql, gte, and } from 'drizzle-orm';

/**
 * These tests verify the seed data creates a complete demo experience.
 * Run AFTER `npm run seed` completes.
 *
 * Usage: DATABASE_URL=... npx vitest run __tests__/e2e/flow-checklist.test.ts
 */

describe('Seed Data: Entity Counts', () => {
  it('has exactly 5 predefined user accounts', async () => {
    const predefined = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`email LIKE '%@csv.dev' AND email NOT LIKE '%-seed-%'`);
    expect(Number(predefined[0]!.count)).toBe(5);
  });

  it('has >= 50 talent profiles', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(talentProfiles);
    expect(Number(count)).toBeGreaterThanOrEqual(50);
  });

  it('has >= 15 enterprise profiles', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(enterpriseProfiles);
    expect(Number(count)).toBeGreaterThanOrEqual(15);
  });

  it('has >= 30 job postings', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs);
    expect(Number(count)).toBeGreaterThanOrEqual(30);
  });

  it('has >= 100 matches', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches);
    expect(Number(count)).toBeGreaterThanOrEqual(100);
  });

  it('has >= 40 keyword nodes', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(keywordNodes);
    expect(Number(count)).toBeGreaterThanOrEqual(40);
  });

  it('has >= 40 inbox items', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inboxItems);
    expect(Number(count)).toBeGreaterThanOrEqual(40);
  });

  it('has 3 seeking reports', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(seekingReports);
    expect(Number(count)).toBeGreaterThanOrEqual(3);
  });
});

describe('Seed Data: Demo Account Quality', () => {
  const demoEmails = ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev'];

  for (const email of demoEmails) {
    describe(email, () => {
      it('has a completed talent profile', async () => {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        expect(user).toBeDefined();

        const [profile] = await db
          .select()
          .from(talentProfiles)
          .where(eq(talentProfiles.userId, user!.id));
        expect(profile).toBeDefined();
        expect(profile!.onboardingDone).toBe(true);
        expect(profile!.displayName).toBeTruthy();
        expect((profile!.skills as any[]).length).toBeGreaterThanOrEqual(3);
      });

      it('has at least 3 high matches (score >= 80)', async () => {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        const [profile] = await db
          .select({ id: talentProfiles.id })
          .from(talentProfiles)
          .where(eq(talentProfiles.userId, user!.id));

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(matches)
          .where(and(
            eq(matches.talentId, profile!.id),
            gte(matches.score, 80),
          ));
        expect(Number(count)).toBeGreaterThanOrEqual(3);
      });

      it('has a seeking report', async () => {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        const [profile] = await db
          .select({ id: talentProfiles.id })
          .from(talentProfiles)
          .where(eq(talentProfiles.userId, user!.id));

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(seekingReports)
          .where(eq(seekingReports.talentId, profile!.id));
        expect(Number(count)).toBeGreaterThanOrEqual(1);
      });

      it('has inbox items', async () => {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(inboxItems)
          .where(eq(inboxItems.userId, user!.id));
        expect(Number(count)).toBeGreaterThan(0);
      });
    });
  }
});

describe('Seed Data: Match Score Distribution', () => {
  it('has matches spanning the full score range', async () => {
    const highMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(gte(matches.score, 80));

    const midMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(sql`score >= 60 AND score < 80`);

    const lowMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(sql`score < 60`);

    expect(Number(highMatches[0]!.count)).toBeGreaterThan(0);
    expect(Number(midMatches[0]!.count)).toBeGreaterThan(0);
    expect(Number(lowMatches[0]!.count)).toBeGreaterThan(0);
  });
});

describe('Seed Data: Keyword Graph Integrity', () => {
  it('has keyword edges with valid source and target nodes', async () => {
    const edges = await db.select().from(keywordEdges).limit(10);

    for (const edge of edges) {
      const [source] = await db
        .select({ id: keywordNodes.id })
        .from(keywordNodes)
        .where(eq(keywordNodes.id, edge.sourceId!));
      const [target] = await db
        .select({ id: keywordNodes.id })
        .from(keywordNodes)
        .where(eq(keywordNodes.id, edge.targetId!));

      expect(source).toBeDefined();
      expect(target).toBeDefined();
    }
  });

  it('has at least some trending keywords', async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(keywordNodes)
      .where(eq(keywordNodes.trending, true));
    expect(Number(count)).toBeGreaterThan(0);
  });
});

describe('Seed Data: Skill Vocabulary Consistency', () => {
  it('all talent skills use controlled vocabulary names', async () => {
    const { ALL_SKILLS } = await import('../../scripts/seed/vocabulary');
    const skillSet = new Set(ALL_SKILLS);

    const profiles = await db.select({ skills: talentProfiles.skills }).from(talentProfiles).limit(20);

    for (const profile of profiles) {
      const skills = profile.skills as Array<{ name: string }>;
      for (const skill of skills) {
        expect(skillSet.has(skill.name)).toBe(true);
      }
    }
  });

  it('all job required skills use controlled vocabulary names', async () => {
    const { ALL_SKILLS } = await import('../../scripts/seed/vocabulary');
    const skillSet = new Set(ALL_SKILLS);

    const allJobs = await db.select({ structured: jobs.structured }).from(jobs).limit(20);

    for (const job of allJobs) {
      const structured = job.structured as any;
      const skills = structured?.skills ?? [];
      for (const skill of skills) {
        expect(skillSet.has(skill.name)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/e2e/flow-checklist.test.ts
git commit -m "test: add end-to-end seed data quality and flow checklist tests"
```

---

### Task 15: Final Integration and Verification

- [x] **Step 1: Verify all imports resolve**

Run the TypeScript checker:

```bash
npm run typecheck
```

Fix any import path issues. The seed scripts use `@/` aliases which need to work with `tsx`. If not, add a `tsconfig.seed.json` that extends the base config:

Create `tsconfig.seed.json` if needed:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["scripts/**/*.ts", "src/**/*.ts"]
}
```

Update seed scripts in `package.json` to use it:

```json
{
  "seed": "npx tsx --tsconfig tsconfig.seed.json scripts/seed.ts seed"
}
```

- [x] **Step 2: Run vocabulary tests**

```bash
npx vitest run __tests__/seed/vocabulary.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Run full seed (requires database + LLM API key)**

```bash
npm run seed
```

Expected output:
```
═══════════════════════════════════════
  CSV Full Seed — Starting...
═══════════════════════════════════════

🔑 Seeding predefined user accounts...
✅ 5 user accounts ready.

👤 Generating talent profiles via LLM...
✅ 50 talent profiles generated.

🏢 Generating enterprise profiles via LLM...
✅ 15 enterprise profiles generated.

📋 Generating job postings via LLM...
✅ 30 job postings generated.

🧮 Computing embeddings...
✅ Embeddings complete: 50 profiles + 30 jobs.

🔗 Computing matches...
✅ ~200 matches computed, ~100 AI reasonings generated.

🎯 Ensuring demo accounts have high matches...
✅ Demo high matches ensured.

🕸️  Building keyword graph...
✅ Keyword graph built: ~60 nodes, ~150 edges.

📬 Generating inbox items...
✅ ~50 inbox items generated.

📊 Generating seeking reports...
✅ Seeking reports generated.

═══════════════════════════════════════
  ✅ Full seed complete!
═══════════════════════════════════════
```

- [ ] **Step 4: Run flow checklist tests against seeded database**

```bash
npx vitest run __tests__/e2e/flow-checklist.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Manual demo walkthrough**

Verify manually:
1. Open browser to `/` — landing page loads with all 4 sections
2. Login as `talent1@csv.dev` / `csv2026` — lands on `/talent/home` with profile data
3. Navigate to `/talent/seeking` — report shows with matches
4. Navigate to `/talent/inbox` — inbox has notifications
5. Navigate to `/talent/fair` — keyword graph renders
6. Logout, login as `enterprise1@csv.dev` — dashboard shows jobs and matches
7. Navigate to `/enterprise/jobs` — job list with match counts
8. Navigate to `/enterprise/inbox` — enterprise notifications

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(spec7): complete seed data + demo polish — all components, tests, and landing page"
```
