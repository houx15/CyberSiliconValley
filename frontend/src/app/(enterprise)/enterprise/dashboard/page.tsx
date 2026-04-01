import Link from 'next/link';
import { PageTransition } from '@/components/animations/page-transition';
import { WorkbenchReport } from '@/components/enterprise/workbench-report';
import { JobList } from '@/components/enterprise/job-list';
import { EmptyJobs } from '@/components/empty-states/empty-jobs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, ArrowRight, Briefcase, Users } from 'lucide-react';
import { MOCK_ENTERPRISE_PROFILE, MOCK_JOBS, MOCK_JOB_MATCH_COUNTS, MOCK_WORKBENCH_STATS } from '@/lib/mock-data';
import { listEnterpriseJobs } from '@/lib/api/jobs';
import { getCurrentEnterpriseProfile } from '@/lib/api/profile';
import { getWorkbenchStats } from '@/lib/api/enterprise-dashboard';
import type { WorkbenchStats } from '@/lib/api/enterprise-dashboard';

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

  let profile: DashboardProfile = {
    companyName: MOCK_ENTERPRISE_PROFILE.companyName,
    onboardingDone: MOCK_ENTERPRISE_PROFILE.onboardingDone,
  };
  let jobsWithCounts: DashboardJob[] = fallbackJobsWithCounts;
  let workbenchStats: WorkbenchStats = MOCK_WORKBENCH_STATS;

  try {
    const [profileData, jobsData, statsData] = await Promise.all([
      getCurrentEnterpriseProfile(),
      listEnterpriseJobs(),
      getWorkbenchStats(),
    ]);

    if (profileData?.onboardingDone) {
      profile = {
        companyName: profileData.companyName,
        onboardingDone: profileData.onboardingDone,
      };
      jobsWithCounts = jobsData.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        createdAt: job.createdAt,
        matchCount: job.matchCount,
        shortlistedCount: job.shortlistedCount,
      }));
    }

    workbenchStats = statsData;
  } catch {
    // Use mock data on failure
  }

  return (
    <PageTransition className="space-y-6">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          你好，{profile.companyName}
        </h1>
        <p className="text-sm text-muted-foreground">
          AI HR 正在为你工作。以下是最新进展。
        </p>
      </div>

      {/* AI HR Report */}
      <WorkbenchReport stats={workbenchStats} />

      {/* Quick link to AI HR detail */}
      <Link
        href="/enterprise/ai-hr"
        className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors hover:bg-emerald-500/10"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">查看 AI HR 详细工作记录</p>
          <p className="text-xs text-muted-foreground">具体人才、沟通记录、按职位归类查看</p>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-400" />
      </Link>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href="/enterprise/jobs/new">
          <Button variant="default" size="sm" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            发布新职位
          </Button>
        </Link>
        <Link href="/enterprise/talent">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            浏览人才市场
          </Button>
        </Link>
      </div>

      {/* Active Jobs */}
      <section id="active-jobs">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">活跃职位</CardTitle>
              <span className="text-xs text-muted-foreground">
                {jobsWithCounts.length} 个职位
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
