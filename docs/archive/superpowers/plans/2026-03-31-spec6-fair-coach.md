# Spec 6: Opportunity Fair + AI Coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the keyword graph visualization (Opportunity Fair) and AI Coach chat interface so talent users can explore the job landscape visually and get personalized career coaching.

**Architecture:** The Opportunity Fair is a D3.js force-directed graph rendered in a React client component, reading from `keyword_nodes` and `keyword_edges` tables. Clicking a keyword zooms into a cluster view showing matching jobs as company cards, with a Sheet for job detail. The AI Coach is a full-page chat interface with four mode tabs (Chat, Resume Review, Mock Interview, Skill Gaps), all hitting the same `POST /api/internal/ai/coach` endpoint with mode-specific system prompt variations. A BullMQ background job `update-graph` recomputes graph data when jobs change.

**Tech Stack:** Next.js 15, TypeScript, D3.js (d3-force, d3-zoom, d3-selection), React, Tailwind CSS 4, shadcn/ui (Sheet, Tabs, Badge, Input, Button, Card, Skeleton), Framer Motion, Vercel AI SDK, Drizzle ORM, BullMQ

---

## File Structure

```
csv/
├── src/
│   ├── app/
│   │   ├── (talent)/
│   │   │   ├── fair/
│   │   │   │   └── page.tsx                  # Opportunity Fair page (server component wrapper)
│   │   │   └── coach/
│   │   │       └── page.tsx                  # AI Coach page (server component wrapper)
│   │   └── api/
│   │       ├── internal/
│   │       │   └── ai/
│   │       │       └── coach/
│   │       │           └── route.ts          # AI Coach streaming endpoint
│   │       └── v1/
│   │           ├── graph/
│   │           │   └── route.ts              # GET keyword graph data
│   │           └── graph/
│   │               └── [keyword]/
│   │                   └── jobs/
│   │                       └── route.ts      # GET jobs for a keyword cluster
│   ├── components/
│   │   ├── fair/
│   │   │   ├── keyword-graph.tsx             # D3 force simulation client component
│   │   │   ├── cluster-view.tsx              # Zoomed-in keyword cluster with company cards
│   │   │   ├── company-card.tsx              # Individual company card in cluster
│   │   │   ├── job-detail-sheet.tsx           # Job detail Sheet panel
│   │   │   └── graph-search.tsx              # Search input for keyword nodes
│   │   └── coach/
│   │       ├── coach-chat.tsx                # Main coach chat client component
│   │       ├── coach-mode-tabs.tsx           # Four mode tabs
│   │       ├── gap-analysis-card.tsx         # Skill gap analysis structured card
│   │       └── before-after-card.tsx         # Before/after reword suggestions
│   ├── lib/
│   │   ├── ai/
│   │   │   └── prompts/
│   │   │       └── coach.ts                  # Coach system prompt builder
│   │   ├── graph/
│   │   │   └── queries.ts                    # Graph data queries (nodes, edges, jobs)
│   │   └── jobs/
│   │       └── workers/
│   │           └── update-graph.ts           # BullMQ worker: recompute graph data
│   └── types/
│       └── graph.ts                          # Graph-specific type definitions
└── __tests__/
    ├── lib/
    │   ├── graph/
    │   │   └── queries.test.ts               # Graph query tests
    │   └── ai/
    │       └── prompts/
    │           └── coach.test.ts             # Coach prompt builder tests
    └── components/
        └── fair/
            └── keyword-graph.test.ts         # Graph component unit tests
```

---

### Task 1: Graph Type Definitions and Data Queries

**Files:**
- Create: `src/types/graph.ts`
- Create: `src/lib/graph/queries.ts`
- Create: `__tests__/lib/graph/queries.test.ts`

- [x] **Step 1: Create graph type definitions**

Create `src/types/graph.ts`:

```typescript
export interface GraphNode {
  id: string;
  keyword: string;
  jobCount: number;
  trending: boolean;
  // Computed client-side
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  isUserSkill?: boolean;
  radius?: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ClusterJob {
  id: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  matchScore: number | null;
  skills: { name: string; level: string; required: boolean }[];
}

export interface JobDetail extends ClusterJob {
  description: string;
  seniority: string;
  budgetRange: string;
  timeline: string;
  deliverables: string;
  matchBreakdown: Record<string, number> | null;
  aiReasoning: string | null;
}

export type CoachMode = 'chat' | 'resume-review' | 'mock-interview' | 'skill-gaps';
```

- [x] **Step 2: Create graph data queries**

Create `src/lib/graph/queries.ts`:

```typescript
import { db } from '@/lib/db';
import { keywordNodes, keywordEdges, jobs, matches, enterpriseProfiles } from '@/lib/db/schema';
import { eq, sql, inArray, and } from 'drizzle-orm';
import type { GraphData, GraphNode, GraphEdge, ClusterJob, JobDetail } from '@/types/graph';

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
      .from(keywordEdges),
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
    weight: row.weight ?? 1.0,
  }));

  return { nodes, edges };
}

export async function getJobsForKeyword(
  keyword: string,
  talentId?: string
): Promise<ClusterJob[]> {
  // Find jobs where structured.skills contains this keyword
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

  // Get enterprise profiles for company names
  const enterpriseIds = [...new Set(jobRows.map((j) => j.enterpriseId).filter(Boolean))] as string[];
  const enterprises =
    enterpriseIds.length > 0
      ? await db
          .select({
            id: enterpriseProfiles.id,
            userId: enterpriseProfiles.userId,
            companyName: enterpriseProfiles.companyName,
          })
          .from(enterpriseProfiles)
          .where(inArray(enterpriseProfiles.userId, enterpriseIds))
      : [];

  const enterpriseMap = new Map(enterprises.map((e) => [e.userId, e.companyName]));

  // Get match scores if talent is logged in
  let matchMap = new Map<string, number>();
  if (talentId) {
    const matchRows = await db
      .select({
        jobId: matches.jobId,
        score: matches.score,
      })
      .from(matches)
      .where(
        and(
          eq(matches.talentId, talentId),
          inArray(
            matches.jobId,
            jobRows.map((j) => j.id)
          )
        )
      );
    matchMap = new Map(matchRows.map((m) => [m.jobId, m.score]));
  }

  return jobRows.map((job) => {
    const structured = (job.structured as Record<string, unknown>) || {};
    const skills = (structured.skills as { name: string; level: string; required: boolean }[]) || [];
    return {
      id: job.id,
      title: job.title ?? '',
      companyName: enterpriseMap.get(job.enterpriseId ?? '') ?? 'Unknown Company',
      location: (structured.workMode as string) || 'Remote',
      workMode: (structured.workMode as string) || 'Remote',
      matchScore: matchMap.get(job.id) ?? null,
      skills,
    };
  });
}

export async function getJobDetail(
  jobId: string,
  talentId?: string
): Promise<JobDetail | null> {
  const [jobRow] = await db
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

  if (!jobRow) return null;

  const structured = (jobRow.structured as Record<string, unknown>) || {};

  let companyName = 'Unknown Company';
  if (jobRow.enterpriseId) {
    const [enterprise] = await db
      .select({ companyName: enterpriseProfiles.companyName })
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, jobRow.enterpriseId))
      .limit(1);
    if (enterprise) companyName = enterprise.companyName ?? companyName;
  }

  let matchScore: number | null = null;
  let matchBreakdown: Record<string, number> | null = null;
  let aiReasoning: string | null = null;
  if (talentId) {
    const [matchRow] = await db
      .select({
        score: matches.score,
        breakdown: matches.breakdown,
        aiReasoning: matches.aiReasoning,
      })
      .from(matches)
      .where(and(eq(matches.jobId, jobId), eq(matches.talentId, talentId)))
      .limit(1);
    if (matchRow) {
      matchScore = matchRow.score;
      matchBreakdown = matchRow.breakdown as Record<string, number> | null;
      aiReasoning = matchRow.aiReasoning;
    }
  }

  const skills = (structured.skills as { name: string; level: string; required: boolean }[]) || [];

  return {
    id: jobRow.id,
    title: jobRow.title ?? '',
    description: jobRow.description ?? '',
    companyName,
    location: (structured.workMode as string) || 'Remote',
    workMode: (structured.workMode as string) || 'Remote',
    seniority: (structured.seniority as string) || '',
    budgetRange: (structured.budgetRange as string) || '',
    timeline: (structured.timeline as string) || '',
    deliverables: (structured.deliverables as string) || '',
    matchScore,
    matchBreakdown,
    aiReasoning,
    skills,
  };
}
```

