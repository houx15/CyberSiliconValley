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
import { MapPin, Briefcase, Clock, DollarSign, MessageSquare, Bookmark, Send } from 'lucide-react';
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
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{detail.title}</h2>
        <p className="text-sm font-medium text-muted-foreground">{detail.companyName}</p>
        {score !== null && (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={scoreTone(score)}>
              {score}% 匹配
            </Badge>
            <p className="text-xs text-muted-foreground">
              基于「{keyword}」的匹配分析
            </p>
          </div>
        )}
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetaItem icon={Briefcase} label="资历要求" value={detail.seniority} />
        <MetaItem icon={MapPin} label="工作模式" value={detail.workMode} />
        <MetaItem icon={DollarSign} label="预算范围" value={detail.budgetRange} />
        <MetaItem icon={Clock} label="时间线" value={detail.timeline} />
      </div>

      <Separator />

      {/* Skills */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">所需技能</h3>
        <div className="flex flex-wrap gap-1.5">
          {detail.skills.map((skill) => (
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
              <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">
                {skill.level}
              </span>
            </Badge>
          ))}
        </div>
      </section>

      <Separator />

      {/* Description */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">职位描述</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {detail.description}
        </p>
      </section>

      {/* Deliverables */}
      {detail.deliverables ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">交付物</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {detail.deliverables}
            </p>
          </section>
        </>
      ) : null}

      {/* AI Analysis */}
      {detail.aiReasoning ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">AI 匹配分析</h3>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">
                {detail.aiReasoning}
              </p>
            </div>
          </section>
        </>
      ) : null}

      {/* Score Breakdown */}
      {detail.matchBreakdown ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">分数明细</h3>
            <div className="space-y-2">
              {Object.entries(detail.matchBreakdown).map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="min-w-24 flex-1 capitalize text-muted-foreground">
                    {label.replace(/_/g, ' ')}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
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
                  <span className="w-8 text-right font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Separator />

      {/* Actions */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button className="w-full gap-2">
          <Send className="h-3.5 w-3.5" />
          申请
        </Button>
        <Button variant="outline" className="w-full gap-2">
          <Bookmark className="h-3.5 w-3.5" />
          收藏
        </Button>
        <Button variant="secondary" className="w-full gap-2">
          <MessageSquare className="h-3.5 w-3.5" />
          AI 预沟通
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
        <p className="font-medium">无法加载职位详情</p>
        <p className="mt-1 text-rose-100/80">{error}</p>
      </div>
      <Button variant="outline" className="w-full" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/30 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || '—'}</p>
      </div>
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
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to load job detail:', err);
        setDetail(null);
        setError('加载职位详情失败');
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
      <SheetContent className="w-full overflow-y-auto bg-background text-foreground sm:max-w-2xl">
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
            选择一个职位查看详情
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
