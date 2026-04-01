'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { JobDetail } from '@/types/graph';

type JobDetailSheetProps = {
  jobId: string | null;
  keyword: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function JobDetailContent({
  detail,
  keyword,
}: {
  detail: JobDetail;
  keyword: string;
}) {
  const score = detail.matchScore;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{detail.title}</h2>
        <p className="text-sm text-muted-foreground">{detail.companyName}</p>
      </div>

      {score !== null && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={scoreTone(score)}>
            {score}%
          </Badge>
          <p className="text-sm text-muted-foreground">
            Match score for <span className="text-foreground">{keyword}</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <MetaItem label="Seniority" value={detail.seniority} />
        <MetaItem label="Work Mode" value={detail.workMode} />
        <MetaItem label="Budget" value={detail.budgetRange} />
        <MetaItem label="Timeline" value={detail.timeline} />
      </div>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Required Skills</h3>
        <div className="flex flex-wrap gap-1.5">
          {detail.skills.map((skill) => (
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
              <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">
                {skill.level}
              </span>
            </Badge>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Description</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {detail.description}
        </p>
      </section>

      {detail.deliverables ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Deliverables</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {detail.deliverables}
            </p>
          </section>
        </>
      ) : null}

      {detail.aiReasoning ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">AI Match Analysis</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {detail.aiReasoning}
            </p>
          </section>
        </>
      ) : null}

      {detail.matchBreakdown ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Score Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(detail.matchBreakdown).map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="min-w-24 flex-1 capitalize text-muted-foreground">
                    {label.replace(/_/g, ' ')}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        value >= 80
                          ? 'bg-emerald-400'
                          : value >= 60
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                      }`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Separator />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button className="w-full">Apply</Button>
        <Button variant="outline" className="w-full">
          Save
        </Button>
        <Button variant="secondary" className="w-full">
          Ask AI to Pre-chat
        </Button>
      </div>
    </div>
  );
}

export function JobDetailErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4 px-1 pt-8">
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
        <p className="font-medium">Unable to load job details.</p>
        <p className="mt-1 text-rose-100/80">{error}</p>
      </div>
      <Button variant="outline" className="w-full" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value || '—'}</p>
    </div>
  );
}

export default function JobDetailSheet({
  jobId,
  keyword,
  open,
  onOpenChange,
}: JobDetailSheetProps) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!open || !jobId) {
      setDetail(null);
      setLoading(false);
      setError(null);
      setRetryCount(0);
      return;
    }

    const currentJobId = jobId;
    const currentKeyword = keyword;
    const controller = new AbortController();

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/graph/${encodeURIComponent(currentKeyword)}/jobs?jobId=${encodeURIComponent(currentJobId)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Failed to load job ${currentJobId}`);
        }

        const payload = (await response.json()) as JobDetail;
        setDetail(payload);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to load job detail:', error);
        setDetail(null);
        setError('Failed to load job details.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDetail();
    return () => controller.abort();
  }, [jobId, keyword, open, retryCount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-slate-950 text-foreground sm:max-w-2xl">
        {loading ? (
          <div className="space-y-4 px-1 pt-8">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : error ? (
          <JobDetailErrorState
            error={error}
            onRetry={() => {
              setRetryCount((count) => count + 1);
            }}
          />
        ) : detail ? (
          <JobDetailContent detail={detail} keyword={keyword} />
        ) : (
          <div className="px-1 pt-8 text-sm text-muted-foreground">
            Select a job to see details.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
