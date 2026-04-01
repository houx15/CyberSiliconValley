import { redirect } from 'next/navigation';
import CoachChat from '@/components/coach/coach-chat';
import { getCurrentUser } from '@/lib/session/current-user';

export default async function CoachPage() {
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
    <div className="flex h-full min-h-screen flex-col">
      <CoachChat />
    </div>
  );
}
