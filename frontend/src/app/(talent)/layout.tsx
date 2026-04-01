import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';
import { MOCK_COMPANION_COUNTS } from '@/lib/mock-data';
import { getCurrentUser } from '@/lib/session/current-user';

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  let statusMessage: string | undefined;
  try {
    if (user?.role === 'talent') {
      const { getTalentCompanionCounts } = await import('@/lib/companion-status');
      const { matchCount, inboxCount } = await getTalentCompanionCounts(user.id);
      if (matchCount > 0 || inboxCount > 0) {
        statusMessage = `You have ${matchCount} new matches and ${inboxCount} new messages. Click to chat.`;
      }
    }
  } catch {
    const { matchCount, inboxCount } = MOCK_COMPANION_COUNTS;
    statusMessage = `You have ${matchCount} new matches and ${inboxCount} new messages. Click to chat.`;
  }

  const talentNavItems = [
    { href: '/talent/home', labelKey: 'home', icon: 'home' },
    { href: '/talent/coach', labelKey: 'coach', icon: 'sparkles' },
    { href: '/talent/seeking', labelKey: 'seeking', icon: 'bar-chart' },
    { href: '/talent/fair', labelKey: 'fair', icon: 'store' },
  ];

  return (
    <div className="flex h-screen">
      <SidebarNav items={talentNavItems} variant="talent" />
      <main className="flex-1 overflow-auto p-6">
        <CompanionBar
          persona="buddy"
          statusMessage={statusMessage}
          sessionTypes={['general', 'home', 'coach']}
        />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
