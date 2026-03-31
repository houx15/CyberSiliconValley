import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs, matches } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { ActivityStatus } from '@/components/enterprise/activity-status';
import { JobList } from '@/components/enterprise/job-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    redirect('/login');
  }

  // Get enterprise profile
  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, userId))
    .limit(1);

  // If not onboarded yet, send to onboarding
  if (!profile?.onboardingDone) {
    redirect('/enterprise/onboarding');
  }

  // Get jobs with match counts
  const jobsList = await db
    .select()
    .from(jobs)
    .where(eq(jobs.enterpriseId, profile.id))
    .orderBy(desc(jobs.createdAt));

  // Get match counts per job
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

  // Aggregate stats for activity bar
  const totalMatches = jobsWithCounts.reduce((sum, j) => sum + j.matchCount, 0);
  const totalShortlisted = jobsWithCounts.reduce((sum, j) => sum + j.shortlistedCount, 0);

  return (
    <div className="space-y-6">
      {/* AI Activity Status Bar */}
      <ActivityStatus
        initial={{
          profilesScanned: totalMatches > 0 ? totalMatches * 5 : 0,
          matchesFound: totalMatches,
          preChatActive: totalShortlisted,
        }}
      />

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/enterprise/jobs/new">
          <Button variant="default" size="sm">
            Post a New Job
          </Button>
        </Link>
        <Link href="/enterprise/screening">
          <Button variant="outline" size="sm">
            Screen Talent
          </Button>
        </Link>
        {totalMatches > 0 && (
          <a href="#active-jobs">
            <Button variant="outline" size="sm">
              Review AI Picks
            </Button>
          </a>
        )}
      </div>

      {/* Welcome card for new users */}
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

      {/* Active Jobs */}
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