- [x] **Step 3: Create graph query tests**

Create `__tests__/lib/graph/queries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  keywordNodes: { id: 'id', keyword: 'keyword', jobCount: 'job_count', trending: 'trending' },
  keywordEdges: { id: 'id', sourceId: 'source_id', targetId: 'target_id', weight: 'weight' },
  jobs: { id: 'id', title: 'title', description: 'description', structured: 'structured', status: 'status', enterpriseId: 'enterprise_id' },
  matches: { jobId: 'job_id', talentId: 'talent_id', score: 'score', breakdown: 'breakdown', aiReasoning: 'ai_reasoning' },
  enterpriseProfiles: { id: 'id', userId: 'user_id', companyName: 'company_name' },
}));

describe('Graph Types', () => {
  it('should define GraphNode interface correctly', () => {
    const node = {
      id: 'abc-123',
      keyword: 'RAG',
      jobCount: 5,
      trending: true,
    };
    expect(node.keyword).toBe('RAG');
    expect(node.jobCount).toBe(5);
    expect(node.trending).toBe(true);
  });

  it('should define GraphEdge interface correctly', () => {
    const edge = {
      id: 'edge-1',
      sourceId: 'node-a',
      targetId: 'node-b',
      weight: 3.5,
    };
    expect(edge.weight).toBe(3.5);
  });

  it('should define ClusterJob interface correctly', () => {
    const job = {
      id: 'job-1',
      title: 'ML Engineer',
      companyName: 'TechCorp',
      location: 'Remote',
      workMode: 'Remote',
      matchScore: 85,
      skills: [{ name: 'Python', level: 'expert', required: true }],
    };
    expect(job.matchScore).toBe(85);
    expect(job.skills).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run tests and commit**

```bash
npm run test -- __tests__/lib/graph/queries.test.ts
git add -A
git commit -m "feat(fair): add graph type definitions and data query layer"
```

---

### Task 2: Graph Data API Endpoint

**Files:**
- Create: `src/app/api/v1/graph/route.ts`
- Create: `src/app/api/v1/graph/[keyword]/jobs/route.ts`

- [x] **Step 1: Create graph data GET endpoint**

Create `src/app/api/v1/graph/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getGraphData } from '@/lib/graph/queries';

