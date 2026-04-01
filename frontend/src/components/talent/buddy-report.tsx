'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MessageSquare, Mail, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { TalentHomeStats } from '@/lib/api/talent-dashboard';

interface BuddyReportProps {
  stats: TalentHomeStats;
  displayName: string;
}

export function BuddyReport({ stats, displayName }: BuddyReportProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/10">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">AI 伙伴报告</span>
          </div>

          <p className="text-sm leading-relaxed text-foreground/80">
            {displayName}，你的 AI 伙伴已为你探索了{' '}
            <span className="font-semibold text-foreground">{stats.companiesExplored}</span>{' '}
            家企业，发现{' '}
            <Link href="/talent/buddy" className="font-semibold text-primary hover:underline">
              {stats.matchesFound} 个匹配机会
            </Link>
            。目前有{' '}
            <span className="font-semibold text-foreground">{stats.preChatsActive}</span>{' '}
            个预沟通正在进行，
            <span className="font-semibold text-foreground">{stats.invitesReceived}</span>{' '}
            份企业邀请待查看。
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Link
              href="/talent/buddy"
              className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 transition-colors hover:bg-accent/50"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">{stats.matchesFound}</p>
                <p className="text-[11px] text-muted-foreground">匹配机会</p>
              </div>
            </Link>
            <div className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">{stats.preChatsActive}</p>
                <p className="text-[11px] text-muted-foreground">预沟通中</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">{stats.invitesReceived}</p>
                <p className="text-[11px] text-muted-foreground">待处理邀请</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
