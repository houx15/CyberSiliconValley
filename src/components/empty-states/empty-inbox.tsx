'use client';

import { Inbox } from 'lucide-react';
import { motion } from 'framer-motion';

export function EmptyInbox() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
        <Inbox className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">还没有消息</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        No messages yet. Your AI companion will start surfacing matches, invites,
        and market signals here as soon as new activity arrives.
      </p>
    </motion.div>
  );
}
