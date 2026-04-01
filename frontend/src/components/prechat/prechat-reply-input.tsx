'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { sendHumanReply } from '@/lib/api/prechat';

interface PreChatReplyInputProps {
  preChatId: string;
  onSent?: () => void;
  disabled?: boolean;
}

export function PreChatReplyInput({ preChatId, onSent, disabled }: PreChatReplyInputProps) {
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    startTransition(async () => {
      try {
        await sendHumanReply(preChatId, text);
        setContent('');
        onSent?.();
      } catch {
        // Error handling — the API client will throw
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入你的回复，补充 AI 可能遗漏的信息..."
        disabled={disabled || isPending}
        rows={2}
        className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <Button type="submit" size="icon" disabled={disabled || isPending || !content.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
