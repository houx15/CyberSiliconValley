import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { OnboardingChat } from '@/components/enterprise/onboarding-chat';

async function isAlreadyOnboarded(userId: string): Promise<boolean> {
  try {
    const { db } = await import('@/lib/db');
    const { enterpriseProfiles } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const [profile] = await db
      .select()
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, userId))
      .limit(1);
    return !!profile?.onboardingDone;
  } catch {
    return false; // No DB = show onboarding
  }
}

export default async function EnterpriseOnboardingPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    redirect('/login');
  }

  if (await isAlreadyOnboarded(userId)) {
    redirect('/enterprise/dashboard');
  }

  return (
    <div className="h-full px-6 py-4">
      <OnboardingChat />
    </div>
  );
}
