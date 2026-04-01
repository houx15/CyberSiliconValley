'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function CompanyCard({ job, onClick }: CompanyCardProps) {
  return (
    <button
      type="button"
      className="group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      onClick={() => onClick(job.id)}
    >
      <Card className="border-white/10 bg-slate-950/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-sky-400/40 group-hover:bg-slate-950/90">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {job.companyName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{job.title}</p>
            </div>

            {job.matchScore !== null && (
              <Badge variant="outline" className={scoreTone(job.matchScore)}>
                {job.matchScore}%
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{job.workMode}</span>
            <span>·</span>
            <span>{job.location}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((skill) => (
              <Badge
                key={skill.name}
                variant="outline"
                className={
                  skill.required
                    ? 'border-sky-400/40 text-sky-300'
                    : 'border-white/10 text-muted-foreground'
                }
              >
                {skill.required && <span className="mr-0.5">✱</span>}
                {skill.name}
              </Badge>
            ))}
            {job.skills.length > 4 && (
              <Badge variant="outline" className="border-white/10 text-muted-foreground">
                +{job.skills.length - 4}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
