import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '@/lib/auth';
import CoachChat from '@/components/coach/coach-chat';

export default async function CoachPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  try {
    const auth = await verifyJWT(token);
    if (auth.role !== 'talent') {
      redirect('/login');
    }
  } catch {
    redirect('/login');
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      <CoachChat />
    </div>
  );
}
