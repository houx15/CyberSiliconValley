import { redirect } from 'next/navigation';
import { OnboardingChat } from '@/components/enterprise/onboarding-chat';
import { getCurrentEnterpriseProfile } from '@/lib/api/profile';
import { getCurrentUser } from '@/lib/session/current-user';

export default async function EnterpriseOnboardingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'enterprise') {
    redirect('/login');
  }

  const profile = await getCurrentEnterpriseProfile();
  if (profile?.onboardingDone) {
    redirect('/enterprise/dashboard');
  }

  return (
    <div className="h-full px-6 py-4">
      <OnboardingChat />
    </div>
  );
}
