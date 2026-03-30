import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';

const enterpriseNavItems = [
  { href: '/enterprise/dashboard', labelKey: 'dashboard', icon: '📊' },
  { href: '/enterprise/jobs', labelKey: 'jobs', icon: '📝' },
  { href: '/enterprise/screening', labelKey: 'screening', icon: '🔍' },
  { href: '/enterprise/inbox', labelKey: 'inbox', icon: '📬' },
];

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <SidebarNav items={enterpriseNavItems} variant="enterprise" />
      <main className="flex-1 overflow-auto p-6">
        <CompanionBar />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
