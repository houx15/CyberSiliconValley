import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { OnboardingChat } from '@/components/enterprise/onboarding-chat';

export default async function EnterpriseOnboardingPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    redirect('/login');
  }

  // Check if already onboarded
  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, userId))
    .limit(1);

  if (profile?.onboardingDone) {
    redirect('/enterprise/dashboard');
  }

  return (
    <div className="h-full px-6 py-4">
      <OnboardingChat />
    </div>
  );
}
