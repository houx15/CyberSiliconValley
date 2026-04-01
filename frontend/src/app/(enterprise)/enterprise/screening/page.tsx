import { redirect } from 'next/navigation';
import { ScreeningChat } from '@/components/matching/screening-chat';
import { listEnterpriseJobs, listOpenEnterpriseJobs } from '@/lib/api/jobs';
import { getCurrentUser } from '@/lib/session/current-user';
import { MOCK_JOBS } from '@/lib/mock-data';

export default async function ScreeningPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'enterprise') {
    redirect('/login');
  }

  let activeJobs: Array<{ id: string; title: string }> = [];

  try {
    activeJobs = listOpenEnterpriseJobs(await listEnterpriseJobs());
  } catch {
    activeJobs = MOCK_JOBS.filter((job) => job.status === 'open').map((job) => ({
      id: job.id,
      title: job.title || 'Untitled',
    }));
  }

  return (
    <div className="h-full">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h1 className="font-serif text-xl font-bold">AI Talent Screening</h1>
        <p className="text-sm text-muted-foreground">
          Chat with your AI recruiter to search, compare, and shortlist candidates.
        </p>
      </div>
      <ScreeningChat activeJobs={activeJobs} />
    </div>
  );
}
