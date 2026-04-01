'use client';

import Link from 'next/link';
import { BriefcaseBusiness } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function EmptyJobs() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
        <BriefcaseBusiness className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">还没有发布机会</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        发布你的第一个机会——可以是全职岗位、项目合作、实习或顾问需求。
        平台会自动开始匹配人才、计算匹配分数。
      </p>
      <Link href="/enterprise/jobs/new" className="mt-6">
        <Button>发布机会</Button>
      </Link>
    </motion.div>
  );
}
