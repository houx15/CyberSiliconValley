'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { motion } from 'framer-motion';
import { Loader2, Send } from 'lucide-react';
import CoachModeTabs from './coach-mode-tabs';
import GapAnalysisCard from './gap-analysis-card';
import BeforeAfterCard from './before-after-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CoachMode } from '@/types/graph';

type CoachEmptyState = {
  title: string;
  description: string;
  placeholder: string;
};

const EMPTY_STATE_COPY: Record<CoachMode, CoachEmptyState> = {
  chat: {
    title: 'Chat with your AI career coach',
    description: 'Ask for direction on roles, positioning, interview prep, or next steps.',
    placeholder: 'Ask your coach anything...',
  },
  'resume-review': {
    title: 'Review your profile and resume',
    description: 'Get sharper wording, stronger impact, and clearer positioning.',
    placeholder: 'Paste text to review or ask for feedback...',
  },
  'mock-interview': {
    title: 'Practice with a realistic mock interview',
    description: 'Work through technical, behavioral, and role-fit questions.',
    placeholder: 'Answer the interview question...',
  },
  'skill-gaps': {
    title: 'Discover the skills to close the gap',
    description: 'Get ranked skill recommendations based on the market and your goals.',
    placeholder: 'Ask about skills you should develop...',
  },
};

function getMessageText(message: Pick<UIMessage, 'parts'>): string {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function splitBeforeAfterBlocks(text: string) {
  const pattern =
    /(?:^|\n)\s*(?:[-*]\s*)?BEFORE:\s*([\s\S]+?)\n\s*(?:[-*]\s*)?AFTER:\s*([\s\S]+?)(?=(?:\n\s*(?:[-*]\s*)?BEFORE:)|$)/gm;
  const blocks: Array<{ before: string; after: string; index: number; length: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    blocks.push({
      before: match[1]!.trim(),
      after: match[2]!.trim(),
      index: match.index,
      length: match[0].length,
    });
  }

  return blocks;
}

function getToolResultView(message: UIMessage) {
  const toolParts = message.parts.filter(
    (part) =>
      part.type === 'tool-suggestSkill' ||
      part.type === 'tool-updateProfileField'
  );

  return toolParts.flatMap((part) => {
    if (part.type === 'tool-suggestSkill' && part.state === 'output-available') {
      const result = part.output as {
        success?: boolean;
        suggestion?: { name?: string; reason?: string };
        message?: string;
      };
      const suggestionName = result.suggestion?.name || 'Suggested skill';
      const suggestionReason = result.suggestion?.reason || result.message || '';

      return [
        <div key={part.toolCallId} className="mt-3">
          <GapAnalysisCard skillName={suggestionName} reason={suggestionReason} />
        </div>,
      ];
    }

    if (part.type === 'tool-updateProfileField' && part.state === 'output-available') {
      const field = typeof part.input === 'object' && part.input && 'field' in part.input
        ? String((part.input as { field?: unknown }).field ?? 'Profile update')
        : 'Profile update';
      const value = typeof part.input === 'object' && part.input && 'value' in part.input
        ? (part.input as { value?: unknown }).value
        : undefined;
      const after = typeof value === 'string' ? value : JSON.stringify(value ?? {});
      const result = part.output as { message?: string; success?: boolean } | undefined;
      const before = result?.message ? `Coach approved: ${result.message}` : 'Profile change prepared for review.';

      return [
        <div key={part.toolCallId} className="mt-3">
          <BeforeAfterCard field={field} before={before} after={after} />
        </div>,
      ];
    }

    return [];
  });
}

function renderAssistantBlocks(message: UIMessage) {
  const text = getMessageText(message);
  const beforeAfterBlocks = splitBeforeAfterBlocks(text);

  if (beforeAfterBlocks.length === 0) {
    return <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{text}</p>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  beforeAfterBlocks.forEach((block, index) => {
    if (block.index > cursor) {
      nodes.push(
        <p key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
          {text.slice(cursor, block.index)}
        </p>
      );
    }

    nodes.push(
      <BeforeAfterCard
        key={`before-after-${index}`}
        field="Suggested rewrite"
        before={block.before}
        after={block.after}
      />
    );
    cursor = block.index + block.length;
  });

  if (cursor < text.length) {
    nodes.push(
      <p key="text-tail" className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
        {text.slice(cursor)}
      </p>
    );
  }

  return <div className="space-y-3">{nodes}</div>;
}

export function resetCoachConversation(
  stop: () => void,
  setMode: (mode: CoachMode) => void,
  setMessages: (messages: UIMessage[]) => void,
  setInput: (value: string) => void,
  nextMode: CoachMode
) {
  stop();
  setMode(nextMode);
  setMessages([]);
  setInput('');
}

export default function CoachChat() {
  const [mode, setMode] = useState<CoachMode>('chat');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/internal/ai/coach',
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const emptyState = EMPTY_STATE_COPY[mode];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-background/80">
      <div className="border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              AI Coach
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              Career guidance that can rewrite, recommend, and rehearse with you
            </h1>
          </div>
          <CoachModeTabs
            mode={mode}
            onModeChange={(nextMode) => {
              resetCoachConversation(stop, setMode, setMessages, setInput, nextMode);
            }}
          />
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="text-lg font-medium text-foreground">{emptyState.title}</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {emptyState.description}
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const toolViews = getToolResultView(message);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/60 bg-card text-card-foreground shadow-sm'
                  }`}
                >
                  {message.role === 'user'
                    ? getMessageText(message)
                    : renderAssistantBlocks(message)}
                  {toolViews.length > 0 ? <div className="space-y-3">{toolViews}</div> : null}
                </div>
              </motion.div>
            );
          })}

          {isLoading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking...
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 px-4 py-4 sm:px-6">
        <form
          className="mx-auto flex w-full max-w-4xl items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = input.trim();
            if (!text || isLoading) {
              return;
            }

            sendMessage({ text }, { body: { mode } });
            setInput('');
          }}
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={emptyState.placeholder}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export { getMessageText, renderAssistantBlocks, splitBeforeAfterBlocks };
