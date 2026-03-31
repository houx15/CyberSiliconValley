import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScreeningChat } from '@/components/matching/screening-chat';

export default async function ScreeningPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  let payload;
  try {
    payload = await verifyJWT(token);
  } catch {
    redirect('/login');
  }

  if (payload.role !== 'enterprise') {
    redirect('/login');
  }

  // Load enterprise's active jobs
  const enterprise = await db.query.enterpriseProfiles.findFirst({
    where: eq(enterpriseProfiles.userId, payload.userId),
  });

  let activeJobs: Array<{ id: string; title: string }> = [];

  if (enterprise) {
    const allJobs = await db.query.jobs.findMany({
      where: eq(jobs.status, 'open'),
    });
    activeJobs = allJobs
      .filter((j) => j.enterpriseId === enterprise.id)
      .map((j) => ({ id: j.id, title: j.title || 'Untitled' }));
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
