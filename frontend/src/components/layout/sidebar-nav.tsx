'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  Sparkles,
  BarChart3,
  Store,
  LayoutDashboard,
  Briefcase,
  Users,
  UserRound,
  Bot,
  MessageSquare,
  Building2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InboxBadge } from '@/components/inbox/inbox-badge';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  sparkles: Sparkles,
  'bar-chart': BarChart3,
  store: Store,
  dashboard: LayoutDashboard,
  briefcase: Briefcase,
  users: Users,
  'user-round': UserRound,
  bot: Bot,
  'message-square': MessageSquare,
  building: Building2,
  settings: Settings,
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  badge?: number;
}

interface SidebarNavProps {
  items: NavItem[];
  variant: 'talent' | 'enterprise';
}

export function SidebarNav({ items, variant }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const settingsHref = variant === 'talent' ? '/talent/settings' : '/enterprise/settings';

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border/50 bg-background px-4 py-5">
      <div className="mb-6 px-3">
        <span className="text-lg font-bold text-primary">CSV</span>
        {variant === 'enterprise' && (
          <span className="ml-2 text-xs text-muted-foreground">Enterprise</span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = ICON_MAP[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{t(item.labelKey)}</span>
              <div className="ml-auto">
                <InboxBadge count={item.badge} />
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border/50 pt-4">
        <Link
          href={settingsHref}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-xs transition-colors',
            pathname.startsWith(settingsHref)
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>{t('settings')}</span>
        </Link>
      </div>
    </aside>
  );
}
