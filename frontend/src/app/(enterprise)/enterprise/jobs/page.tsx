import { PageTransition } from '@/components/animations/page-transition';
import { JobList } from '@/components/enterprise/job-list';
import { EmptyJobs } from '@/components/empty-states/empty-jobs';
import { MOCK_ENTERPRISE_PROFILE, MOCK_JOBS, MOCK_JOB_MATCH_COUNTS } from '@/lib/mock-data';
import { listEnterpriseJobs } from '@/lib/api/jobs';

export default async function JobsPage() {
  let jobs = [];

  try {
    jobs = await listEnterpriseJobs();
  } catch {
    jobs = MOCK_JOBS.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
      shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
    }));
  }

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
