import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('../client', () => ({
  apiFetch,
}));

describe('seeking data access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLatestReportByTalentId returns null when no reports exist', async () => {
    apiFetch.mockResolvedValueOnce({ data: null });

    const { getLatestReportByTalentId } = await import('../seeking');
    const result = await getLatestReportByTalentId('talent-1');

    expect(result).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/seeking');
  });

  it('getLatestReportByUserId loads the authenticated backend report', async () => {
    apiFetch.mockResolvedValueOnce({
      data: {
        scanSummary: {
          totalScanned: 42,
          highMatches: 4,
          mediumMatches: 9,
          periodLabel: 'This week',
        },
        highMatches: [],
        preChatActivity: [],
        inboundInterest: [],
        generatedAt: '2026-03-31T00:00:00.000Z',
      },
    });

    const { getLatestReportByUserId } = await import('../seeking');
    const result = await getLatestReportByUserId('user-1');

    expect(result?.scanSummary.totalScanned).toBe(42);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/seeking');
  });

  it('upsertReport is not supported from the frontend runtime', async () => {
    const { upsertReport } = await import('../seeking');

    const reportData = {
      scanSummary: {
        totalScanned: 42,
        highMatches: 5,
        mediumMatches: 12,
        periodLabel: 'This week',
      },
      highMatches: [],
      preChatActivity: [],
      inboundInterest: [],
      generatedAt: new Date().toISOString(),
    };

    await expect(upsertReport('talent-1', reportData)).rejects.toThrow(
      /Frontend seeking writes are no longer supported/
    );
  });
});
