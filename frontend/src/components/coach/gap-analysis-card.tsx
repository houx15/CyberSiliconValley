'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GapAnalysisCardProps {
  skillName: string;
  reason: string;
  priority?: 'Critical' | 'Important' | 'Nice-to-have';
}

const PRIORITY_STYLES: Record<NonNullable<GapAnalysisCardProps['priority']>, string> = {
  Critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  Important: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'Nice-to-have': 'border-sky-500/30 bg-sky-500/10 text-sky-200',
};

export default function GapAnalysisCard({
  skillName,
  reason,
  priority = 'Important',
}: GapAnalysisCardProps) {
  return (
    <Card className="border-l-2 border-l-primary/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{skillName}</CardTitle>
          <Badge variant="outline" className={PRIORITY_STYLES[priority]}>
            {priority}
          </Badge>
        </div>
        <CardDescription className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
          Skill gap analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-6 text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  );
}
