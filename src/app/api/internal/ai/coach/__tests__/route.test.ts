import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamText = vi.fn();
const tool = vi.fn((config) => config);
const zodSchema = vi.fn((schema) => schema);
const getModel = vi.fn(() => ({ model: 'mock-model' }));
const buildCoachSystemPrompt = vi.fn(() => 'coach-prompt');
const getOrCreateSession = vi.fn();
const getSessionContext = vi.fn();
const updateSessionContext = vi.fn();
const saveChatMessage = vi.fn();
const verifyJWT = vi.fn();

const selectChain = {
  from: vi.fn(),
  where: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

const updateChain = {
  set: vi.fn(),
  where: vi.fn(),
};

const db = {
  select: vi.fn(() => selectChain),
  update: vi.fn(() => updateChain),
};

vi.mock('ai', () => ({
  streamText,
  tool,
  zodSchema,
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel,
}));

vi.mock('@/lib/ai/prompts/coach', () => ({
  buildCoachSystemPrompt,
  COACH_TOOLS: [
    {
      function: {
        description: 'Update profile field',
      },
    },
    {
      function: {
        description: 'Suggest a skill',
      },
    },
  ],
}));

vi.mock('@/lib/ai/chat', () => ({
  getOrCreateSession,
  getSessionContext,
  updateSessionContext,
  saveChatMessage,
}));

vi.mock('@/lib/auth', () => ({
  verifyJWT,
}));

vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/db/schema', () => ({
  talentProfiles: {
    id: 'talent_profiles.id',
    userId: 'talent_profiles.user_id',
    displayName: 'talent_profiles.display_name',
    headline: 'talent_profiles.headline',
    bio: 'talent_profiles.bio',
    skills: 'talent_profiles.skills',
    experience: 'talent_profiles.experience',
    education: 'talent_profiles.education',
    goals: 'talent_profiles.goals',
    availability: 'talent_profiles.availability',
  },
  matches: {
    talentId: 'matches.talent_id',
    jobId: 'matches.job_id',
    score: 'matches.score',
  },
  jobs: {
    id: 'jobs.id',
    title: 'jobs.title',
    enterpriseId: 'jobs.enterprise_id',
  },
  enterpriseProfiles: {
    id: 'enterprise_profiles.id',
    companyName: 'enterprise_profiles.company_name',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ kind: 'and', conditions })),
  desc: vi.fn((column) => ({ kind: 'desc', column })),
  eq: vi.fn((column, value) => ({ kind: 'eq', column, value })),
}));

const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

describe('coach route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJWT).mockResolvedValue({ userId: 'user-1', role: 'talent', email: 't@example.com' });
    vi.mocked(getOrCreateSession).mockResolvedValue({ id: 'session-1' });
    vi.mocked(getSessionContext).mockResolvedValue({
      coachThreads: {
        'resume-review': [{ role: 'assistant', content: 'Resume-only history' }],
        'mock-interview': [{ role: 'assistant', content: 'Mock-only history' }],
      },
    });
    vi.mocked(updateSessionContext).mockResolvedValue(undefined);
    mockCookies.mockResolvedValue({
      get: (name: string) => (name === 'auth-token' ? { value: 'token-1' } : undefined),
    });
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
    selectChain.innerJoin.mockReturnValue(selectChain);
    selectChain.leftJoin.mockReturnValue(selectChain);
    selectChain.orderBy.mockReturnValue(selectChain);
    selectChain.limit.mockReturnValue(selectChain);
    db.select.mockReturnValue(selectChain);
    updateChain.set.mockReturnValue(updateChain);
    updateChain.where.mockResolvedValue([]);
  });

  it('rejects unauthenticated requests', async () => {
    const { POST } = await import('../route');

    mockCookies.mockResolvedValueOnce({
      get: () => undefined,
    });
    const request = new Request('http://localhost/api/internal/ai/coach', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me' }] }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('loads profile and match context, builds the prompt, and streams text', async () => {
    const profileRow = {
      id: 'talent-1',
      userId: 'user-1',
      displayName: 'Zhang Wei',
      headline: 'ML Engineer',
      bio: 'Builds AI systems',
      skills: [{ name: 'Python', level: 'expert', category: 'Languages' }],
      experience: [],
      education: [],
      goals: { targetRoles: ['Staff ML Engineer'] },
      availability: 'open',
    };
    const matchRows = [
      { score: 92, jobTitle: 'Senior RAG Engineer', companyName: 'Aperture AI' },
      { score: 74, jobTitle: 'AI Platform Lead', companyName: 'Northstar Labs' },
    ];
    const limitResults = [ [profileRow], matchRows, [profileRow], matchRows ];
    selectChain.limit.mockImplementation(() => Promise.resolve(limitResults.shift() ?? []));

    const toUIMessageStreamResponse = vi.fn(() => new Response('ok', { status: 200 }));
    streamText.mockReturnValue({
      toUIMessageStreamResponse,
    });

    const { POST } = await import('../route');
    const resumeReviewRequest = new Request('http://localhost/api/internal/ai/coach', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'resume-review',
        messages: [
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'Review ' },
              { type: 'text', text: 'my resume' },
            ],
          },
        ],
      }),
    });

    const response = await POST(resumeReviewRequest as never);

    const mockInterviewRequest = new Request('http://localhost/api/internal/ai/coach', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'mock-interview',
        messages: [{ role: 'user', content: 'Run a mock interview' }],
      }),
    });

    const mockInterviewResponse = await POST(mockInterviewRequest as never);

    expect(response.status).toBe(200);
    expect(mockInterviewResponse.status).toBe(200);
    expect(getModel).toHaveBeenCalledTimes(2);
    expect(getOrCreateSession).toHaveBeenCalledTimes(2);
    expect(getOrCreateSession).toHaveBeenNthCalledWith(1, 'user-1', 'coach');
    expect(getOrCreateSession).toHaveBeenNthCalledWith(2, 'user-1', 'coach');
    expect(saveChatMessage).toHaveBeenCalledWith('session-1', 'user', 'Review my resume');
    expect(saveChatMessage).toHaveBeenCalledWith('session-1', 'user', 'Run a mock interview');
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith(
      'resume-review',
      expect.objectContaining({
        profileJson: expect.stringContaining('Zhang Wei'),
        goals: expect.stringContaining('Staff ML Engineer'),
        recentMatchesSummary: expect.stringContaining('Senior RAG Engineer'),
      })
    );
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith(
      'mock-interview',
      expect.objectContaining({
        profileJson: expect.stringContaining('Zhang Wei'),
      })
    );
    expect(streamText).toHaveBeenCalledTimes(2);
    expect((streamText.mock.calls[0]?.[0] as { messages?: Array<{ role: string; content: string }> }).messages).toEqual([
      { role: 'assistant', content: 'Resume-only history' },
      { role: 'user', content: 'Review my resume' },
    ]);
    expect((streamText.mock.calls[1]?.[0] as { messages?: Array<{ role: string; content: string }> }).messages).toEqual([
      { role: 'assistant', content: 'Mock-only history' },
      { role: 'user', content: 'Run a mock interview' },
    ]);
    expect((streamText.mock.calls[0]?.[0] as { tools?: Record<string, unknown> }).tools).toHaveProperty('updateProfileField');
    expect((streamText.mock.calls[0]?.[0] as { tools?: Record<string, unknown> }).tools).toHaveProperty('suggestSkill');
    expect(toUIMessageStreamResponse).toHaveBeenCalledTimes(2);
  });
});
