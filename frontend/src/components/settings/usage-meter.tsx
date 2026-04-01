'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUsage } from '@/lib/api/subscription';
import type { UsageData } from '@/lib/api/subscription';

interface UsageMeterProps {
  variant: 'talent' | 'enterprise';
}

const MOCK_USAGE: UsageData = {
  matchesToday: 3,
  matchesLimit: 5,
  preChatsToday: 0,
  preChatsLimit: 1,
  coachToday: 2,
  coachLimit: 3,
};

function MeterBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isUnlimited = limit === -1;
  const isNearLimit = !isUnlimited && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', isNearLimit ? 'text-amber-500' : 'text-foreground')}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isUnlimited
              ? 'bg-emerald-500'
              : pct >= 90
                ? 'bg-rose-500'
                : pct >= 70
                  ? 'bg-amber-500'
                  : 'bg-primary'
          )}
          style={{ width: isUnlimited ? '10%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsageMeter({ variant }: UsageMeterProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsage()
      .then(setUsage)
      .catch(() => setUsage(MOCK_USAGE))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">今日用量</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !usage ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <MeterBar used={usage.matchesToday} limit={usage.matchesLimit} label="匹配查看" />
            <MeterBar used={usage.preChatsToday} limit={usage.preChatsLimit} label="预沟通" />
            {variant === 'talent' && (
              <MeterBar used={usage.coachToday} limit={usage.coachLimit} label="教练对话" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
