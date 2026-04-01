'use client';

import { Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function NoMatches() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center"
    >
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
          <Search className="h-7 w-7 text-muted-foreground" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.9, 0.45, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </motion.div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">AI 正在扫描市场...</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Your companion is still mapping the market and ranking new opportunities.
        This usually fills in shortly after your profile and embeddings are ready.
      </p>
    </motion.div>
  );
}
