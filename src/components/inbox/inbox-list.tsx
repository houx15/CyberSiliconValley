'use client';

import { useState } from 'react';
import type { InboxFilter, InboxItemRow as InboxItemRowData } from '@/lib/inbox-shared';
import { INBOX_FILTER_TABS } from '@/lib/inbox-shared';
import { InboxDetail } from './inbox-detail';
import { InboxItemRow } from './inbox-item-row';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface InboxListProps {
  initialItems: InboxItemRowData[];
}

function filterItems(items: InboxItemRowData[], activeFilter: InboxFilter) {
  if (activeFilter === 'all') {
    return items;
  }

  const typeMap = {
    invites: 'invite',
    prechats: 'prechat_summary',
    matches: 'match_notification',
    system: 'system',
  } as const;

  return items.filter((item) => item.itemType === typeMap[activeFilter]);
}

export function InboxList({ initialItems }: InboxListProps) {
  const [items, setItems] = useState(initialItems);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const t = useTranslations('inbox');

  const filteredItems = filterItems(items, activeFilter);

  async function handleSelect(item: InboxItemRowData) {
    setSelectedId(item.id);

    if (item.read) {
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, read: true } : entry
      )
    );

    try {
      await fetch(`/api/v1/inbox/${item.id}`, { method: 'PATCH' });
    } catch {
      // Keep the optimistic update for demo mode.
    }
  }

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  return (
    <div className="flex h-full min-h-[560px] overflow-hidden rounded-2xl border border-border/60 bg-background">
      <div className="flex w-[380px] flex-col border-r border-border/60">
        <div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-4">
          {INBOX_FILTER_TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={activeFilter === tab.value ? 'default' : 'outline'}
              onClick={() => setActiveFilter(tab.value)}
            >
              {t(tab.labelKey)}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredItems.map((item) => (
                <InboxItemRow
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onClick={() => handleSelect(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20">
        {selectedItem ? (
          <InboxDetail item={selectedItem} />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {t('selectMessage')}
          </div>
        )}
      </div>
    </div>
  );
}
