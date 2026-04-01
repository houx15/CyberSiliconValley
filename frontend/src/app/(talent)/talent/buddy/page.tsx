import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session/current-user';
import { BuddyPageClient } from '@/components/ai/buddy-page-client';
import { PageTransition } from '@/components/animations/page-transition';

export default async function BuddyPage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/login');
  }

  if (!user || user.role !== 'talent') {
    redirect('/login');
  }

  return (
    <PageTransition>
      <BuddyPageClient />
    </PageTransition>
  );
}
