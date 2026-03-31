import { desc, eq } from 'drizzle-orm';

export interface ScanSummary {
  totalScanned: number;
  highMatches: number;
  mediumMatches: number;
  periodLabel: string;
}

export interface HighMatchItem {
  matchId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  workMode: string;
  score: number;
  skillMatches: Array<{
    skill: string;
    matched: boolean;
    level: string;
  }>;
  aiAssessment: string;
}

export interface PreChatItem {
  inboxItemId: string;
  companyName: string;
  jobTitle: string;
  summary: string;
  generatedAt: string;
}

export interface InboundInterestItem {
  matchId: string;
  companyName: string;
  reason: string;
  score: number;
  jobId: string;
}

export interface SeekingReportData {
  scanSummary: ScanSummary;
  highMatches: HighMatchItem[];
  preChatActivity: PreChatItem[];
  inboundInterest: InboundInterestItem[];
  generatedAt: string;
}

export async function getLatestReportByTalentId(
  talentId: string
): Promise<SeekingReportData | null> {
  const [{ db }, { seekingReports }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const rows = await db
    .select({ reportData: seekingReports.reportData })
    .from(seekingReports)
    .where(eq(seekingReports.talentId, talentId))
    .orderBy(desc(seekingReports.generatedAt))
    .limit(1);

  return (rows[0]?.reportData as SeekingReportData | undefined) ?? null;
}

export async function getLatestReportByUserId(
  userId: string
): Promise<SeekingReportData | null> {
  const [{ db }, { talentProfiles }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const profileRows = await db
    .select({ id: talentProfiles.id })
    .from(talentProfiles)
    .where(eq(talentProfiles.userId, userId))
    .limit(1);

  const talentId = profileRows[0]?.id;
  if (!talentId) {
    return null;
  }

  return getLatestReportByTalentId(talentId);
}

export async function upsertReport(
  talentId: string,
  reportData: SeekingReportData
): Promise<void> {
  const [{ db }, { seekingReports }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  await db.insert(seekingReports).values({
    talentId,
    reportData,
    generatedAt: new Date(),
  });
}
