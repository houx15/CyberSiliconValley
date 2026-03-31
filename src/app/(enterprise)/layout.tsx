import { headers } from 'next/headers';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  let inboxBadge = 0;
  try {
    if (userId) {
      const { getUnreadInboxCount } = await import('@/lib/api/inbox');
      inboxBadge = await getUnreadInboxCount(userId);
    }
  } catch {
    inboxBadge = 1;
  }

  const enterpriseNavItems = [
    { href: '/enterprise/dashboard', labelKey: 'dashboard', icon: '📊' },
    { href: '/enterprise/jobs', labelKey: 'jobs', icon: '📝' },
    { href: '/enterprise/screening', labelKey: 'screening', icon: '🔍' },
    { href: '/enterprise/inbox', labelKey: 'inbox', icon: '📬', badge: inboxBadge },
  ];

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
