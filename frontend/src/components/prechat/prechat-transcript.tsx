'use client';

import { motion } from 'framer-motion';
import { Bot, Building2, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PreChatMessage } from '@/lib/api/prechat';

interface PreChatTranscriptProps {
  messages: PreChatMessage[];
  maxRounds: number;
}

const SENDER_CONFIG = {
  ai_hr: { label: 'AI HR', icon: Bot, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ai_talent: { label: 'AI 伙伴', icon: Bot, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  human_enterprise: { label: '企业', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  human_talent: { label: '人才', icon: User, color: 'text-amber-400', bg: 'bg-amber-500/10' },
} as const;

export function PreChatTranscript({ messages, maxRounds }: PreChatTranscriptProps) {
  const currentRound = messages.length > 0 ? Math.max(...messages.map((m) => m.roundNumber)) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">对话记录</p>
        <p className="text-xs text-muted-foreground">
          第 {currentRound} / {maxRounds} 轮
        </p>
      </div>

      <ScrollArea className="h-96 rounded-lg border border-border/50 bg-muted/10 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => {
            const config = SENDER_CONFIG[msg.senderType];
            const Icon = config.icon;
            const isRight = msg.senderType === 'ai_hr' || msg.senderType === 'human_enterprise';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn('flex gap-2.5', isRight ? 'flex-row-reverse' : 'flex-row')}
              >
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', config.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', config.color)} />
                </div>
                <div className={cn('max-w-[75%] space-y-1', isRight ? 'items-end' : 'items-start')}>
                  <p className={cn('text-[11px] font-medium', config.color)}>{config.label}</p>
                  <div className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    isRight
                      ? 'bg-primary/10 text-foreground'
                      : 'border border-border/50 bg-card text-foreground'
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Round {msg.roundNumber}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