export async function GET() {
  try {
    const data = await getGraphData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}
```

- [x] **Step 2: Create keyword jobs GET endpoint**

Create `src/app/api/v1/graph/[keyword]/jobs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getJobsForKeyword, getJobDetail } from '@/lib/graph/queries';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  try {
    const { keyword } = await params;
    const decodedKeyword = decodeURIComponent(keyword);

    // Try to get talent ID for match scores
    let talentId: string | undefined;
    try {
      const token = request.cookies.get('token')?.value;
      if (token) {
        const payload = await verifyToken(token);
        if (payload?.role === 'talent') {
          const [profile] = await db
            .select({ id: talentProfiles.id })
            .from(talentProfiles)
            .where(eq(talentProfiles.userId, payload.userId as string))
            .limit(1);
          if (profile) talentId = profile.id;
        }
      }
    } catch {
      // Continue without match scores
    }

    // Check if this is a job detail request
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (jobId) {
      const detail = await getJobDetail(jobId, talentId);
      if (!detail) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const jobs = await getJobsForKeyword(decodedKeyword, talentId);
    return NextResponse.json({ keyword: decodedKeyword, jobs });
  } catch (error) {
    console.error('Failed to fetch jobs for keyword:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(fair): add graph data and keyword jobs API endpoints"
```

---

### Task 3: D3.js Keyword Graph Component

**Files:**
- Create: `src/components/fair/keyword-graph.tsx`

This is the core visualization component. It renders a D3 force simulation with keyword pill nodes, edges, zoom/pan, and skill highlighting.

- [x] **Step 1: Install D3 dependencies**

```bash
npm install d3 @types/d3
```

- [x] **Step 2: Create the keyword graph client component**

Create `src/components/fair/keyword-graph.tsx`:

```typescript
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphData } from '@/types/graph';

interface KeywordGraphProps {
  data: GraphData;
  userSkills: string[];
  onKeywordClick: (keyword: string) => void;
  searchKeyword: string | null;
}

// Constants
const MIN_NODE_RADIUS = 30;
const MAX_NODE_RADIUS = 70;
const PILL_HEIGHT = 32;
const PILL_PADDING_X = 16;
const PILL_PADDING_Y = 6;
const COLORS = {
  nodeFill: '#1e1e2e',
  nodeStroke: '#4a4a6a',
  nodeText: '#e0e0e0',
  userSkillFill: '#1a1a3e',
  userSkillStroke: '#6366f1',
  userSkillGlow: 'rgba(99, 102, 241, 0.5)',
  edgeStroke: '#2a2a4a',
  trendingFire: '#22c55e',
  countText: '#9ca3af',
  searchHighlight: '#f59e0b',
};

function measureTextWidth(text: string, fontSize: number): number {
  // Approximate character width: ~0.6 * fontSize for average characters
  return text.length * fontSize * 0.6 + PILL_PADDING_X * 2;
}

export default function KeywordGraph({
  data,
  userSkills,
  onKeywordClick,
  searchKeyword,
}: KeywordGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, d3.SimulationLinkDatum<GraphNode>> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Mark user skills on nodes
  const processedNodes = useCallback(() => {
    const userSkillSet = new Set(userSkills.map((s) => s.toLowerCase()));
    const maxJobCount = Math.max(...data.nodes.map((n) => n.jobCount), 1);

    return data.nodes.map((node) => ({
      ...node,
      isUserSkill: userSkillSet.has(node.keyword.toLowerCase()),
      radius:
        MIN_NODE_RADIUS +
        (node.jobCount / maxJobCount) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS),
    }));
  }, [data.nodes, userSkills]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      setDimensions({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main D3 rendering
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return;
    if (data.nodes.length === 0) return;

    const { width, height } = dimensions;
    const nodes = processedNodes();
    const edges = data.edges.map((e) => ({ ...e }));

    // Clear previous content
    d3.select(svg).selectAll('*').remove();

    const svgSelection = d3
      .select(svg)
      .attr('width', width)
      .attr('height', height);

    // Defs for glow filter
    const defs = svgSelection.append('defs');

    const glowFilter = defs
      .append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');

    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Container group for zoom/pan
    const g = svgSelection.append('g');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svgSelection.call(zoom);

    // Build link index for force simulation
    const linkData: d3.SimulationLinkDatum<GraphNode>[] = edges
      .map((e) => {
        const source = nodes.find((n) => n.id === e.sourceId);
        const target = nodes.find((n) => n.id === e.targetId);
        if (!source || !target) return null;
        return { source, target, weight: e.weight };
      })
      .filter(Boolean) as d3.SimulationLinkDatum<GraphNode>[];

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(linkData)
          .id((d) => d.id)
          .distance((d) => {
            const w = (d as unknown as { weight: number }).weight || 1;
            return 120 / Math.sqrt(w);
          })
          .strength((d) => {
            const w = (d as unknown as { weight: number }).weight || 1;
            return Math.min(0.8, w * 0.15);
          })
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d) => (d.radius ?? MIN_NODE_RADIUS) + 10)
      )
      .force(
        'userSkillCenter',
        d3.forceRadial<GraphNode>(
          (d) => (d.isUserSkill ? 0 : width * 0.3),
          width / 2,
          height / 2
        ).strength((d) => (d.isUserSkill ? 0.05 : 0.01))
      );

    simulationRef.current = simulation;

    // Draw edges
    const link = g
      .append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', COLORS.edgeStroke)
      .attr('stroke-width', (d) => {
        const w = (d as unknown as { weight: number }).weight || 1;
        return Math.max(1, Math.min(4, w));
      })
      .attr('stroke-opacity', 0.4);

    // Draw node groups
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .style('opacity', 0)
      .on('click', (_event, d) => {
        onKeywordClick(d.keyword);
      });

    // Pill background (rounded rect)
    nodeGroup
      .append('rect')
      .attr('rx', PILL_HEIGHT / 2)
      .attr('ry', PILL_HEIGHT / 2)
      .attr('height', PILL_HEIGHT)
      .attr('width', (d) => measureTextWidth(d.keyword, 13) + (d.trending ? 24 : 0))
      .attr('x', (d) => -(measureTextWidth(d.keyword, 13) + (d.trending ? 24 : 0)) / 2)
      .attr('y', -PILL_HEIGHT / 2)
      .attr('fill', (d) => (d.isUserSkill ? COLORS.userSkillFill : COLORS.nodeFill))
      .attr('stroke', (d) => (d.isUserSkill ? COLORS.userSkillStroke : COLORS.nodeStroke))
      .attr('stroke-width', (d) => (d.isUserSkill ? 2 : 1))
      .attr('filter', (d) => (d.isUserSkill ? 'url(#glow)' : 'none'));

    // Keyword text
    nodeGroup
      .append('text')
      .text((d) => d.keyword)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', COLORS.nodeText)
      .attr('font-size', 13)
      .attr('font-weight', 500)
      .attr('dx', (d) => (d.trending ? -8 : 0));

    // Job count badge
    nodeGroup
      .append('text')
      .text((d) => `${d.jobCount}`)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'central')
      .attr('fill', COLORS.countText)
      .attr('font-size', 10)
      .attr('dx', (d) => measureTextWidth(d.keyword, 13) / 2 - PILL_PADDING_X + 4 + (d.trending ? -8 : 0))
      .attr('dy', 0);

    // Trending fire indicator
    nodeGroup
      .filter((d) => d.trending)
      .append('text')
      .text('🔥')
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 12)
      .attr('dx', (d) => (measureTextWidth(d.keyword, 13) + 24) / 2 - 6);

    // Fade in nodes after simulation settles a bit
    nodeGroup
      .transition()
      .delay((_d, i) => 200 + i * 30)
      .duration(400)
      .style('opacity', 1);

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    // Tick function
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Initial alpha for settlement animation
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, processedNodes, onKeywordClick]);

  // Handle search: zoom to keyword node
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !searchKeyword || !simulationRef.current) return;

    const nodes = simulationRef.current.nodes();
    const target = nodes.find(
      (n) => n.keyword.toLowerCase() === searchKeyword.toLowerCase()
    );

    if (!target || target.x === undefined || target.y === undefined) return;

    const svgSelection = d3.select(svg);
    const zoom = d3.zoom<SVGSVGElement, unknown>();

    svgSelection
      .transition()
      .duration(750)
      .call(
        zoom.transform as unknown as (
          transition: d3.Transition<SVGSVGElement, unknown, null, undefined>,
          transform: d3.ZoomTransform
        ) => void,
        d3.zoomIdentity
          .translate(dimensions.width / 2, dimensions.height / 2)
          .scale(2)
          .translate(-target.x, -target.y)
      );

    // Highlight the target node
    d3.select(svg)
      .selectAll<SVGGElement, GraphNode>('g.nodes g')
      .select('rect')
      .transition()
      .duration(300)
      .attr('stroke', (d) =>
        d.keyword.toLowerCase() === searchKeyword.toLowerCase()
          ? COLORS.searchHighlight
          : d.isUserSkill
            ? COLORS.userSkillStroke
            : COLORS.nodeStroke
      )
      .attr('stroke-width', (d) =>
        d.keyword.toLowerCase() === searchKeyword.toLowerCase() ? 3 : d.isUserSkill ? 2 : 1
      );
  }, [searchKeyword, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(fair): add D3.js keyword graph force simulation component"
```

---

### Task 4: Cluster View, Company Card, and Job Detail Sheet

**Files:**
- Create: `src/components/fair/cluster-view.tsx`
- Create: `src/components/fair/company-card.tsx`
- Create: `src/components/fair/job-detail-sheet.tsx`
- Create: `src/components/fair/graph-search.tsx`

- [ ] **Step 1: Create company card component**

Create `src/components/fair/company-card.tsx`:

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClusterJob } from '@/types/graph';

interface CompanyCardProps {
  job: ClusterJob;
  onClick: (jobId: string) => void;
}

export default function CompanyCard({ job, onClick }: CompanyCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-indigo-500/50 transition-colors duration-200"
      onClick={() => onClick(job.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {job.companyName}
            </p>
            <p className="text-sm text-muted-foreground truncate">{job.title}</p>
          </div>
          {job.matchScore !== null && (
            <Badge
              variant={job.matchScore >= 80 ? 'default' : 'secondary'}
              className={
                job.matchScore >= 80
                  ? 'bg-green-600/20 text-green-400 border-green-600/30'
                  : job.matchScore >= 60
                    ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                    : ''
              }
            >
              {job.matchScore}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{job.workMode}</span>
          <span>·</span>
          <span>{job.location}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {job.skills.slice(0, 4).map((skill) => (
            <Badge
              key={skill.name}
              variant="outline"
              className={`text-xs ${skill.required ? 'border-indigo-500/50 text-indigo-300' : ''}`}
            >
              {skill.required && <span className="mr-0.5">✱</span>}
              {skill.name}
            </Badge>
          ))}
          {job.skills.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{job.skills.length - 4}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create cluster view component**

Create `src/components/fair/cluster-view.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CompanyCard from './company-card';
import type { ClusterJob } from '@/types/graph';

interface ClusterViewProps {
  keyword: string;
  onBack: () => void;
  onJobClick: (jobId: string) => void;
}

export default function ClusterView({
  keyword,
  onBack,
  onJobClick,
}: ClusterViewProps) {
  const [jobs, setJobs] = useState<ClusterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchJobs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/graph/${encodeURIComponent(keyword)}/jobs`
        );
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        if (!cancelled) {
          setJobs(data.jobs ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 overflow-auto"
    >
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to graph
          </Button>
          <h2 className="text-xl font-semibold text-foreground">
            Jobs matching{' '}
            <span className="text-indigo-400">&ldquo;{keyword}&rdquo;</span>
          </h2>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              Back to graph
            </Button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No open positions found for this keyword.</p>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
              >
                <CompanyCard job={job} onClick={onJobClick} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create job detail sheet component**

Create `src/components/fair/job-detail-sheet.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { JobDetail } from '@/types/graph';

interface JobDetailSheetProps {
  jobId: string | null;
  keyword: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JobDetailSheet({
  jobId,
  keyword,
  open,
  onOpenChange,
}: JobDetailSheetProps) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId || !open) return;
    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/graph/${encodeURIComponent(keyword)}/jobs?jobId=${jobId}`
        );
        if (!res.ok) throw new Error('Failed to fetch job detail');
        const data = await res.json();
        if (!cancelled) setDetail(data);
      } catch (err) {
        console.error('Failed to load job detail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [jobId, keyword, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        {loading && (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && detail && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{detail.title}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {detail.companyName}
              </p>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Match Score */}
              {detail.matchScore !== null && (
                <div className="flex items-center gap-4">
                  <div
                    className={`text-3xl font-bold ${
                      detail.matchScore >= 80
                        ? 'text-green-400'
                        : detail.matchScore >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {detail.matchScore}%
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Match Score
                  </span>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {detail.seniority && (
                  <div>
                    <span className="text-muted-foreground">Seniority</span>
                    <p className="font-medium">{detail.seniority}</p>
                  </div>
                )}
                {detail.workMode && (
                  <div>
                    <span className="text-muted-foreground">Work Mode</span>
                    <p className="font-medium">{detail.workMode}</p>
                  </div>
                )}
                {detail.budgetRange && (
                  <div>
                    <span className="text-muted-foreground">Budget</span>
                    <p className="font-medium">{detail.budgetRange}</p>
                  </div>
                )}
                {detail.timeline && (
                  <div>
                    <span className="text-muted-foreground">Timeline</span>
                    <p className="font-medium">{detail.timeline}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Skills */}
              <div>
                <h3 className="text-sm font-medium mb-2">Required Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.skills.map((skill) => (
                    <Badge
                      key={skill.name}
                      variant="outline"
                      className={
                        skill.required
                          ? 'border-indigo-500/50 text-indigo-300'
                          : ''
                      }
                    >
                      {skill.required && <span className="mr-0.5">✱</span>}
                      {skill.name}
                      <span className="ml-1 text-xs opacity-60">
                        {skill.level}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <h3 className="text-sm font-medium mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detail.description}
                </p>
              </div>

              {detail.deliverables && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium mb-2">Deliverables</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {detail.deliverables}
                    </p>
                  </div>
                </>
              )}

              {/* AI Reasoning */}
              {detail.aiReasoning && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      AI Match Analysis
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {detail.aiReasoning}
                    </p>
                  </div>
                </>
              )}

              {/* Match Breakdown */}
              {detail.matchBreakdown && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Score Breakdown
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(detail.matchBreakdown).map(
                        ([dimension, score]) => (
                          <div
                            key={dimension}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground capitalize">
                              {dimension.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    score >= 80
                                      ? 'bg-green-500'
                                      : score >= 60
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                              <span className="w-8 text-right font-medium">
                                {score}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button className="flex-1">Apply</Button>
                <Button variant="outline" className="flex-1">
                  Save
                </Button>
                <Button variant="secondary" className="flex-1">
                  Ask AI to Pre-chat
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Create graph search component**

Create `src/components/fair/graph-search.tsx`:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { GraphNode } from '@/types/graph';

interface GraphSearchProps {
  nodes: GraphNode[];
  onSearch: (keyword: string | null) => void;
}

export default function GraphSearch({ nodes, onSearch }: GraphSearchProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes
      .filter((n) => n.keyword.toLowerCase().includes(q))
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 8);
  }, [query, nodes]);

  function handleSelect(keyword: string) {
    setQuery(keyword);
    setShowSuggestions(false);
    onSearch(keyword);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0]!.keyword);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      onSearch(null);
      setQuery('');
    }
  }

  return (
    <div className="relative w-64">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            if (!e.target.value.trim()) onSearch(null);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search keywords..."
          className="pl-9"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-30 overflow-hidden">
          {suggestions.map((node) => (
            <button
              key={node.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
              onMouseDown={() => handleSelect(node.keyword)}
            >
              <span>{node.keyword}</span>
              <span className="text-xs text-muted-foreground">
                {node.jobCount} jobs
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(fair): add cluster view, company card, job detail sheet, and search components"
```

---

### Task 5: Opportunity Fair Page

**Files:**
- Modify: `src/app/(talent)/fair/page.tsx`

- [ ] **Step 1: Create the Opportunity Fair page**

Replace `src/app/(talent)/fair/page.tsx`:

```typescript
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import FairClient from './fair-client';

export default async function FairPage() {
  const user = await getCurrentUser();

  let userSkills: string[] = [];
  if (user) {
    const [profile] = await db
      .select({ skills: talentProfiles.skills })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);

    if (profile?.skills) {
      const skills = profile.skills as Array<{ name: string }>;
      userSkills = skills.map((s) => s.name);
    }
  }

  return <FairClient userSkills={userSkills} />;
}
```

- [ ] **Step 2: Create the Fair client component**

Create `src/app/(talent)/fair/fair-client.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import KeywordGraph from '@/components/fair/keyword-graph';
import ClusterView from '@/components/fair/cluster-view';
import JobDetailSheet from '@/components/fair/job-detail-sheet';
import GraphSearch from '@/components/fair/graph-search';
import type { GraphData } from '@/types/graph';

interface FairClientProps {
  userSkills: string[];
}

export default function FairClient({ userSkills }: FairClientProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch('/api/v1/graph');
        if (!res.ok) throw new Error('Failed to fetch graph');
        const data: GraphData = await res.json();
        setGraphData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchGraph();
  }, []);

  const handleKeywordClick = useCallback((keyword: string) => {
    setActiveKeyword(keyword);
  }, []);

  const handleBack = useCallback(() => {
    setActiveKeyword(null);
  }, []);

  const handleJobClick = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      setSheetOpen(true);
    },
    []
  );

  const handleSearch = useCallback((keyword: string | null) => {
    setSearchKeyword(keyword);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="w-64 h-64 rounded-full mx-auto" />
          <p className="text-muted-foreground text-sm animate-pulse">
            Rendering opportunity graph...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            No opportunity data available yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Your AI is scanning the market...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Opportunity Fair</h1>
        <GraphSearch nodes={graphData.nodes} onSearch={handleSearch} />
      </div>

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden">
        <KeywordGraph
          data={graphData}
          userSkills={userSkills}
          onKeywordClick={handleKeywordClick}
          searchKeyword={searchKeyword}
        />

        <AnimatePresence>
          {activeKeyword && (
            <ClusterView
              keyword={activeKeyword}
              onBack={handleBack}
              onJobClick={handleJobClick}
            />
          )}
        </AnimatePresence>

        <JobDetailSheet
          jobId={selectedJobId}
          keyword={activeKeyword ?? ''}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify dev server renders the page**

```bash
npm run dev
```

Navigate to `/talent/fair`. Expected: the page renders without errors. With no graph data seeded, the empty state message should appear.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(fair): add Opportunity Fair page with graph, cluster view, and job detail"
```

---

### Task 6: Background Job — update-graph Worker

**Files:**
- Create: `src/lib/jobs/workers/update-graph.ts`
- Modify: `src/lib/jobs/worker.ts` (register the handler)

- [x] **Step 1: Create the update-graph worker**

Create `src/lib/jobs/workers/update-graph.ts`:

```typescript
import { db } from '@/lib/db';
import { jobs, keywordNodes, keywordEdges } from '@/lib/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

interface SkillEntry {
  name: string;
  level?: string;
  required?: boolean;
}

export async function updateGraphWorker() {
  console.log('[update-graph] Starting graph recomputation...');

  // 1. Extract all skills from open jobs
  const openJobs = await db
    .select({
      id: jobs.id,
      structured: jobs.structured,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.status, 'open'));

  // Build keyword counts and co-occurrence
  const keywordCounts = new Map<string, number>();
  const coOccurrence = new Map<string, number>();
  const recentKeywordCounts = new Map<string, number>();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const job of openJobs) {
    const structured = (job.structured as Record<string, unknown>) || {};
    const skills = (structured.skills as SkillEntry[]) || [];
    const skillNames = [...new Set(skills.map((s) => s.name))];

    // Count keywords
    for (const name of skillNames) {
      keywordCounts.set(name, (keywordCounts.get(name) || 0) + 1);

      // Track recent counts for trending
      if (job.createdAt && new Date(job.createdAt) >= sevenDaysAgo) {
        recentKeywordCounts.set(name, (recentKeywordCounts.get(name) || 0) + 1);
      }
    }

    // Count co-occurrences (pairs within same job)
    for (let i = 0; i < skillNames.length; i++) {
      for (let j = i + 1; j < skillNames.length; j++) {
        const key = [skillNames[i], skillNames[j]].sort().join('|||');
        coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
      }
    }
  }

  console.log(
    `[update-graph] Found ${keywordCounts.size} unique keywords from ${openJobs.length} jobs`
  );

  // 2. Cap at 80 keywords by job count
  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80);

  const topKeywordSet = new Set(topKeywords.map(([name]) => name));

  // 3. Compute trending: >30% of total count came from last 7 days
  const trendingSet = new Set<string>();
  for (const [name, totalCount] of topKeywords) {
    const recentCount = recentKeywordCounts.get(name) || 0;
    if (totalCount > 0 && recentCount / totalCount > 0.3) {
      trendingSet.add(name);
    }
  }

  // 4. Upsert keyword_nodes
  // Delete nodes not in top keywords
  await db.execute(sql`
    DELETE FROM keyword_nodes
    WHERE keyword NOT IN (${sql.join(
      topKeywords.map(([name]) => sql`${name}`),
      sql`, `
    )})
  `);

  // Upsert each keyword node
  for (const [name, count] of topKeywords) {
    await db.execute(sql`
      INSERT INTO keyword_nodes (keyword, job_count, trending)
      VALUES (${name}, ${count}, ${trendingSet.has(name)})
      ON CONFLICT (keyword)
      DO UPDATE SET
        job_count = EXCLUDED.job_count,
        trending = EXCLUDED.trending
    `);
  }

  // 5. Get node IDs for edge creation
  const nodeRows = await db
    .select({ id: keywordNodes.id, keyword: keywordNodes.keyword })
    .from(keywordNodes);

  const nodeIdMap = new Map(nodeRows.map((n) => [n.keyword, n.id]));

  // 6. Rebuild edges
  await db.execute(sql`DELETE FROM keyword_edges`);

  const edgesToInsert: { sourceId: string; targetId: string; weight: number }[] = [];

  for (const [key, weight] of coOccurrence.entries()) {
    const [a, b] = key.split('|||') as [string, string];
    if (!topKeywordSet.has(a) || !topKeywordSet.has(b)) continue;

    const sourceId = nodeIdMap.get(a);
    const targetId = nodeIdMap.get(b);
    if (!sourceId || !targetId) continue;

    // Only keep edges with weight >= 2 (co-occur in at least 2 jobs)
    if (weight >= 2) {
      edgesToInsert.push({ sourceId, targetId, weight });
    }
  }

  // Batch insert edges
  if (edgesToInsert.length > 0) {
    const values = edgesToInsert
      .map((e) => sql`(${e.sourceId}, ${e.targetId}, ${e.weight})`)
    await db.execute(sql`
      INSERT INTO keyword_edges (source_id, target_id, weight)
      VALUES ${sql.join(values, sql`, `)}
    `);
  }

  console.log(
    `[update-graph] Updated ${topKeywords.length} nodes and ${edgesToInsert.length} edges`
  );

  return {
    nodesUpdated: topKeywords.length,
    edgesUpdated: edgesToInsert.length,
    trendingCount: trendingSet.size,
  };
}
```

- [x] **Step 2: Register the worker in the main worker entry point**

In `src/lib/jobs/worker.ts`, add the `update-graph` handler to the existing worker switch/map. Add the following import and case:

```typescript
import { updateGraphWorker } from './workers/update-graph';

// Inside the worker handler (wherever job types are dispatched):
// Add to the existing job type handler map:
case 'update-graph':
  return updateGraphWorker();
```

The exact insertion point depends on how the foundation plan structured the worker dispatcher. The pattern is:

```typescript
// In the Worker callback:
const worker = new Worker('csv-jobs', async (job) => {
  switch (job.name) {
    // ... existing cases ...
    case 'update-graph':
      return updateGraphWorker();
  }
}, { connection: redisConnection });
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(fair): add update-graph background job worker"
```

---

### Task 7: AI Coach System Prompt Builder

**Files:**
- Create: `src/lib/ai/prompts/coach.ts`
- Create: `__tests__/lib/ai/prompts/coach.test.ts`

- [x] **Step 1: Create the coach prompt builder**

Create `src/lib/ai/prompts/coach.ts`:

```typescript
import { baseSystemPrompt } from './_base';
import type { CoachMode } from '@/types/graph';

interface CoachContext {
  profileJson: string;
  goals: string;
  recentMatchesSummary: string;
}

const MODE_INSTRUCTIONS: Record<CoachMode, string> = {
  chat: '',
  'resume-review': `
Focus on reviewing and improving the user's profile descriptions.
Suggest impact-focused rewording for each experience entry.
When suggesting changes, present them in a clear before/after format:
- BEFORE: [original text]
- AFTER: [improved text]
Explain why each change is better. Use action verbs and quantify impact where possible.
You can use the updateProfileField tool to apply changes the user approves.`,

  'mock-interview': `
Conduct a mock interview for the user's target role.
Play the role of a senior interviewer at a top AI company.
Follow this structure:
1. Start with a warm-up question about their background
2. Move to technical questions relevant to their skills
3. Include a behavioral question
4. End with a "why this role" question
After each answer the user provides, give specific feedback:
- What was strong about their answer
- What could be improved
- A sample stronger answer when appropriate
Keep the interview realistic and challenging but supportive.`,

  'skill-gaps': `
Analyze gaps between the user's current skills and their target roles.
For each gap, provide:
- Skill name and current vs required level
- Why this skill matters for their target roles
- Concrete learning resources (courses, projects, open-source contributions)
- Estimated time to reach competency
- Priority level (Critical / Important / Nice-to-have)
Use the suggestSkill tool to formally suggest skills the user should develop.
Present gaps in priority order — most impactful first.`,
};

export function buildCoachSystemPrompt(
  mode: CoachMode,
  context: CoachContext
): string {
  const base = baseSystemPrompt();

  const coachBase = `
You are a career coach on Cyber Silicon Valley (CSV), an AI-native talent matching platform.
You know this user's full profile:
${context.profileJson}

Their target roles and goals:
${context.goals}

Their recent match landscape:
${context.recentMatchesSummary}

Help them become more competitive in the AI talent market.
Be specific, actionable, and encouraging. Draw on their actual profile data and match results.
When you have concrete suggestions for profile improvements, use the updateProfileField tool.
When you identify skills they should develop, use the suggestSkill tool.`;

  const modeInstruction = MODE_INSTRUCTIONS[mode];

  return [base, coachBase, modeInstruction].filter(Boolean).join('\n\n');
}

export const COACH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'updateProfileField',
      description:
        'Update a field on the user\'s talent profile. Use this when the user agrees to a profile improvement you suggested.',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description:
              'The profile field to update. One of: headline, bio, skills, experience, education, goals, availability',
          },
          value: {
            description:
              'The new value for the field. For skills: array of {name, level, category}. For experience: array of {role, company, startDate, endDate, description}. For simple fields: string.',
          },
        },
        required: ['field', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggestSkill',
      description:
        'Suggest a skill the user should develop, with explanation of why and how.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The skill name to suggest',
          },
          reason: {
            type: 'string',
            description:
              'Why this skill matters for the user\'s career goals and how to develop it',
          },
        },
        required: ['name', 'reason'],
      },
    },
  },
];
```

- [x] **Step 2: Create coach prompt tests**

Create `__tests__/lib/ai/prompts/coach.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildCoachSystemPrompt, COACH_TOOLS } from '@/lib/ai/prompts/coach';

