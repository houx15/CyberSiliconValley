import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const enterpriseNavItems = [
    { href: '/enterprise/dashboard', labelKey: 'workbench', icon: 'dashboard' },
    { href: '/enterprise/jobs', labelKey: 'jobs', icon: 'briefcase' },
    { href: '/enterprise/talent', labelKey: 'talentMarket', icon: 'users' },
  ];

  return (
    <div className="flex h-screen">
      <SidebarNav items={enterpriseNavItems} variant="enterprise" />
      <main className="flex-1 overflow-auto p-6">
        <CompanionBar persona="ai-hr" />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
