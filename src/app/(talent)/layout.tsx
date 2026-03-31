import { headers } from 'next/headers';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';
import { getTalentCompanionCounts } from '@/lib/companion-status';

const talentNavItems = [
  { href: '/talent/home', labelKey: 'home', icon: '🏠' },
  { href: '/talent/coach', labelKey: 'coach', icon: '🎯' },
  { href: '/talent/seeking', labelKey: 'seeking', icon: '📊' },
  { href: '/talent/fair', labelKey: 'fair', icon: '🗺️' },
  { href: '/talent/inbox', labelKey: 'inbox', icon: '📬' },
];

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  let statusMessage: string | undefined;
  if (userId) {
    try {
      const { matchCount, inboxCount } = await getTalentCompanionCounts(userId);
      if (matchCount > 0 || inboxCount > 0) {
        statusMessage = `You have ${matchCount} new matches and ${inboxCount} new messages. Click to chat.`;
      }
    } catch {
      // Fall through to default message
    }
  }

  return (
    <div className="flex h-screen">
      <SidebarNav items={talentNavItems} variant="talent" />
      <main className="flex-1 overflow-auto p-6">
        <CompanionBar
          statusMessage={statusMessage}
          sessionTypes={['general', 'home', 'coach']}
        />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
