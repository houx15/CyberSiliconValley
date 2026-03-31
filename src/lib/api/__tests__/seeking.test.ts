import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
};

const chain = {} as MockChain;
chain.from = vi.fn().mockReturnValue(chain);
chain.where = vi.fn().mockReturnValue(chain);
chain.innerJoin = vi.fn().mockReturnValue(chain);
chain.orderBy = vi.fn().mockReturnValue(chain);
chain.limit = vi.fn();
chain.values = vi.fn().mockReturnValue(chain);
chain.onConflictDoUpdate = vi.fn().mockResolvedValue([{ id: 'report-1' }]);

const db = {
  select: vi.fn().mockReturnValue(chain),
  insert: vi.fn().mockReturnValue(chain),
};

vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/db/schema', () => ({
  seekingReports: {
    id: 'seeking_reports.id',
    talentId: 'seeking_reports.talent_id',
    reportData: 'seeking_reports.report_data',
    generatedAt: 'seeking_reports.generated_at',
  },
  talentProfiles: {
    id: 'talent_profiles.id',
    userId: 'talent_profiles.user_id',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ kind: 'eq', column, value })),
  desc: vi.fn((column) => ({ kind: 'desc', column })),
}));

describe('seeking data access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLatestReportByTalentId returns null when no reports exist', async () => {
    chain.limit.mockResolvedValueOnce([]);

    const { getLatestReportByTalentId } = await import('../seeking');
    const result = await getLatestReportByTalentId('talent-1');

    expect(result).toBeNull();
  });

  it('getLatestReportByUserId resolves talent profile before querying report', async () => {
    chain.limit
      .mockResolvedValueOnce([{ id: 'talent-1' }])
      .mockResolvedValueOnce([
        {
          reportData: {
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
        },
      ]);

    const { getLatestReportByUserId } = await import('../seeking');
    const result = await getLatestReportByUserId('user-1');

    expect(result?.scanSummary.totalScanned).toBe(42);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('upsertReport accepts valid report data', async () => {
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

    await expect(upsertReport('talent-1', reportData)).resolves.not.toThrow();
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
