'use client';

import { Badge } from '@/components/ui/badge';
import type { InboxItemRow as InboxItemRowData } from '@/lib/inbox-shared';
import { useTranslations } from 'next-intl';

const ITEM_STYLES: Record<string, string> = {
  invite: 'border-l-sky-500',
  prechat_summary: 'border-l-violet-500',
  match_notification: 'border-l-emerald-500',
  system: 'border-l-slate-400',
};

function formatRelativeTime(value: string) {
  const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  return formatter.format(Math.round(diffHours / 24), 'day');
}

interface InboxItemRowProps {
  item: InboxItemRowData;
  isSelected: boolean;
  onClick: () => void;
}

export function InboxItemRow({ item, isSelected, onClick }: InboxItemRowProps) {
  const t = useTranslations('inbox');
  const score =
    typeof item.content.matchScore === 'number'
      ? item.content.matchScore
      : undefined;

  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors',
        ITEM_STYLES[item.itemType] ?? 'border-l-slate-400',
        isSelected ? 'bg-accent' : 'hover:bg-muted/60',
        !item.read ? 'bg-muted/30' : '',
      ].join(' ')}
    >
      <div className="pt-1">
        {item.read ? (
          <div className="h-2 w-2" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`truncate text-sm ${item.read ? 'font-medium' : 'font-semibold'}`}>
              {item.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{t(`type.${item.itemType}`)}</Badge>
              <span>{formatRelativeTime(item.createdAt)}</span>
            </div>
          </div>
          {typeof score === 'number' && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700">
              {score}%
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
