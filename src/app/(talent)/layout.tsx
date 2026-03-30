import { SidebarNav } from '@/components/layout/sidebar-nav';
import { CompanionBar } from '@/components/layout/companion-bar';

const talentNavItems = [
  { href: '/talent/home', labelKey: 'home', icon: '🏠' },
  { href: '/talent/coach', labelKey: 'coach', icon: '🎯' },
  { href: '/talent/seeking', labelKey: 'seeking', icon: '📊' },
  { href: '/talent/fair', labelKey: 'fair', icon: '🗺️' },
  { href: '/talent/inbox', labelKey: 'inbox', icon: '📬' },
];

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <SidebarNav items={talentNavItems} variant="talent" />
      <main className="flex-1 overflow-auto p-6">
        <CompanionBar />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
