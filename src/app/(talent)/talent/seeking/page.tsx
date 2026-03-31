import { headers } from 'next/headers';
import { SeekingReportClient } from '@/components/seeking/seeking-report-client';
import { getLatestReportByUserId } from '@/lib/api/seeking';
import { MOCK_SEEKING_REPORT, MOCK_TALENT_PROFILE } from '@/lib/mock-data';

export default async function SeekingPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || MOCK_TALENT_PROFILE.userId;
  let report = null;
  let talentId = MOCK_TALENT_PROFILE.id;

  try {
    report = await getLatestReportByUserId(userId);
    const { db } = await import('@/lib/db');
    const { talentProfiles } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);
    talentId = rows[0]?.id ?? talentId;
  } catch {
    report = MOCK_SEEKING_REPORT;
  }

  if (!report && userId === MOCK_TALENT_PROFILE.userId) {
    report = MOCK_SEEKING_REPORT;
  }

  return <SeekingReportClient initialReport={report} talentId={talentId} />;
}
