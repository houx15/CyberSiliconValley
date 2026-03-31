import type { Job } from 'bullmq';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobs, keywordEdges, keywordNodes } from '@/lib/db/schema';

type OpenJobRow = {
  createdAt: Date | string | null;
  structured: unknown;
};

type GraphSnapshotJob = {
  keyword: string;
  jobCount: number;
  trending: boolean;
};

type GraphSnapshotEdge = {
  sourceKeyword: string;
  targetKeyword: string;
  weight: number;
};

export type GraphSnapshot = {
  nodes: GraphSnapshotJob[];
  edges: GraphSnapshotEdge[];
  trendingCount: number;
};

type GraphNodeInsert = {
  id: string;
  keyword: string;
  jobCount: number;
  trending: boolean;
  createdAt: Date;
};

type ExistingGraphNode = {
  id: string;
  keyword: string;
};

type GraphEdgeInsert = {
  sourceId: string;
  targetId: string;
  weight: number;
};

const TOP_KEYWORD_LIMIT = 80;
const TRENDING_WINDOW_DAYS = 7;
const MIN_EDGE_WEIGHT = 2;

function normalizeSkillName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getUniqueSkillNames(structured: Record<string, unknown> | null): string[] {
  const skills = Array.isArray(structured?.skills) ? structured?.skills : [];
  const names = new Set<string>();

  for (const skill of skills as Array<{ name?: unknown }>) {
    const normalized = normalizeSkillName(skill?.name);
    if (normalized) {
      names.add(normalized);
    }
  }

  return [...names];
}

function getRecentCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TRENDING_WINDOW_DAYS);
  return cutoff;
}

function compareKeywords(left: string, right: string): number {
  return left.localeCompare(right);
}

export function planKeywordNodeSync(
  existingNodes: ExistingGraphNode[],
  snapshotNodes: GraphSnapshotJob[],
  now = new Date()
): {
  updates: Array<{ id: string; keyword: string; jobCount: number; trending: boolean }>;
  inserts: GraphNodeInsert[];
  keywordToId: Map<string, string>;
  removedNodeIds: string[];
} {
  const existingMap = new Map(existingNodes.map((node) => [node.keyword, node.id]));
  const snapshotKeywordSet = new Set(snapshotNodes.map((node) => node.keyword));
  const updates: Array<{ id: string; keyword: string; jobCount: number; trending: boolean }> = [];
  const inserts: GraphNodeInsert[] = [];
  const keywordToId = new Map<string, string>();

  for (const node of snapshotNodes) {
    const existingId = existingMap.get(node.keyword);
    if (existingId) {
      updates.push({
        id: existingId,
        keyword: node.keyword,
        jobCount: node.jobCount,
        trending: node.trending,
      });
      keywordToId.set(node.keyword, existingId);
      continue;
    }

    const id = crypto.randomUUID();
    inserts.push({
      id,
      keyword: node.keyword,
      jobCount: node.jobCount,
      trending: node.trending,
      createdAt: now,
    });
    keywordToId.set(node.keyword, id);
  }

  const removedNodeIds = existingNodes
    .filter((node) => !snapshotKeywordSet.has(node.keyword))
    .map((node) => node.id);

  return {
    updates,
    inserts,
    keywordToId,
    removedNodeIds,
  };
}

