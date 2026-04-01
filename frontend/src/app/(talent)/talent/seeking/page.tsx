import { PageTransition } from '@/components/animations/page-transition';
import { NoReport } from '@/components/empty-states/no-report';
import { SeekingReportClient } from '@/components/seeking/seeking-report-client';
import { getCurrentTalentProfile } from '@/lib/api/profile';
import { getLatestReportByUserId } from '@/lib/api/seeking';
import { MOCK_SEEKING_REPORT } from '@/lib/mock-data';

export default async function SeekingPage() {
  let report = null;
  let talentId = '';

  try {
    const [nextReport, profile] = await Promise.all([
      getLatestReportByUserId(),
      getCurrentTalentProfile(),
    ]);
    report = nextReport;
    talentId = profile?.id || '';
  } catch {
    report = MOCK_SEEKING_REPORT;
    talentId = 'mock-talent-profile-1';
  }

  if (!report) {
    return <NoReport />;
  }

  return (
    <PageTransition>
      <SeekingReportClient initialReport={report} talentId={talentId} />
    </PageTransition>
  );
}
