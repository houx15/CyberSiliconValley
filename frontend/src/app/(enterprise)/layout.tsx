import { SidebarNav } from '@/components/layout/sidebar-nav';
import { AiFab } from '@/components/ai/ai-fab';

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const enterpriseNavItems = [
    { href: '/enterprise/dashboard', labelKey: 'workbench', icon: 'dashboard' },
    { href: '/enterprise/jobs', labelKey: 'jobs', icon: 'briefcase' },
    { href: '/enterprise/talent', labelKey: 'talentMarket', icon: 'users' },
    { href: '/enterprise/conversations', labelKey: 'conversations', icon: 'message-square' },
    { href: '/enterprise/ai-hr', labelKey: 'aiHr', icon: 'bot' },
  ];

  return (
    <div className="flex h-screen">
      <SidebarNav items={enterpriseNavItems} variant="enterprise" />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
      <AiFab persona="ai-hr" />
    </div>
  );
}