export function deriveGraphSnapshot(openJobs: OpenJobRow[], now = new Date()): GraphSnapshot {
  const cutoff = getRecentCutoff(now);
  const keywordCounts = new Map<string, number>();
  const recentKeywordCounts = new Map<string, number>();
  const coOccurrence = new Map<string, number>();

  for (const job of openJobs) {
    const structured = isRecord(job.structured) ? job.structured : null;
    const skillNames = getUniqueSkillNames(structured);
    const createdAt = job.createdAt ? new Date(job.createdAt) : null;
    const isRecent = createdAt ? createdAt >= cutoff : false;

    for (const keyword of skillNames) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
      if (isRecent) {
        recentKeywordCounts.set(keyword, (recentKeywordCounts.get(keyword) ?? 0) + 1);
      }
    }

    for (let i = 0; i < skillNames.length; i += 1) {
      for (let j = i + 1; j < skillNames.length; j += 1) {
        const [left, right] = [skillNames[i]!, skillNames[j]!].sort(compareKeywords);
        const key = `${left}|||${right}`;
        coOccurrence.set(key, (coOccurrence.get(key) ?? 0) + 1);
      }
    }
  }

  const topKeywords = [...keywordCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return compareKeywords(left[0], right[0]);
    })
    .slice(0, TOP_KEYWORD_LIMIT);

  const trendingKeywords = new Set<string>();
  for (const [keyword, totalCount] of topKeywords) {
    const recentCount = recentKeywordCounts.get(keyword) ?? 0;
    if (totalCount > 0 && recentCount / totalCount > 0.3) {
      trendingKeywords.add(keyword);
    }
  }

  const topKeywordSet = new Set(topKeywords.map(([keyword]) => keyword));
  const nodes = topKeywords.map(([keyword, jobCount]) => ({
    keyword,
    jobCount,
    trending: trendingKeywords.has(keyword),
  }));

  const edges = [...coOccurrence.entries()]
    .filter(([key, weight]) => {
      if (weight < MIN_EDGE_WEIGHT) {
        return false;
      }

      const [left, right] = key.split('|||') as [string, string];
      return topKeywordSet.has(left) && topKeywordSet.has(right);
    })
    .map(([key, weight]) => {
      const [sourceKeyword, targetKeyword] = key.split('|||') as [string, string];
      return {
        sourceKeyword,
        targetKeyword,
        weight,
      };
    })
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      const sourceCompare = left.sourceKeyword.localeCompare(right.sourceKeyword);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      return left.targetKeyword.localeCompare(right.targetKeyword);
    });

  return {
    nodes,
    edges,
    trendingCount: trendingKeywords.size,
  };
}

async function rebuildGraph(snapshot: GraphSnapshot): Promise<void> {
  await db.transaction(async (tx) => {
    const existingNodes = await tx
      .select({ id: keywordNodes.id, keyword: keywordNodes.keyword })
      .from(keywordNodes);

    const plan = planKeywordNodeSync(existingNodes, snapshot.nodes);

    await tx.delete(keywordEdges);

    for (const update of plan.updates) {
      await tx
        .update(keywordNodes)
        .set({
          jobCount: update.jobCount,
          trending: update.trending,
        })
        .where(eq(keywordNodes.id, update.id));
    }

    if (plan.inserts.length > 0) {
      await tx.insert(keywordNodes).values(plan.inserts);
    }

    if (plan.removedNodeIds.length > 0) {
      await tx.delete(keywordNodes).where(inArray(keywordNodes.id, plan.removedNodeIds));
    }

    if (snapshot.nodes.length === 0) {
      return;
    }

    const edgeRows: GraphEdgeInsert[] = snapshot.edges
      .map((edge) => {
        const sourceId = plan.keywordToId.get(edge.sourceKeyword);
        const targetId = plan.keywordToId.get(edge.targetKeyword);
        if (!sourceId || !targetId) {
          return null;
        }

        return {
          sourceId,
          targetId,
          weight: edge.weight,
        };
      })
      .filter((edge): edge is GraphEdgeInsert => edge !== null);

    if (edgeRows.length > 0) {
      await tx.insert(keywordEdges).values(edgeRows);
    }
  });
}

export async function updateGraphWorker(job?: Job<{ trigger: string }>): Promise<GraphSnapshot> {
  if (job) {
    console.log(`[update-graph] Trigger: ${job.data.trigger}`);
  }

  const openJobs = await db
    .select({
      createdAt: jobs.createdAt,
      structured: jobs.structured,
    })
    .from(jobs)
    .where(eq(jobs.status, 'open'));

  const snapshot = deriveGraphSnapshot(openJobs as OpenJobRow[]);
  await rebuildGraph(snapshot);

  if (job) {
    job.log(
      `Updated ${snapshot.nodes.length} keyword nodes and ${snapshot.edges.length} keyword edges`
    );
  }

  return snapshot;
}
