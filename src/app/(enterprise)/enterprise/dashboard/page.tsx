import Link from 'next/link';
import { PageTransition } from '@/components/animations/page-transition';
import { ActivityStatus } from '@/components/enterprise/activity-status';
import { JobList } from '@/components/enterprise/job-list';
import { EmptyJobs } from '@/components/empty-states/empty-jobs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_ENTERPRISE_PROFILE, MOCK_JOBS, MOCK_JOB_MATCH_COUNTS } from '@/lib/mock-data';
import { listEnterpriseJobs } from '@/lib/api/jobs';
import { getCurrentEnterpriseProfile } from '@/lib/api/profile';

type DashboardProfile = {
  companyName: string;
  onboardingDone: boolean;
};

type DashboardJob = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  matchCount: number;
  shortlistedCount: number;
};

export default async function DashboardPage() {
  const fallbackJobsWithCounts: DashboardJob[] = MOCK_JOBS.map((job) => ({
    id: job.id,
    title: job.title || 'Untitled',
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
    shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
  }));
  let resolvedData: { profile: DashboardProfile; jobsWithCounts: DashboardJob[] } = {
    profile: {
      companyName: MOCK_ENTERPRISE_PROFILE.companyName,
      onboardingDone: MOCK_ENTERPRISE_PROFILE.onboardingDone,
    },
    jobsWithCounts: fallbackJobsWithCounts,
  };

  try {
    const [profile, jobsWithCounts] = await Promise.all([
      getCurrentEnterpriseProfile(),
      listEnterpriseJobs(),
    ]);

    if (profile?.onboardingDone) {
      resolvedData = {
        profile: {
          companyName: profile.companyName,
          onboardingDone: profile.onboardingDone,
        },
        jobsWithCounts: jobsWithCounts.map((job) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          createdAt: job.createdAt,
          matchCount: job.matchCount,
          shortlistedCount: job.shortlistedCount,
        })),
      };
    }
  } catch {
    resolvedData = {
      profile: MOCK_ENTERPRISE_PROFILE,
      jobsWithCounts: fallbackJobsWithCounts,
    };
  }

  const { profile, jobsWithCounts } = resolvedData;
  const totalMatches = jobsWithCounts.reduce((sum, j) => sum + j.matchCount, 0);
  const totalShortlisted = jobsWithCounts.reduce((sum, j) => sum + j.shortlistedCount, 0);

  return (
    <PageTransition className="space-y-6">
      <ActivityStatus
        initial={{
          profilesScanned: totalMatches > 0 ? totalMatches * 5 : 0,
          matchesFound: totalMatches,
          preChatActive: totalShortlisted,
        }}
      />

      <div className="flex gap-3">
        <Link href="/enterprise/jobs/new">
          <Button variant="default" size="sm">Post a New Job</Button>
        </Link>
        <Link href="/enterprise/screening">
          <Button variant="outline" size="sm">Screen Talent</Button>
        </Link>
        {totalMatches > 0 && (
          <a href="#active-jobs">
            <Button variant="outline" size="sm">Review AI Picks</Button>
          </a>
        )}
      </div>

      {jobsWithCounts.length === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-6">
            <h3 className="text-sm font-medium text-foreground">
              Welcome, {profile.companyName}!
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your company profile is set up. Post your first job to start finding talent.
            </p>
          </CardContent>
        </Card>
      )}

      <section id="active-jobs">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Jobs</CardTitle>
              <span className="text-xs text-muted-foreground">
                {jobsWithCounts.length} {jobsWithCounts.length === 1 ? 'job' : 'jobs'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {jobsWithCounts.length === 0 ? <EmptyJobs /> : <JobList jobs={jobsWithCounts} />}
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  );
}