// Mock the base prompt
vi.mock('@/lib/ai/prompts/_base', () => ({
  baseSystemPrompt: () => 'You are an AI assistant on CSV.',
}));

const mockContext = {
  profileJson: JSON.stringify({
    displayName: 'Zhang Wei',
    headline: 'ML Engineer',
    skills: [{ name: 'Python', level: 'expert' }],
  }),
  goals: 'Senior ML Engineer at a top AI company',
  recentMatchesSummary: '5 high matches (>80%), 12 medium matches (60-80%)',
};

describe('buildCoachSystemPrompt', () => {
  it('should include base prompt and profile context for chat mode', () => {
    const prompt = buildCoachSystemPrompt('chat', mockContext);
    expect(prompt).toContain('You are an AI assistant on CSV.');
    expect(prompt).toContain('Zhang Wei');
    expect(prompt).toContain('career coach');
    expect(prompt).toContain('Senior ML Engineer');
  });

  it('should include resume review instructions for resume-review mode', () => {
    const prompt = buildCoachSystemPrompt('resume-review', mockContext);
    expect(prompt).toContain('BEFORE');
    expect(prompt).toContain('AFTER');
    expect(prompt).toContain('impact-focused');
  });

  it('should include mock interview instructions for mock-interview mode', () => {
    const prompt = buildCoachSystemPrompt('mock-interview', mockContext);
    expect(prompt).toContain('mock interview');
    expect(prompt).toContain('interviewer');
    expect(prompt).toContain('feedback');
  });

  it('should include skill gaps analysis instructions for skill-gaps mode', () => {
    const prompt = buildCoachSystemPrompt('skill-gaps', mockContext);
    expect(prompt).toContain('gaps');
    expect(prompt).toContain('suggestSkill');
    expect(prompt).toContain('learning resources');
  });

  it('should include match landscape summary', () => {
    const prompt = buildCoachSystemPrompt('chat', mockContext);
    expect(prompt).toContain('5 high matches');
  });
});

