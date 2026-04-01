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
import { MapPin, Briefcase, Clock, DollarSign, MessageSquare, Bookmark, Send, Building2, Star } from 'lucide-react';
import type { JobDetail } from '@/types/graph';

type JobDetailSheetProps = {
  jobId: string | null;
  keyword: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (score >= 60) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

const WORK_MODE_ZH: Record<string, string> = {
  remote: '远程',
  onsite: '现场',
  hybrid: '混合',
};

export function JobDetailContent({
  detail,
  keyword,
}: {
  detail: JobDetail;
  keyword: string;
}) {
  const score = detail.matchScore;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {detail.companyName}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{detail.title}</h2>

          {score !== null && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={`text-sm px-3 py-1 ${scoreTone(score)}`}>
                <Star className="mr-1 h-3.5 w-3.5" />
                {score}% 匹配
              </Badge>
              {keyword && (
                <span className="text-xs text-muted-foreground">
                  基于「{keyword}」
                </span>
              )}
            </div>
          )}
        </div>

        {/* Meta info - horizontal chips */}
        <div className="flex flex-wrap gap-2">
          {detail.seniority && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Briefcase className="h-3 w-3" />
              {detail.seniority}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 text-xs">
            <MapPin className="h-3 w-3" />
            {detail.location} · {WORK_MODE_ZH[detail.workMode] || detail.workMode}
          </Badge>
          {detail.budgetRange && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <DollarSign className="h-3 w-3" />
              {detail.budgetRange}
            </Badge>
          )}
          {detail.timeline && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {detail.timeline}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Skills */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">技能要求</h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.skills.map((skill) => (
              <Badge
                key={skill.name}
                variant="outline"
                className={
                  skill.required
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border/40 text-muted-foreground'
                }
              >
                {skill.required && <span className="mr-0.5 text-[10px]">*</span>}
                {skill.name}
                <span className="ml-1 text-[10px] opacity-50">{skill.level}</span>
              </Badge>
            ))}
          </div>
        </section>

        {/* Description */}
        {detail.description && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">机会描述</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {detail.description}
              </p>
            </section>
          </>
        )}

        {/* Deliverables */}
        {detail.deliverables && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">交付物</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {detail.deliverables}
              </p>
            </section>
          </>
        )}

        {/* AI Analysis */}
        {detail.aiReasoning && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">AI 匹配分析</h3>
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {detail.aiReasoning}
                </p>
              </div>
            </section>
          </>
        )}

        {/* Score Breakdown */}
        {detail.matchBreakdown && Object.keys(detail.matchBreakdown).length > 0 && (
          <>
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">匹配维度</h3>
              <div className="space-y-2.5">
                {Object.entries(detail.matchBreakdown).map(([label, value]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">
                        {label.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-foreground">{value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          value >= 80
                            ? 'bg-emerald-400'
                            : value >= 60
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="border-t border-border/50 bg-background pt-4">
        <div className="flex gap-2">
          <Button className="flex-1 gap-2">
            <Send className="h-4 w-4" />
            一键投递
          </Button>
          <Button variant="secondary" className="flex-1 gap-2">
            <MessageSquare className="h-4 w-4" />
            AI 预沟通
          </Button>
          <Button variant="outline" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
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
        <p className="font-medium">无法加载机会详情</p>
        <p className="mt-1 text-rose-100/80">{error}</p>
      </div>
      <Button variant="outline" className="w-full" onClick={onRetry}>
        重试
      </Button>
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

    const controller = new AbortController();

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        // Use keyword-based URL if available, otherwise use "all" as fallback
        const kw = keyword || 'all';
        const response = await fetch(
          `/api/v1/graph/${encodeURIComponent(kw)}/jobs?jobId=${encodeURIComponent(jobId!)}`,
          { signal: controller.signal, credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error(`加载失败 (${response.status})`);
        }

        const payload = (await response.json()) as JobDetail;
        setDetail(payload);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load job detail:', err);
        setDetail(null);
        setError('加载机会详情失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDetail();
    return () => controller.abort();
  }, [jobId, keyword, open, retryCount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden bg-background p-6 text-foreground sm:max-w-xl">
        {loading ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-8 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <JobDetailErrorState
            error={error}
            onRetry={() => setRetryCount((c) => c + 1)}
          />
        ) : detail ? (
          <JobDetailContent detail={detail} keyword={keyword} />
        ) : (
          <div className="pt-8 text-center text-sm text-muted-foreground">
            选择一个机会查看详情
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
