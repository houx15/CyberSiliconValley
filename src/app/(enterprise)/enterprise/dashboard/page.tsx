import { headers } from 'next/headers';
import Link from 'next/link';
import { ActivityStatus } from '@/components/enterprise/activity-status';
import { JobList } from '@/components/enterprise/job-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_ENTERPRISE_PROFILE, MOCK_JOBS, MOCK_JOB_MATCH_COUNTS } from '@/lib/mock-data';

async function getDashboardData(userId: string) {
  try {
    const { db } = await import('@/lib/db');
    const { enterpriseProfiles, jobs, matches } = await import('@/lib/db/schema');
    const { eq, desc, sql } = await import('drizzle-orm');

    const [profile] = await db
      .select()
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, userId))
      .limit(1);

    if (!profile?.onboardingDone) return null;

    const jobsList = await db
      .select()
      .from(jobs)
      .where(eq(jobs.enterpriseId, profile.id))
      .orderBy(desc(jobs.createdAt));

    const jobsWithCounts = await Promise.all(
      jobsList.map(async (job) => {
        const [matchStats] = await db
          .select({
            total: sql<number>`count(*)`,
            shortlisted: sql<number>`count(*) filter (where ${matches.status} = 'shortlisted')`,
          })
          .from(matches)
          .where(eq(matches.jobId, job.id));

        return {
          id: job.id,
          title: job.title,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          matchCount: Number(matchStats?.total ?? 0),
          shortlistedCount: Number(matchStats?.shortlisted ?? 0),
        };
      })
    );

    return { profile, jobsWithCounts };
  } catch {
    // Fallback to mock data
    const jobsWithCounts = MOCK_JOBS.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
      shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
    }));
    return { profile: MOCK_ENTERPRISE_PROFILE, jobsWithCounts };
  }
}

export default async function DashboardPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || 'test-enterprise-1';

  const data = await getDashboardData(userId);

  if (!data) {
    // Use mock anyway for demo
    const jobsWithCounts = MOCK_JOBS.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
      shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
    }));
    Object.assign(data ?? {}, { profile: MOCK_ENTERPRISE_PROFILE, jobsWithCounts });
  }

  const { profile, jobsWithCounts } = data!;
  const totalMatches = jobsWithCounts.reduce((sum, j) => sum + j.matchCount, 0);
  const totalShortlisted = jobsWithCounts.reduce((sum, j) => sum + j.shortlistedCount, 0);

  return (
    <div className="space-y-6">
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
            <JobList jobs={jobsWithCounts} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
