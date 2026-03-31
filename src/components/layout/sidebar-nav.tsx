'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { InboxBadge } from '@/components/inbox/inbox-badge';

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
              <span>{item.icon}</span>
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
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <span>⚙️</span>
          <span>{t('settings')}</span>
        </Link>
      </div>
    </aside>
  );
}
