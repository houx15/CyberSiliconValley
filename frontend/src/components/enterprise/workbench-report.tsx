'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSearch, Users, MessageSquare, CalendarCheck, Briefcase } from 'lucide-react';
import Link from 'next/link';
import type { WorkbenchStats } from '@/lib/api/enterprise-dashboard';

interface WorkbenchReportProps {
  stats: WorkbenchStats;
}

function StatLink({ value, label, href }: { value: number; label: string; href?: string }) {
  const content = (
    <>
      <span className="text-lg font-bold text-primary">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-baseline gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent/50">
        {content}
      </Link>
    );
  }

  return <span className="flex items-baseline gap-1.5 px-2 py-1">{content}</span>;
}

export function WorkbenchReport({ stats }: WorkbenchReportProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* AI HR Recruitment Report */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <FileSearch className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-sm font-semibold">AI HR 招聘报告</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground/80">
              主动扫描简历
              <StatLink value={stats.resumesScanned} label="份" />
              ，初步匹配
              <StatLink value={stats.preliminaryMatches} label="份" href="/enterprise/talent" />
              ，预沟通完成
              <StatLink value={stats.preChatCompleted} label="人" />
              。已发送面试邀请
              <StatLink value={stats.invitesSent} label="份" />
              ，其中
              <StatLink value={stats.invitesAccepted} label="人" />
              已接受，
              <StatLink value={stats.interviewsScheduled} label="场" />
              面试已安排。
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Talent Pool Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-sm font-semibold">人才池概览</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.activeJobs}</p>
                  <p className="text-xs text-muted-foreground">活跃职位</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.talentPoolSize}</p>
                  <p className="text-xs text-muted-foreground">人才池规模</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.preChatCompleted}</p>
                  <p className="text-xs text-muted-foreground">预沟通完成</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.interviewsScheduled}</p>
                  <p className="text-xs text-muted-foreground">待面试</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
