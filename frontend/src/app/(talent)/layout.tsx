import { SidebarNav } from '@/components/layout/sidebar-nav';
import { AiFab } from '@/components/ai/ai-fab';

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const talentNavItems = [
    { href: '/talent/home', labelKey: 'home', icon: 'home' },
    { href: '/talent/buddy', labelKey: 'buddy', icon: 'user-round' },
    { href: '/talent/coach', labelKey: 'coach', icon: 'sparkles' },
    { href: '/talent/conversations', labelKey: 'conversations', icon: 'building' },
    { href: '/talent/fair', labelKey: 'fair', icon: 'store' },
  ];

  return (
    <div className="flex h-screen">
      <SidebarNav items={talentNavItems} variant="talent" />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
      <AiFab persona="buddy" />
    </div>
  );
}
