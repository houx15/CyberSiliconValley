'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ActivityData {
  profilesScanned: number;
  matchesFound: number;
  preChatActive: number;
}

interface ActivityStatusProps {
  initial: ActivityData;
}

export function ActivityStatus({ initial }: ActivityStatusProps) {
  const [data, setData] = useState<ActivityData>(initial);

  // Poll every 30 seconds for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/jobs?_stats=1');
        if (res.ok) {
          const json = await res.json();
          if (json.stats) {
            setData(json.stats);
          }
        }
      } catch {
        // Silent fail — non-critical polling
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border border-border/50 bg-card/80 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {/* Pulse indicator */}
        <div className="relative flex h-3 w-3 items-center justify-center">
          <motion.span
            className="absolute h-3 w-3 rounded-full bg-green-500"
            animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="relative h-2 w-2 rounded-full bg-green-500" />
        </div>

        <span className="text-sm text-foreground">AI Agent Active</span>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Stats */}
        <div className="flex gap-6 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{data.profilesScanned}</strong> profiles
            scanned
          </span>
          <span>
            <strong className="font-medium text-foreground">{data.matchesFound}</strong> matches
            found
          </span>
          <span>
            <strong className="font-medium text-foreground">{data.preChatActive}</strong> pre-chats
            active
          </span>
        </div>
      </div>
    </div>
  );
}
