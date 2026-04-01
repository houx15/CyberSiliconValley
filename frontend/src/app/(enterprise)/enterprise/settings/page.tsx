import { PageTransition } from '@/components/animations/page-transition';

export default function EnterpriseSettingsPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground">管理企业账号、可见性和会员方案。</p>
        </div>

        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
          设置页面即将上线
        </div>
      </div>
    </PageTransition>
  );
}
