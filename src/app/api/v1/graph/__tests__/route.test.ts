import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getGraphData = vi.fn();
const getJobsForKeyword = vi.fn();
const getJobDetail = vi.fn();
const verifyJWT = vi.fn();

type MockChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const chain = {} as MockChain;
chain.from = vi.fn().mockReturnValue(chain);
chain.where = vi.fn().mockReturnValue(chain);
chain.limit = vi.fn();

const db = {
  select: vi.fn().mockReturnValue(chain),
};

vi.mock('@/lib/graph/queries', () => ({
  getGraphData,
  getJobsForKeyword,
  getJobDetail,
}));
vi.mock('@/lib/auth', () => ({
  verifyJWT,
}));
vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/db/schema', () => ({
  talentProfiles: {
    id: 'talent_profiles.id',
    userId: 'talent_profiles.user_id',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ kind: 'eq', column, value })),
}));

describe('graph API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReturnValue(chain);
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReset();
  });

  it('returns graph data from the root graph endpoint', async () => {
    getGraphData.mockResolvedValueOnce({
      nodes: [{ id: 'node-1', keyword: 'RAG', jobCount: 5, trending: true }],
      edges: [{ id: 'edge-1', sourceId: 'node-1', targetId: 'node-2', weight: 1.4 }],
    });

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nodes: [{ id: 'node-1', keyword: 'RAG', jobCount: 5, trending: true }],
      edges: [{ id: 'edge-1', sourceId: 'node-1', targetId: 'node-2', weight: 1.4 }],
    });
  });

  it('returns keyword jobs and resolves the talent profile when authenticated', async () => {
    verifyJWT.mockResolvedValueOnce({ userId: 'user-1', role: 'talent' });
    chain.limit.mockResolvedValueOnce([{ id: 'talent-1' }]);
    getJobsForKeyword.mockResolvedValueOnce([
      { id: 'job-1', title: 'Senior RAG Engineer', companyName: 'Aperture AI' },
    ]);

    const { GET } = await import('../[keyword]/jobs/route');
    const request = new NextRequest('http://localhost/api/v1/graph/RAG/jobs', {
      headers: {
        cookie: 'auth-token=test-token',
      },
    });
    const response = await GET(request, { params: Promise.resolve({ keyword: 'RAG' }) });

    expect(getJobsForKeyword).toHaveBeenCalledWith('RAG', 'talent-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      keyword: 'RAG',
      jobs: [{ id: 'job-1', title: 'Senior RAG Engineer', companyName: 'Aperture AI' }],
    });
  });

  it('returns a job detail payload when jobId is provided', async () => {
    getJobDetail.mockResolvedValueOnce({
      id: 'job-1',
      title: 'AI Platform Lead',
      companyName: 'Northstar Labs',
      location: 'Remote',
      workMode: 'remote',
      matchScore: 91,
      skills: [],
      description: 'Own the platform roadmap.',
      seniority: 'Senior',
      budgetRange: '$180k-$220k',
      timeline: 'Q2 2026',
      deliverables: 'Platform launch',
      matchBreakdown: { skills: 94 },
      aiReasoning: 'Strong orchestration fit.',
    });

    const { GET } = await import('../[keyword]/jobs/route');
    const request = new NextRequest('http://localhost/api/v1/graph/RAG/jobs?jobId=job-1');
    const response = await GET(request, { params: Promise.resolve({ keyword: 'RAG' }) });

    expect(getJobDetail).toHaveBeenCalledWith('job-1', undefined);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'job-1',
      title: 'AI Platform Lead',
      companyName: 'Northstar Labs',
      location: 'Remote',
      workMode: 'remote',
      matchScore: 91,
      skills: [],
      description: 'Own the platform roadmap.',
      seniority: 'Senior',
      budgetRange: '$180k-$220k',
      timeline: 'Q2 2026',
      deliverables: 'Platform launch',
      matchBreakdown: { skills: 94 },
      aiReasoning: 'Strong orchestration fit.',
    });
  });
});
