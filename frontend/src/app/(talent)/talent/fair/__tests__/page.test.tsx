import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';

const FairClient = vi.fn(({ userSkills }: { userSkills: string[] }) => {
  return <div data-testid="fair-client" data-skills={JSON.stringify(userSkills)} />;
});

const getCurrentTalentProfile = vi.fn();

vi.mock('@/app/(talent)/talent/fair/fair-client', () => ({
  default: FairClient,
}));

vi.mock('@/lib/api/profile', () => ({
  getCurrentTalentProfile,
}));

describe('FairPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the current talent profile skills when available', async () => {
    getCurrentTalentProfile.mockResolvedValueOnce({
      ...MOCK_TALENT_PROFILE,
      skills: [{ name: 'RAG Pipeline' }, { name: 'TypeScript' }],
    });

    const { default: FairPage } = await import('../page');
    const markup = renderToStaticMarkup(await FairPage());

    expect(markup).toContain('data-testid="fair-client"');
    expect(markup).toContain('RAG Pipeline');
    expect(markup).toContain('TypeScript');
    expect(FairClient).toHaveBeenCalledTimes(1);
    expect(FairClient.mock.calls[0]?.[0]).toEqual({
      userSkills: ['RAG Pipeline', 'TypeScript'],
    });
    expect(getCurrentTalentProfile).toHaveBeenCalled();
  });

  it('falls back to demo skills when profile loading fails', async () => {
    getCurrentTalentProfile.mockRejectedValueOnce(new Error('profile unavailable'));

    const { default: FairPage } = await import('../page');
    renderToStaticMarkup(await FairPage());

    expect(FairClient).toHaveBeenCalledTimes(1);
    expect(FairClient.mock.calls[0]?.[0]).toEqual({
      userSkills: expect.arrayContaining(['RAG Pipeline', 'LangChain']),
    });
  });
});
