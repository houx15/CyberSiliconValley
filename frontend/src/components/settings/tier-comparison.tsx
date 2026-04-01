'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listTiers } from '@/lib/api/subscription';
import type { SubscriptionTier } from '@/lib/api/subscription';

interface TierComparisonProps {
  role: 'talent' | 'enterprise';
  currentTierId?: string;
}

const MOCK_TALENT_TIERS: SubscriptionTier[] = [
  {
    id: 'talent-basic',
    name: '基础版',
    role: 'talent',
    priceCents: 1000,
    currency: 'CNY',
    limits: { matchesPerDay: 5, preChatsPerDay: 1, coachSessionsPerDay: 3 },
    isActive: true,
  },
  {
    id: 'talent-mid',
    name: '进阶版',
    role: 'talent',
    priceCents: 5000,
    currency: 'CNY',
    limits: { matchesPerDay: 20, preChatsPerDay: 5, coachSessionsPerDay: 10 },
    isActive: true,
  },
  {
    id: 'talent-pro',
    name: 'Pro',
    role: 'talent',
    priceCents: 20000,
    currency: 'CNY',
    limits: { matchesPerDay: -1, preChatsPerDay: -1, coachSessionsPerDay: -1 },
    isActive: true,
  },
];

const MOCK_ENTERPRISE_TIERS: SubscriptionTier[] = [
  {
    id: 'ent-basic',
    name: '基础版',
    role: 'enterprise',
    priceCents: 20000,
    currency: 'CNY',
    limits: { jobPostings: 3, resumeScansPerDay: 50, preChatsPerDay: 5 },
    isActive: true,
  },
  {
    id: 'ent-plus',
    name: 'Plus',
    role: 'enterprise',
    priceCents: 50000,
    currency: 'CNY',
    limits: { jobPostings: 10, resumeScansPerDay: 200, preChatsPerDay: 20 },
    isActive: true,
  },
  {
    id: 'ent-pro',
    name: 'AI HR Pro',
    role: 'enterprise',
    priceCents: 200000,
    currency: 'CNY',
    limits: { jobPostings: 50, resumeScansPerDay: 1000, preChatsPerDay: 100 },
    isActive: true,
  },
  {
    id: 'ent-max',
    name: 'Max',
    role: 'enterprise',
    priceCents: 500000,
    currency: 'CNY',
    limits: { jobPostings: -1, resumeScansPerDay: -1, preChatsPerDay: -1 },
    isActive: true,
  },
];

function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(0)}`;
}

function formatLimit(value: number | undefined) {
  if (value === undefined) return '—';
  if (value === -1) return '无限';
  return String(value);
}

export function TierComparison({ role, currentTierId }: TierComparisonProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTiers(role)
      .then(setTiers)
      .catch(() => setTiers(role === 'talent' ? MOCK_TALENT_TIERS : MOCK_ENTERPRISE_TIERS))
      .finally(() => setLoading(false));
  }, [role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const limitKeys = role === 'talent'
    ? [
        { key: 'matchesPerDay' as const, label: '每日匹配数' },
        { key: 'preChatsPerDay' as const, label: '每日预沟通数' },
        { key: 'coachSessionsPerDay' as const, label: '每日教练对话数' },
      ]
    : [
        { key: 'jobPostings' as const, label: '职位发布数' },
        { key: 'resumeScansPerDay' as const, label: '每日简历扫描数' },
        { key: 'preChatsPerDay' as const, label: '每日预沟通数' },
      ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">套餐对比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-3', tiers.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
          {tiers.map((tier) => {
            const isCurrent = tier.id === currentTierId;
            return (
              <div
                key={tier.id}
                className={cn(
                  'relative rounded-xl border px-4 py-5',
                  isCurrent
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/50 bg-card/50'
                )}
              >
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-3 bg-primary text-primary-foreground">
                    当前
                  </Badge>
                )}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <p className="font-semibold text-foreground">{tier.name}</p>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {formatPrice(tier.priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">/月</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    {limitKeys.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-medium text-foreground">{formatLimit(tier.limits[key])}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant={isCurrent ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    disabled={isCurrent}
                  >
                    {isCurrent ? '当前套餐' : '升级'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
