import { PageTransition } from '@/components/animations/page-transition';
import { VisibilityToggle } from '@/components/settings/visibility-toggle';
import { MembershipCard } from '@/components/settings/membership-card';
import { TierComparison } from '@/components/settings/tier-comparison';
import { UsageMeter } from '@/components/settings/usage-meter';
import { LogoutButton } from '@/components/settings/logout-button';

export default function TalentSettingsPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground">管理个人账号、可见性和会员方案。</p>
        </div>

        <VisibilityToggle initialVisible={true} variant="talent" />
        <MembershipCard tier="free" variant="talent" />
        <UsageMeter variant="talent" />
        <TierComparison role="talent" />
        <LogoutButton />
      </div>
    </PageTransition>
  );
}
