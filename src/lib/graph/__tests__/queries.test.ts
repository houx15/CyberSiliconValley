import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const chain = {} as MockChain;
chain.from = vi.fn().mockReturnValue(chain);
chain.where = vi.fn().mockReturnValue(chain);
chain.orderBy = vi.fn();
chain.limit = vi.fn();

const db = {
  select: vi.fn().mockReturnValue(chain),
};

vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/db/schema', () => ({
  keywordNodes: {
    id: 'keyword_nodes.id',
    keyword: 'keyword_nodes.keyword',
    jobCount: 'keyword_nodes.job_count',
    trending: 'keyword_nodes.trending',
  },
  keywordEdges: {
    id: 'keyword_edges.id',
    sourceId: 'keyword_edges.source_id',
    targetId: 'keyword_edges.target_id',
    weight: 'keyword_edges.weight',
  },
  jobs: {
    id: 'jobs.id',
    title: 'jobs.title',
    description: 'jobs.description',
    structured: 'jobs.structured',
    status: 'jobs.status',
    enterpriseId: 'jobs.enterprise_id',
  },
  matches: {
    jobId: 'matches.job_id',
    talentId: 'matches.talent_id',
    score: 'matches.score',
    breakdown: 'matches.breakdown',
    aiReasoning: 'matches.ai_reasoning',
  },
  enterpriseProfiles: {
    id: 'enterprise_profiles.id',
    companyName: 'enterprise_profiles.company_name',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ kind: 'and', conditions })),
  eq: vi.fn((column, value) => ({ kind: 'eq', column, value })),
  inArray: vi.fn((column, values) => ({ kind: 'inArray', column, values })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    kind: 'sql',
    strings,
    values,
  })),
}));

describe('graph queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReturnValue(chain);
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReset();
    chain.limit.mockReset();
  });

  it('maps keyword nodes and edges into graph data', async () => {
    chain.orderBy
      .mockResolvedValueOnce([
        { id: 'node-1', keyword: 'RAG', jobCount: 5, trending: true },
        { id: 'node-2', keyword: 'Agents', jobCount: 2, trending: false },
      ])
      .mockResolvedValueOnce([
        { id: 'edge-1', sourceId: 'node-1', targetId: 'node-2', weight: 1.5 },
      ]);

    const { getGraphData } = await import('../queries');
    const result = await getGraphData();

    expect(result.nodes).toEqual([
      { id: 'node-1', keyword: 'RAG', jobCount: 5, trending: true },
      { id: 'node-2', keyword: 'Agents', jobCount: 2, trending: false },
    ]);
    expect(result.edges).toEqual([
      { id: 'edge-1', sourceId: 'node-1', targetId: 'node-2', weight: 1.5 },
    ]);
  });

  it('maps keyword jobs with company names and match scores', async () => {
    chain.limit
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          title: 'Senior RAG Engineer',
          description: 'Build retrieval systems',
          structured: {
            skills: [{ name: 'RAG', level: 'expert', required: true }],
            location: 'San Francisco',
            workMode: 'hybrid',
          },
          enterpriseId: 'enterprise-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'enterprise-1',
          companyName: 'Aperture AI',
        },
      ])
      .mockResolvedValueOnce([
        {
          jobId: 'job-1',
          score: 88,
        },
      ]);

    const { getJobsForKeyword } = await import('../queries');
    const result = await getJobsForKeyword('RAG', 'talent-1');

    expect(result).toEqual([
      {
        id: 'job-1',
        title: 'Senior RAG Engineer',
        companyName: 'Aperture AI',
        location: 'San Francisco',
        workMode: 'hybrid',
        matchScore: 88,
        skills: [{ name: 'RAG', level: 'expert', required: true }],
      },
    ]);
  });

  it('returns job detail with match breakdown for the requesting talent', async () => {
    chain.limit
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          title: 'AI Platform Lead',
          description: 'Own the agent platform roadmap.',
          structured: {
            skills: [{ name: 'LangGraph', level: 'advanced', required: true }],
            location: 'Remote',
            workMode: 'remote',
            seniority: 'Senior',
            budgetRange: '$180k-$220k',
            timeline: 'Q2 2026',
            deliverables: 'Platform launch',
          },
          enterpriseId: 'enterprise-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          companyName: 'Northstar Labs',
        },
      ])
      .mockResolvedValueOnce([
        {
          score: 91,
          breakdown: { skills: 94, goals: 88 },
          aiReasoning: 'Strong graph orchestration background.',
        },
      ]);

    const { getJobDetail } = await import('../queries');
    const result = await getJobDetail('job-1', 'talent-1');

    expect(result).toEqual({
      id: 'job-1',
      title: 'AI Platform Lead',
      description: 'Own the agent platform roadmap.',
      companyName: 'Northstar Labs',
      location: 'Remote',
      workMode: 'remote',
      seniority: 'Senior',
      budgetRange: '$180k-$220k',
      timeline: 'Q2 2026',
      deliverables: 'Platform launch',
      matchScore: 91,
      matchBreakdown: { skills: 94, goals: 88 },
      aiReasoning: 'Strong graph orchestration background.',
      skills: [{ name: 'LangGraph', level: 'advanced', required: true }],
    });
  });
});
