'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface CompanionBarProps {
  statusMessage?: string;
}

export function CompanionBar({ statusMessage }: CompanionBarProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations('companion');

  return (
    <div
      className="cursor-pointer rounded-lg border border-border/50 bg-accent/30 px-4 py-3 transition-colors hover:bg-accent/50"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-purple-500 opacity-80" />
          <span className="text-sm text-muted-foreground">
            {statusMessage || t('collapsed')}
          </span>
        </div>
        <span className="text-muted-foreground">{expanded ? '⌃' : '⌄'}</span>
      </div>
      {expanded && (
        <div className="mt-4 border-t border-border/50 pt-4">
          <p className="text-sm text-muted-foreground">
            AI companion chat will be implemented in feature specs.
          </p>
        </div>
      )}
    </div>
  );
}
