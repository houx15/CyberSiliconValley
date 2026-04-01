'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, MessageSquare } from 'lucide-react';
import type { ClusterJob } from '@/types/graph';

type CompanyCardProps = {
  job: ClusterJob;
  onClick: (jobId: string) => void;
};

function scoreTone(score: number) {
  if (score >= 80) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }

  if (score >= 60) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }

  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

const WORK_MODE_LABELS: Record<string, string> = {
  remote: '远程',
  onsite: '现场',
  hybrid: '混合',
};

export default function CompanyCard({ job, onClick }: CompanyCardProps) {
  return (
    <button
      type="button"
      className="group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => onClick(job.id)}
    >
      <Card className="border-border/40 bg-card/60 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-card/90 group-hover:shadow-lg group-hover:shadow-primary/5">
        <CardContent className="space-y-3 p-4">
          {/* Header: Company + Score */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {job.companyName}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{job.title}</p>
            </div>

            {job.matchScore !== null && (
              <Badge variant="outline" className={scoreTone(job.matchScore)}>
                {job.matchScore}%
              </Badge>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {WORK_MODE_LABELS[job.workMode] || job.workMode}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((skill) => (
              <Badge
                key={skill.name}
                variant="outline"
                className={
                  skill.required
                    ? 'border-primary/40 text-primary'
                    : 'border-border/40 text-muted-foreground'
                }
              >
                {skill.required && <span className="mr-0.5 text-[10px]">*</span>}
                {skill.name}
              </Badge>
            ))}
            {job.skills.length > 4 && (
              <Badge variant="outline" className="border-border/40 text-muted-foreground">
                +{job.skills.length - 4}
              </Badge>
            )}
          </div>

          {/* Quick action hint */}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
            <MessageSquare className="h-3 w-3" />
            点击查看详情 · 发起 AI 预沟通
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
