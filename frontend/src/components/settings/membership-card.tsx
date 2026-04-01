'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface MembershipCardProps {
  tier: string;
  variant: 'talent' | 'enterprise';
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: '免费版', color: 'bg-muted text-muted-foreground' },
  basic: { label: '基础版', color: 'bg-blue-500/10 text-blue-500' },
  plus: { label: 'Plus', color: 'bg-purple-500/10 text-purple-400' },
  pro: { label: 'Pro', color: 'bg-amber-500/10 text-amber-500' },
  max: { label: 'Max', color: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-orange-500' },
};

export function MembershipCard({ tier, variant }: MembershipCardProps) {
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.free!;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">会员等级</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 rounded-lg border border-border/50 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">当前等级</p>
              <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {variant === 'talent' ? '升级解锁更多匹配和教练功能' : '升级解锁更多招聘和筛选功能'}
            </p>
          </div>
          <button className="rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/50">
            查看套餐
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
