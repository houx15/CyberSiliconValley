'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock, XCircle, MessageSquare } from 'lucide-react';
import type { PreChatStatus } from '@/lib/api/prechat';

interface PreChatSummaryCardProps {
  jobTitle: string;
  companyName: string;
  status: PreChatStatus;
  roundCount: number;
  maxRounds: number;
  summary: string | null;
  conversationId?: string;
  role?: 'talent' | 'enterprise';
  onViewTranscript?: () => void;
}

const STATUS_CONFIG: Record<PreChatStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending_talent_opt_in: { label: '等待人才确认', icon: Clock, color: 'bg-amber-500/10 text-amber-500' },
  pending_enterprise_opt_in: { label: '等待企业确认', icon: Clock, color: 'bg-amber-500/10 text-amber-500' },
  active: { label: '进行中', icon: Clock, color: 'bg-blue-500/10 text-blue-500' },
  completed: { label: '已完成', icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-500' },
  declined: { label: '已拒绝', icon: XCircle, color: 'bg-rose-500/10 text-rose-500' },
};

export function PreChatSummaryCard({
  jobTitle,
  companyName,
  status,
  roundCount,
  maxRounds,
  summary,
  conversationId,
  role = 'talent',
  onViewTranscript,
}: PreChatSummaryCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm">{jobTitle}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{companyName}</p>
          </div>
          <Badge className={statusConfig.color}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>对话轮次: {roundCount}/{maxRounds}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(roundCount / maxRounds) * 100}%` }}
            />
          </div>
        </div>

        {summary && (
          <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">AI 摘要</span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/80">{summary}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {onViewTranscript && (
            <button
              onClick={onViewTranscript}
              className="text-xs font-medium text-primary hover:underline"
            >
              查看完整对话记录 →
            </button>
          )}

          {conversationId && status === 'completed' && (
            <Link href={`/${role}/conversations?id=${conversationId}`}>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <MessageSquare className="h-3 w-3" />
                继续对话
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
