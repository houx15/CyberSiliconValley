'use client';

import { FileClock } from 'lucide-react';
import { motion } from 'framer-motion';

export function NoReport() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center"
    >
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
          <FileClock className="h-7 w-7 text-muted-foreground" />
        </div>
        <motion.span
          animate={{ rotate: [0, 16, 0, -16, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-sky-500 shadow-lg"
        />
      </div>
      <h3 className="text-lg font-semibold text-foreground">报告生成中...</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Your first seeking report is still being assembled. We are grouping
        matches, pre-chat signals, and market movement into one briefing.
      </p>
    </motion.div>
  );
}