describe('COACH_TOOLS', () => {
  it('should define updateProfileField tool', () => {
    const tool = COACH_TOOLS.find((t) => t.function.name === 'updateProfileField');
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.properties).toHaveProperty('field');
    expect(tool!.function.parameters.properties).toHaveProperty('value');
  });

  it('should define suggestSkill tool', () => {
    const tool = COACH_TOOLS.find((t) => t.function.name === 'suggestSkill');
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.properties).toHaveProperty('name');
    expect(tool!.function.parameters.properties).toHaveProperty('reason');
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -- __tests__/lib/ai/prompts/coach.test.ts
git add -A
git commit -m "feat(coach): add coach system prompt builder with four modes and tool definitions"
```

---

### Task 8: AI Coach API Endpoint

**Files:**
- Create: `src/app/api/internal/ai/coach/route.ts`

- [x] **Step 1: Create the coach streaming endpoint**

Create `src/app/api/internal/ai/coach/route.ts`:

```typescript
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getProvider } from '@/lib/ai/providers';
import { buildCoachSystemPrompt, COACH_TOOLS } from '@/lib/ai/prompts/coach';
import { loadChatHistory, saveMessage, createOrGetSession } from '@/lib/ai/chat';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { talentProfiles, matches, jobs } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import type { CoachMode } from '@/types/graph';

const VALID_MODES: CoachMode[] = ['chat', 'resume-review', 'mock-interview', 'skill-gaps'];

export async function POST(request: NextRequest) {
  try {
    // Auth
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'talent') {
      return new Response('Forbidden', { status: 403 });
    }

    const userId = payload.userId as string;
    const body = await request.json();
    const { message, mode = 'chat' } = body as { message: string; mode?: CoachMode };

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 });
    }

    if (!VALID_MODES.includes(mode)) {
      return new Response('Invalid mode', { status: 400 });
    }

    // Load user profile
    const [profile] = await db
      .select()
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      return new Response('Profile not found', { status: 404 });
    }

    // Load recent match landscape
    const recentMatches = await db
      .select({
        score: matches.score,
        jobTitle: jobs.title,
        breakdown: matches.breakdown,
      })
      .from(matches)
      .innerJoin(jobs, eq(matches.jobId, jobs.id))
      .where(eq(matches.talentId, profile.id))
      .orderBy(desc(matches.score))
      .limit(20);

    const highMatches = recentMatches.filter((m) => (m.score ?? 0) >= 80);
    const mediumMatches = recentMatches.filter(
      (m) => (m.score ?? 0) >= 60 && (m.score ?? 0) < 80
    );

    const matchSummary = `${highMatches.length} high matches (>80%), ${mediumMatches.length} medium matches (60-80%). Top matches: ${highMatches
      .slice(0, 5)
      .map((m) => `${m.jobTitle} (${m.score}%)`)
      .join(', ')}`;

    // Build system prompt
    const systemPrompt = buildCoachSystemPrompt(mode, {
      profileJson: JSON.stringify({
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        skills: profile.skills,
        experience: profile.experience,
        education: profile.education,
        goals: profile.goals,
        availability: profile.availability,
      }),
      goals: JSON.stringify(profile.goals || {}),
      recentMatchesSummary: matchSummary,
    });

    // Get or create chat session
    const session = await createOrGetSession(userId, `coach-${mode}`);

    // Save user message
    await saveMessage(session.id, 'user', message);

    // Load history
    const history = await loadChatHistory(session.id);

    // Stream response
    const provider = getProvider();
    const result = streamText({
      model: provider,
      system: systemPrompt,
      messages: history,
      tools: {
        updateProfileField: {
          description: COACH_TOOLS[0]!.function.description,
          parameters: COACH_TOOLS[0]!.function.parameters as never,
          execute: async ({ field, value }: { field: string; value: unknown }) => {
            // Update the profile field
            const updateData: Record<string, unknown> = {};
            const allowedFields = [
              'headline', 'bio', 'skills', 'experience',
              'education', 'goals', 'availability',
            ];

            if (!allowedFields.includes(field)) {
              return { success: false, error: `Field "${field}" is not updatable` };
            }

            if (field === 'headline') updateData.headline = value;
            else if (field === 'bio') updateData.bio = value;
            else if (field === 'skills') updateData.skills = value;
            else if (field === 'experience') updateData.experience = value;
            else if (field === 'education') updateData.education = value;
            else if (field === 'goals') updateData.goals = value;
            else if (field === 'availability') updateData.availability = value;

            await db
              .update(talentProfiles)
              .set(updateData)
              .where(eq(talentProfiles.userId, userId));

            return {
              success: true,
              field,
              message: `Updated ${field} successfully`,
            };
          },
        },
        suggestSkill: {
          description: COACH_TOOLS[1]!.function.description,
          parameters: COACH_TOOLS[1]!.function.parameters as never,
          execute: async ({ name, reason }: { name: string; reason: string }) => {
            // Return the suggestion for display — doesn't auto-add to profile
            return {
              success: true,
              suggestion: { name, reason },
              message: `Suggested skill: ${name}`,
            };
          },
        },
      },
      onFinish: async ({ text }) => {
        if (text) {
          await saveMessage(session.id, 'assistant', text);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Coach API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(coach): add AI coach streaming API endpoint with tool execution"
```

---

### Task 9: AI Coach UI Components

**Files:**
- Create: `src/components/coach/coach-mode-tabs.tsx`
- Create: `src/components/coach/gap-analysis-card.tsx`
- Create: `src/components/coach/before-after-card.tsx`
- Create: `src/components/coach/coach-chat.tsx`

- [x] **Step 1: Create coach mode tabs**

Create `src/components/coach/coach-mode-tabs.tsx`:

```typescript
'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, FileText, Mic, Target } from 'lucide-react';
import type { CoachMode } from '@/types/graph';

interface CoachModeTabsProps {
  mode: CoachMode;
  onModeChange: (mode: CoachMode) => void;
}

const MODES: { value: CoachMode; label: string; icon: React.ReactNode }[] = [
  { value: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'resume-review', label: 'Resume Review', icon: <FileText className="w-4 h-4" /> },
  { value: 'mock-interview', label: 'Mock Interview', icon: <Mic className="w-4 h-4" /> },
  { value: 'skill-gaps', label: 'Skill Gaps', icon: <Target className="w-4 h-4" /> },
];

export default function CoachModeTabs({ mode, onModeChange }: CoachModeTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as CoachMode)}>
      <TabsList className="grid grid-cols-4 w-full max-w-lg">
        {MODES.map((m) => (
          <TabsTrigger
            key={m.value}
            value={m.value}
            className="flex items-center gap-1.5 text-sm"
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

- [x] **Step 2: Create gap analysis card**

Create `src/components/coach/gap-analysis-card.tsx`:

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GapAnalysisCardProps {
  skillName: string;
  reason: string;
  priority?: 'Critical' | 'Important' | 'Nice-to-have';
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-600/20 text-red-400 border-red-600/30',
  Important: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  'Nice-to-have': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
};

export default function GapAnalysisCard({
  skillName,
  reason,
  priority = 'Important',
}: GapAnalysisCardProps) {
  return (
    <Card className="border-l-2 border-l-indigo-500/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{skillName}</span>
          <Badge variant="outline" className={PRIORITY_COLORS[priority] ?? ''}>
            {priority}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  );
}
```

- [x] **Step 3: Create before/after card**

Create `src/components/coach/before-after-card.tsx`:

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ArrowDown } from 'lucide-react';

interface BeforeAfterCardProps {
  before: string;
  after: string;
  field: string;
}

export default function BeforeAfterCard({
  before,
  after,
  field,
}: BeforeAfterCardProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field}
        </p>
        <div className="rounded-md bg-red-950/20 border border-red-900/30 p-3">
          <p className="text-xs text-red-400 mb-1 font-medium">BEFORE</p>
          <p className="text-sm text-muted-foreground">{before}</p>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="rounded-md bg-green-950/20 border border-green-900/30 p-3">
          <p className="text-xs text-green-400 mb-1 font-medium">AFTER</p>
          <p className="text-sm text-foreground">{after}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [x] **Step 4: Create the main coach chat component**

Create `src/components/coach/coach-chat.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from 'ai/react';
import { motion } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import CoachModeTabs from './coach-mode-tabs';
import GapAnalysisCard from './gap-analysis-card';
import BeforeAfterCard from './before-after-card';
import type { CoachMode } from '@/types/graph';

export default function CoachChat() {
  const [mode, setMode] = useState<CoachMode>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: '/api/internal/ai/coach',
    body: { mode },
    onFinish: () => {
      // Scroll to bottom on finish
      scrollToBottom();
    },
  });

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Reset messages when mode changes
  const handleModeChange = useCallback(
    (newMode: CoachMode) => {
      setMode(newMode);
      setMessages([]);
    },
    [setMessages]
  );

  // Parse structured elements from AI messages
  function renderMessageContent(content: string) {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    // Detect before/after patterns
    const beforeAfterRegex =
      /- BEFORE: (.+?)\n- AFTER: (.+?)(?:\n|$)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    const beforeAfterMatches: { index: number; length: number; before: string; after: string }[] = [];

    while ((match = beforeAfterRegex.exec(remaining)) !== null) {
      beforeAfterMatches.push({
        index: match.index,
        length: match[0].length,
        before: match[1]!,
        after: match[2]!,
      });
    }

    if (beforeAfterMatches.length > 0) {
      for (const m of beforeAfterMatches) {
        if (m.index > lastIndex) {
          parts.push(
            <span key={key++}>
              {remaining.slice(lastIndex, m.index)}
            </span>
          );
        }
        parts.push(
          <BeforeAfterCard
            key={key++}
            before={m.before}
            after={m.after}
            field="Suggested improvement"
          />
        );
        lastIndex = m.index + m.length;
      }
      if (lastIndex < remaining.length) {
        parts.push(
          <span key={key++}>{remaining.slice(lastIndex)}</span>
        );
      }
      return <div className="space-y-3">{parts}</div>;
    }

    // Default: render as text with newlines
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode tabs */}
      <div className="px-6 py-3 border-b border-border">
        <CoachModeTabs mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="py-4 space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">
                {mode === 'chat' && 'Chat with your AI career coach'}
                {mode === 'resume-review' &&
                  'Get feedback on your profile and resume'}
                {mode === 'mock-interview' &&
                  'Practice with a realistic mock interview'}
                {mode === 'skill-gaps' &&
                  'Discover skills to develop for your target roles'}
              </p>
              <p className="text-sm">
                Type a message below to get started.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/20 text-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  renderMessageContent(msg.content)
                )}

                {/* Render tool invocations */}
                {msg.toolInvocations?.map((tool) => {
                  if (tool.state !== 'result') return null;

                  if (tool.toolName === 'suggestSkill') {
                    const result = tool.result as {
                      suggestion: { name: string; reason: string };
                    };
                    return (
                      <div key={tool.toolCallId} className="mt-3">
                        <GapAnalysisCard
                          skillName={result.suggestion.name}
                          reason={result.suggestion.reason}
                        />
                      </div>
                    );
                  }

                  if (tool.toolName === 'updateProfileField') {
                    const result = tool.result as {
                      success: boolean;
                      field: string;
                      message: string;
                    };
                    return (
                      <div
                        key={tool.toolCallId}
                        className={`mt-3 text-xs px-3 py-2 rounded ${
                          result.success
                            ? 'bg-green-950/30 text-green-400 border border-green-900/30'
                            : 'bg-red-950/30 text-red-400 border border-red-900/30'
                        }`}
                      >
                        {result.message}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder={
              mode === 'chat'
                ? 'Ask your coach anything...'
                : mode === 'resume-review'
                  ? 'Paste text to review or ask for feedback...'
                  : mode === 'mock-interview'
                    ? 'Answer the interview question...'
                    : 'Ask about skills you should develop...'
            }
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(coach): add coach chat UI with mode tabs, gap analysis, and before/after cards"
```

---

### Task 10: AI Coach Page

**Files:**
- Modify: `src/app/(talent)/coach/page.tsx`

- [x] **Step 1: Create the coach page**

Replace `src/app/(talent)/coach/page.tsx`:

```typescript
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CoachChat from '@/components/coach/coach-chat';

export default async function CoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'talent') {
    redirect('/login');
  }

  return (
    <div className="h-full flex flex-col">
      <CoachChat />
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server renders both pages**

```bash
npm run dev
```

Navigate to `/talent/coach`. Expected: the page renders with mode tabs and empty chat state. Navigate to `/talent/fair`. Expected: the page renders with the empty state or graph (depending on seed data).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(coach): add AI Coach page"
```

---

### Task 11: i18n Strings

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [x] **Step 1: Add fair and coach strings to English locale**

In `src/i18n/messages/en.json`, add to the existing JSON (merge with current content):

```json
{
  "fair": {
    "title": "Opportunity Fair",
    "searchPlaceholder": "Search keywords...",
    "emptyState": "No opportunity data available yet.",
    "emptyStateHint": "Your AI is scanning the market...",
    "backToGraph": "Back to graph",
    "jobsMatching": "Jobs matching",
    "noJobs": "No open positions found for this keyword.",
    "rendering": "Rendering opportunity graph...",
    "apply": "Apply",
    "save": "Save",
    "askAI": "Ask AI to Pre-chat",
    "matchScore": "Match Score",
    "scoreBreakdown": "Score Breakdown",
    "aiAnalysis": "AI Match Analysis",
    "requiredSkills": "Required Skills",
    "description": "Description",
    "deliverables": "Deliverables",
    "seniority": "Seniority",
    "workMode": "Work Mode",
    "budget": "Budget",
    "timeline": "Timeline"
  },
  "coach": {
    "title": "AI Coach",
    "modeChat": "Chat",
    "modeResumeReview": "Resume Review",
    "modeMockInterview": "Mock Interview",
    "modeSkillGaps": "Skill Gaps",
    "placeholderChat": "Ask your coach anything...",
    "placeholderResume": "Paste text to review or ask for feedback...",
    "placeholderInterview": "Answer the interview question...",
    "placeholderSkills": "Ask about skills you should develop...",
    "emptyChat": "Chat with your AI career coach",
    "emptyResume": "Get feedback on your profile and resume",
    "emptyInterview": "Practice with a realistic mock interview",
    "emptySkills": "Discover skills to develop for your target roles",
    "startHint": "Type a message below to get started.",
    "suggestedImprovement": "Suggested improvement",
    "profileUpdated": "Profile updated"
  }
}
```

- [x] **Step 2: Add fair and coach strings to Chinese locale**

In `src/i18n/messages/zh.json`, add the corresponding Chinese translations:

```json
{
  "fair": {
    "title": "机会集市",
    "searchPlaceholder": "搜索关键词...",
    "emptyState": "暂无机会数据。",
    "emptyStateHint": "你的 AI 正在扫描市场...",
    "backToGraph": "返回图谱",
    "jobsMatching": "匹配的职位",
    "noJobs": "该关键词暂无开放职位。",
    "rendering": "正在渲染机会图谱...",
    "apply": "申请",
    "save": "收藏",
    "askAI": "让 AI 预聊",
    "matchScore": "匹配分数",
    "scoreBreakdown": "分数明细",
    "aiAnalysis": "AI 匹配分析",
    "requiredSkills": "所需技能",
    "description": "职位描述",
    "deliverables": "交付物",
    "seniority": "资历",
    "workMode": "工作模式",
    "budget": "预算",
    "timeline": "时间线"
  },
  "coach": {
    "title": "AI 教练",
    "modeChat": "对话",
    "modeResumeReview": "简历优化",
    "modeMockInterview": "模拟面试",
    "modeSkillGaps": "技能差距",
    "placeholderChat": "问你的教练任何问题...",
    "placeholderResume": "粘贴要审查的文本或询问反馈...",
    "placeholderInterview": "回答面试问题...",
    "placeholderSkills": "询问你应该发展的技能...",
    "emptyChat": "与你的 AI 职业教练聊天",
    "emptyResume": "获取个人资料和简历的反馈",
    "emptyInterview": "用真实的模拟面试练习",
    "emptySkills": "发现目标职位需要的技能",
    "startHint": "在下方输入消息开始。",
    "suggestedImprovement": "建议改进",
    "profileUpdated": "个人资料已更新"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(i18n): add fair and coach locale strings for en and zh-CN"
```

---

### Task 12: Type-Check, Lint, and Final Verification

**Files:** None (verification only)

- [x] **Step 1: Run type checker**

```bash
npm run typecheck
```

Fix any type errors that arise. Common issues to watch for:
- Drizzle schema column names vs the inferred types
- D3 type generics for simulation nodes and links
- Vercel AI SDK `useChat` and `streamText` type parameters

- [x] **Step 2: Run linter**

```bash
npm run lint
```

Fix any linting issues.

- [x] **Step 3: Run tests**

```bash
npm run test
```

Ensure all tests pass, including the new ones from Tasks 1 and 7.

- [x] **Step 4: Run full check**

```bash
npm run check
```

Expected: all lint, typecheck, and test passes cleanly.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type and lint issues in Spec 6 implementation"
```
