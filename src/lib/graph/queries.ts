import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs, keywordEdges, keywordNodes, matches } from '@/lib/db/schema';
import type { ClusterJob, ClusterJobSkill, GraphData, GraphEdge, GraphNode, JobDetail } from '@/types/graph';

type JobStructured = {
  skills?: ClusterJobSkill[];
  location?: string;
  workMode?: string;
  seniority?: string;
  budgetRange?: string;
  budget?: { min?: number; max?: number; currency?: string };
  timeline?: string;
  deliverables?: string | string[];
};

function formatBudgetRange(structured: JobStructured): string {
  if (structured.budgetRange) {
    return structured.budgetRange;
  }

  const budget = structured.budget;
  if (!budget) {
    return '';
  }

  const parts = [budget.min, budget.max].filter((value): value is number => typeof value === 'number');
  if (parts.length === 0) {
    return '';
  }

  const prefix = budget.currency ? `${budget.currency} ` : '';
  if (parts.length === 1) {
    return `${prefix}${parts[0]}`;
  }

  return `${prefix}${parts[0]}-${parts[1]}`;
}

function formatDeliverables(deliverables: JobStructured['deliverables']): string {
  if (Array.isArray(deliverables)) {
    return deliverables.join(', ');
  }

  return deliverables ?? '';
}

export async function getGraphData(): Promise<GraphData> {
  const [nodeRows, edgeRows] = await Promise.all([
    db
      .select({
        id: keywordNodes.id,
        keyword: keywordNodes.keyword,
        jobCount: keywordNodes.jobCount,
        trending: keywordNodes.trending,
      })
      .from(keywordNodes)
      .orderBy(keywordNodes.jobCount),
    db
      .select({
        id: keywordEdges.id,
        sourceId: keywordEdges.sourceId,
        targetId: keywordEdges.targetId,
        weight: keywordEdges.weight,
      })
      .from(keywordEdges)
      .orderBy(keywordEdges.weight),
  ]);

  const nodes: GraphNode[] = nodeRows.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    jobCount: row.jobCount ?? 0,
    trending: row.trending ?? false,
  }));

  const edges: GraphEdge[] = edgeRows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    weight: row.weight ?? 1,
  }));

  return { nodes, edges };
}

export async function getJobsForKeyword(keyword: string, talentId?: string): Promise<ClusterJob[]> {
  const jobRows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      structured: jobs.structured,
      enterpriseId: jobs.enterpriseId,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'open'),
        sql`${jobs.structured}->'skills' @> ${JSON.stringify([{ name: keyword }])}::jsonb
          OR ${jobs.structured}->'skills' @> ${JSON.stringify([{ name: keyword.toLowerCase() }])}::jsonb`
      )
    )
    .limit(20);

  const enterpriseIds = [...new Set(jobRows.map((job) => job.enterpriseId).filter(Boolean))] as string[];
  const enterprises =
    enterpriseIds.length > 0
      ? await db
          .select({
            id: enterpriseProfiles.id,
            companyName: enterpriseProfiles.companyName,
          })
          .from(enterpriseProfiles)
          .where(inArray(enterpriseProfiles.id, enterpriseIds))
          .limit(enterpriseIds.length)
      : [];

  const enterpriseMap = new Map(enterprises.map((enterprise) => [enterprise.id, enterprise.companyName ?? 'Unknown Company']));

  let matchMap = new Map<string, number>();
  if (talentId && jobRows.length > 0) {
    const matchRows = await db
      .select({
        jobId: matches.jobId,
        score: matches.score,
      })
      .from(matches)
      .where(and(eq(matches.talentId, talentId), inArray(matches.jobId, jobRows.map((job) => job.id))))
      .limit(jobRows.length);
    matchMap = new Map(matchRows.map((match) => [match.jobId, match.score]));
  }

  return jobRows.map((job) => {
    const structured = (job.structured ?? {}) as JobStructured;

    return {
      id: job.id,
      title: job.title ?? '',
      companyName: enterpriseMap.get(job.enterpriseId) ?? 'Unknown Company',
      location: structured.location ?? 'Remote',
      workMode: structured.workMode ?? 'remote',
      matchScore: matchMap.get(job.id) ?? null,
      skills: structured.skills ?? [],
    };
  });
}

export async function getJobDetail(jobId: string, talentId?: string): Promise<JobDetail | null> {
  const jobRows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      structured: jobs.structured,
      enterpriseId: jobs.enterpriseId,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  const jobRow = jobRows[0];
  if (!jobRow) {
    return null;
  }

  const structured = (jobRow.structured ?? {}) as JobStructured;

  let companyName = 'Unknown Company';
  if (jobRow.enterpriseId) {
    const companyRows = await db
      .select({
        companyName: enterpriseProfiles.companyName,
      })
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.id, jobRow.enterpriseId))
      .limit(1);
    companyName = companyRows[0]?.companyName ?? companyName;
  }

  let matchScore: number | null = null;
  let matchBreakdown: Record<string, number> | null = null;
  let aiReasoning: string | null = null;

  if (talentId) {
    const matchRows = await db
      .select({
        score: matches.score,
        breakdown: matches.breakdown,
        aiReasoning: matches.aiReasoning,
      })
      .from(matches)
      .where(and(eq(matches.jobId, jobId), eq(matches.talentId, talentId)))
      .limit(1);

    const match = matchRows[0];
    if (match) {
      matchScore = match.score;
      matchBreakdown = (match.breakdown as Record<string, number> | null) ?? null;
      aiReasoning = match.aiReasoning ?? null;
    }
  }

  return {
    id: jobRow.id,
    title: jobRow.title ?? '',
    description: jobRow.description ?? '',
    companyName,
    location: structured.location ?? 'Remote',
    workMode: structured.workMode ?? 'remote',
    seniority: structured.seniority ?? '',
    budgetRange: formatBudgetRange(structured),
    timeline: structured.timeline ?? '',
    deliverables: formatDeliverables(structured.deliverables),
    matchScore,
    matchBreakdown,
    aiReasoning,
    skills: structured.skills ?? [],
  };
}
