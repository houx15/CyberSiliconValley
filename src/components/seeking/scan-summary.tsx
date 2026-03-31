'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ScanSummary as ScanSummaryData } from '@/lib/api/seeking';
import { useTranslations } from 'next-intl';

interface ScanSummaryProps {
  data: ScanSummaryData;
}

export function ScanSummary({ data }: ScanSummaryProps) {
  const t = useTranslations('seeking');

  return (
    <Card className="border-emerald-500/15 bg-gradient-to-br from-emerald-500/6 via-background to-background">
      <CardContent className="grid gap-5 py-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />
          </div>
          <span className="text-sm font-medium text-foreground">{t('title')}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-2xl font-semibold text-foreground">{data.totalScanned}</p>
            <p className="text-sm text-muted-foreground">{t('totalScanned')}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-emerald-700">{data.highMatches}</p>
            <p className="text-sm text-muted-foreground">{t('highMatches')}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-700">{data.mediumMatches}</p>
            <p className="text-sm text-muted-foreground">{t('mediumMatches')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
