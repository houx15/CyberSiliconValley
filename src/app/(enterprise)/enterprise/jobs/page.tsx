import { desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

import { PageTransition } from '@/components/animations/page-transition';
import { JobList } from '@/components/enterprise/job-list';
import { EmptyJobs } from '@/components/empty-states/empty-jobs';
import { MOCK_ENTERPRISE_PROFILE, MOCK_JOBS, MOCK_JOB_MATCH_COUNTS } from '@/lib/mock-data';

async function getEnterpriseJobs(userId: string) {
  try {
    const { db } = await import('@/lib/db');
    const { enterpriseProfiles, jobs, matches } = await import('@/lib/db/schema');

    const [profile] = await db
      .select({ id: enterpriseProfiles.id })
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, userId))
      .limit(1);

    if (!profile?.id) {
      return [];
    }

    const jobRows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.enterpriseId, profile.id))
      .orderBy(desc(jobs.createdAt));

    return Promise.all(
      jobRows.map(async (job) => {
        const [stats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            shortlisted: sql<number>`count(*) filter (where ${matches.status} = 'shortlisted')::int`,
          })
          .from(matches)
          .where(eq(matches.jobId, job.id));

        return {
          id: job.id,
          title: job.title,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          matchCount: stats?.total ?? 0,
          shortlistedCount: stats?.shortlisted ?? 0,
        };
      })
    );
  } catch {
    return MOCK_JOBS.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
      shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
    }));
  }
}

export default async function JobsPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || MOCK_ENTERPRISE_PROFILE.userId;
  const jobs = await getEnterpriseJobs(userId);

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the roles currently open across your hiring pipeline.
        </p>
      </div>
      {jobs.length === 0 ? <EmptyJobs /> : <JobList jobs={jobs} />}
    </PageTransition>
  );
}
