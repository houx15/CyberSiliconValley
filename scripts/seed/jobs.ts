import { generateText } from 'ai';
import { sql } from 'drizzle-orm';

import { getModel } from '../../src/lib/ai/providers';
import { db } from '../../src/lib/db';
import { enterpriseProfiles, jobs } from '../../src/lib/db/schema';
import type { StructuredJob } from '../../src/types';
import { buildJobPostingsPrompt } from './prompts';
import { isValidSkillName } from './vocabulary';

type GeneratedJob = {
  title?: string;
  description?: string;
  structured?: Record<string, unknown>;
};

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonArray<T>(text: string): T[] {
  const parsed = JSON.parse(stripJsonFences(text)) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function getJobCountForSize(companySize: string): number {
  if (companySize.includes('5000') || companySize.includes('10000')) {
    return 3;
  }
  if (companySize.includes('500') || companySize.includes('1000')) {
    return 2;
  }
  if (companySize.includes('200')) {
    return 2;
  }
  return 1;
}

function normalizeLevel(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'intermediate';
}

function normalizeStructuredJob(structured: Record<string, unknown> | undefined): StructuredJob & { location?: string } {
  const rawSkills = Array.isArray(structured?.skills)
    ? (structured?.skills as Array<Record<string, unknown>>)
    : [];
  const skills = rawSkills
    .filter((skill) => isValidSkillName(String(skill.name ?? '')))
    .slice(0, 8)
    .map((skill) => ({
      name: String(skill.name),
      level: normalizeLevel(skill.level),
      required: Boolean(skill.required),
    }));

  const budgetSource =
    typeof structured?.budget === 'object' && structured?.budget !== null
      ? (structured.budget as Record<string, unknown>)
      : typeof structured?.budgetRange === 'object' && structured?.budgetRange !== null
        ? (structured.budgetRange as Record<string, unknown>)
        : {};

  return {
    skills,
    seniority:
      typeof structured?.seniority === 'string' && structured.seniority.length > 0
        ? structured.seniority
        : 'mid',
    timeline:
      typeof structured?.timeline === 'string' && structured.timeline.length > 0
        ? structured.timeline
        : 'Immediate start / full-time',
    deliverables: Array.isArray(structured?.deliverables)
      ? structured.deliverables.map((item) => String(item))
      : [],
    budget: {
      min:
        typeof budgetSource.min === 'number'
          ? budgetSource.min
          : undefined,
      max:
        typeof budgetSource.max === 'number'
          ? budgetSource.max
          : undefined,
      currency:
        typeof budgetSource.currency === 'string' && budgetSource.currency.length > 0
          ? budgetSource.currency
          : '万/年',
    },
    workMode:
      structured?.workMode === 'onsite' ||
      structured?.workMode === 'hybrid' ||
      structured?.workMode === 'remote'
        ? structured.workMode
        : 'remote',
    location:
      typeof structured?.location === 'string' ? structured.location : '中国',
  };
}

function distributeJobCounts(
  enterprises: Array<{ id: string; companySize: string | null }>,
  targetTotal: number
): Map<string, number> {
  const jobCounts = new Map<string, number>();
  let assigned = 0;

  for (const enterprise of enterprises) {
    const count = getJobCountForSize(enterprise.companySize ?? '50');
    jobCounts.set(enterprise.id, count);
    assigned += count;
  }

  let index = 0;
  while (assigned < targetTotal && enterprises.length > 0) {
    const enterprise = enterprises[index % enterprises.length];
    if (!enterprise) {
      break;
    }
    jobCounts.set(enterprise.id, (jobCounts.get(enterprise.id) ?? 1) + 1);
    assigned += 1;
    index += 1;
  }

  index = 0;
  while (assigned > targetTotal && enterprises.length > 0) {
    const enterprise = enterprises[index % enterprises.length];
    if (!enterprise) {
      break;
    }
    const current = jobCounts.get(enterprise.id) ?? 1;
    if (current > 1) {
      jobCounts.set(enterprise.id, current - 1);
      assigned -= 1;
    }
    index += 1;
  }

  return jobCounts;
}

export async function seedJobs(): Promise<void> {
  console.log('📋 Generating job postings via LLM...');

  const existingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs);
  const existingCount = existingRows[0]?.count ?? 0;

  if (existingCount >= 30) {
    console.log('  ✓ 30+ jobs already exist, skipping.\n');
    return;
  }

  const enterprises = await db
    .select({
      id: enterpriseProfiles.id,
      companyName: enterpriseProfiles.companyName,
      industry: enterpriseProfiles.industry,
      companySize: enterpriseProfiles.companySize,
      aiMaturity: enterpriseProfiles.aiMaturity,
      preferences: enterpriseProfiles.preferences,
    })
    .from(enterpriseProfiles);

  if (enterprises.length === 0) {
    console.error('  ✗ No enterprise profiles found. Run seed:profiles first.');
    return;
  }

  const model = getModel();
  const jobCounts = distributeJobCounts(enterprises, 30);
  let totalJobs = 0;

  for (const enterprise of enterprises) {
    const jobCount = jobCounts.get(enterprise.id) ?? 1;
    console.log(`  Generating ${jobCount} jobs for ${enterprise.companyName}...`);

    const { text } = await generateText({
      model,
      prompt: buildJobPostingsPrompt({
        companyName: enterprise.companyName ?? 'Unknown Company',
        industry: enterprise.industry ?? 'AI',
        companySize: enterprise.companySize ?? '50-200',
        aiMaturity: enterprise.aiMaturity ?? 'adopting',
        jobCount,
      }),
      maxOutputTokens: 5000,
      temperature: 0.8,
    });

    let postings: GeneratedJob[] = [];
    try {
      postings = parseJsonArray<GeneratedJob>(text);
    } catch (error) {
      console.error(`  ✗ Failed to parse jobs for ${enterprise.companyName}:`, error);
      continue;
    }

    for (const posting of postings.slice(0, jobCount)) {
      const structured = normalizeStructuredJob(posting.structured);
      if (structured.skills.length < 3) {
        continue;
      }

      const preferences = (enterprise.preferences ?? {}) as Record<string, unknown>;
      await db.insert(jobs).values({
        enterpriseId: enterprise.id,
        title: posting.title?.trim() || `${enterprise.industry ?? 'AI'} Engineer`,
        description:
          posting.description?.trim() ||
          `Join ${enterprise.companyName ?? 'this company'} to build applied AI systems for enterprise customers.`,
        structured,
        status: 'open',
        autoMatch:
          typeof preferences.autoMatch === 'boolean'
            ? preferences.autoMatch
            : true,
        autoPrechat:
          typeof preferences.autoPrechat === 'boolean'
            ? preferences.autoPrechat
            : Math.random() > 0.7,
      });
      totalJobs += 1;
    }

    console.log(`  ✓ ${Math.min(postings.length, jobCount)} jobs inserted for ${enterprise.companyName}.`);
  }

  console.log(`✅ ${totalJobs} job postings generated.\n`);
}
