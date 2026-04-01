import { PageTransition } from '@/components/animations/page-transition';
import { VisibilityToggle } from '@/components/settings/visibility-toggle';
import { MembershipCard } from '@/components/settings/membership-card';
import { TierComparison } from '@/components/settings/tier-comparison';
import { UsageMeter } from '@/components/settings/usage-meter';

export default function EnterpriseSettingsPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground">管理企业账号、可见性和会员方案。</p>
        </div>

        <VisibilityToggle initialVisible={true} variant="enterprise" />
        <MembershipCard tier="basic" variant="enterprise" />
        <UsageMeter variant="enterprise" />
        <TierComparison role="enterprise" currentTierId="ent-basic" />
      </div>
    </PageTransition>
  );
}
