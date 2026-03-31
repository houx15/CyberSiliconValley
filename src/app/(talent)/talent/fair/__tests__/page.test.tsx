import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const FairClient = vi.fn(({ userSkills }: { userSkills: string[] }) => {
  return <div data-testid="fair-client" data-skills={JSON.stringify(userSkills)} />;
});

const selectChain = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

const db = {
  select: vi.fn().mockReturnValue(selectChain),
};

vi.mock('@/app/(talent)/talent/fair/fair-client', () => ({
  default: FairClient,
}));

vi.mock('@/lib/db', () => ({ db }));
const verifyJWT = vi.fn();
vi.mock('@/lib/auth', () => ({
  verifyJWT,
}));

vi.mock('@/lib/db/schema', () => ({
  talentProfiles: {
    id: 'talent_profiles.id',
    userId: 'talent_profiles.user_id',
    skills: 'talent_profiles.skills',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ kind: 'eq', column, value })),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: () => null,
  }),
  cookies: async () => ({
    get: (key: string) =>
      key === 'auth-token'
        ? {
            value: 'mock-token',
          }
        : null,
  }),
}));

describe('FairPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
  });

  it('uses the authenticated talent user id when available', async () => {
    verifyJWT.mockResolvedValueOnce({
      userId: 'user-123',
      role: 'talent',
      email: 'talent@example.com',
    });
    selectChain.limit.mockResolvedValueOnce([
      {
        skills: [
          { name: 'RAG Pipeline' },
          { name: 'TypeScript' },
        ],
      },
    ]);

    const { default: FairPage } = await import('../page');
    const markup = renderToStaticMarkup(await FairPage());

    expect(markup).toContain('data-testid="fair-client"');
    expect(markup).toContain('RAG Pipeline');
    expect(markup).toContain('TypeScript');
    expect(FairClient).toHaveBeenCalledTimes(1);
    expect(FairClient.mock.calls[0]?.[0]).toEqual({
      userSkills: ['RAG Pipeline', 'TypeScript'],
    });
    expect(verifyJWT).toHaveBeenCalledWith('mock-token');
  });

  it('falls back to demo skills when auth verification fails', async () => {
    verifyJWT.mockRejectedValueOnce(new Error('invalid token'));
    selectChain.limit.mockResolvedValueOnce([]);

    const { default: FairPage } = await import('../page');
    renderToStaticMarkup(await FairPage());

    expect(FairClient).toHaveBeenCalledTimes(1);
    expect(FairClient.mock.calls[0]?.[0]).toEqual({
      userSkills: expect.arrayContaining(['RAG Pipeline', 'LangChain']),
    });
  });
});
