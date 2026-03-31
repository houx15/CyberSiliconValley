'use client';

import { ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeAfterCardProps {
  field: string;
  before: string;
  after: string;
}

export default function BeforeAfterCard({ field, before, after }: BeforeAfterCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{field}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">
            Before
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{before}</p>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="size-4 text-muted-foreground/70" />
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            After
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{after}</p>
        </div>
      </CardContent>
    </Card>
  );
}
