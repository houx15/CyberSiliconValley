import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session/current-user';
import { AiHrPageClient } from '@/components/ai/ai-hr-page-client';
import { PageTransition } from '@/components/animations/page-transition';

export default async function AiHrPage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/login');
  }

  if (!user || user.role !== 'enterprise') {
    redirect('/login');
  }

  return (
    <PageTransition>
      <AiHrPageClient />
    </PageTransition>
  );
}
