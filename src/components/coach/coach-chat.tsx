'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Send } from 'lucide-react';
import CoachModeTabs from './coach-mode-tabs';
import GapAnalysisCard from './gap-analysis-card';
import BeforeAfterCard from './before-after-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CoachMode } from '@/types/graph';
import { postSseJson } from '@/lib/api/sse';

type CoachEmptyState = {
  title: string;
  description: string;
  placeholder: string;
};

type CoachPart =
  | { type: 'text'; text: string }
  | { type: 'tool-suggestSkill'; toolCallId: string; output: { suggestion?: { name?: string; reason?: string } } }
  | { type: 'tool-rewriteFocus'; toolCallId: string; output: { before?: string; after?: string } };

type CoachMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: CoachPart[];
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

function getMessageText(message: Pick<CoachMessage, 'parts'>): string {
  return message.parts
    .filter((part): part is Extract<CoachPart, { type: 'text' }> => part.type === 'text')
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

function getToolResultView(message: CoachMessage) {
  const toolParts = message.parts.filter(
    (part) => part.type === 'tool-suggestSkill' || part.type === 'tool-rewriteFocus'
  );

  return toolParts.flatMap((part) => {
    if (part.type === 'tool-suggestSkill') {
      const suggestionName = part.output.suggestion?.name || 'Suggested skill';
      const suggestionReason = part.output.suggestion?.reason || '';

      return [
        <div key={part.toolCallId} className="mt-3">
          <GapAnalysisCard skillName={suggestionName} reason={suggestionReason} />
        </div>,
      ];
    }

    if (part.type === 'tool-rewriteFocus') {
      return [
        <div key={part.toolCallId} className="mt-3">
          <BeforeAfterCard
            field="Suggested rewrite"
            before={part.output.before || 'Original wording'}
            after={part.output.after || 'Rewrite unavailable'}
          />
        </div>,
      ];
    }

    return [];
  });
}

function renderAssistantBlocks(message: CoachMessage) {
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
  setMessages: (messages: CoachMessage[]) => void,
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
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming'>('ready');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('ready');
  }, []);

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

            const nextMessages: CoachMessage[] = [
              ...messages,
              { id: `user-${Date.now()}`, role: 'user', parts: [{ type: 'text', text }] },
            ];
            const assistantId = `assistant-${Date.now()}`;
            const controller = new AbortController();
            abortRef.current = controller;
            setMessages([...nextMessages, { id: assistantId, role: 'assistant', parts: [] }]);
            setInput('');
            setStatus('submitted');

            void postSseJson(
              '/api/v1/coach',
              {
                mode,
                messages: nextMessages.map((message) => ({
                  role: message.role,
                  content: getMessageText(message),
                })),
              },
              {
                signal: controller.signal,
                onEvent: (streamEvent) => {
                  if (streamEvent.event === 'start') {
                    setStatus('streaming');
                    return;
                  }

                  if (streamEvent.event === 'tool') {
                    setMessages((prev) =>
                      prev.map((message) => {
                        if (message.id !== assistantId) {
                          return message;
                        }

                        if (streamEvent.data.name === 'suggest_skill') {
                          const suggestion = (streamEvent.data.suggestion ?? {}) as {
                            name?: string;
                            reason?: string;
                          };
                          return {
                            ...message,
                            parts: [
                              ...message.parts,
                              {
                                type: 'tool-suggestSkill',
                                toolCallId: `tool-${Date.now()}`,
                                output: {
                                  suggestion: {
                                    name: String(suggestion.name ?? 'Suggested skill'),
                                    reason: String(suggestion.reason ?? ''),
                                  },
                                },
                              },
                            ],
                          };
                        }

                        if (streamEvent.data.name === 'rewrite_focus') {
                          return {
                            ...message,
                            parts: [
                              ...message.parts,
                              {
                                type: 'tool-rewriteFocus',
                                toolCallId: `tool-${Date.now()}`,
                                output: {
                                  before: String(streamEvent.data.before ?? ''),
                                  after: String(streamEvent.data.after ?? ''),
                                },
                              },
                            ],
                          };
                        }

                        return message;
                      })
                    );
                    return;
                  }

                  if (streamEvent.event === 'text') {
                    const delta = String(streamEvent.data.delta ?? '');
                    setMessages((prev) =>
                      prev.map((message) => {
                        if (message.id !== assistantId) {
                          return message;
                        }

                        const currentText = getMessageText(message);
                        const nextTextPart: CoachPart = { type: 'text', text: `${currentText}${delta}` };
                        const nonTextParts = message.parts.filter((part) => part.type !== 'text');
                        return { ...message, parts: [nextTextPart, ...nonTextParts] };
                      })
                    );
                    return;
                  }

                  if (streamEvent.event === 'done') {
                    const finalMessage = String(streamEvent.data.message ?? '');
                    setMessages((prev) =>
                      prev.map((message) => {
                        if (message.id !== assistantId) {
                          return message;
                        }

                        const nonTextParts = message.parts.filter((part) => part.type !== 'text');
                        return {
                          ...message,
                          parts: [{ type: 'text', text: finalMessage || getMessageText(message) }, ...nonTextParts],
                        };
                      })
                    );
                    setStatus('ready');
                    if (abortRef.current === controller) {
                      abortRef.current = null;
                    }
                  }
                },
              }
            ).catch((error) => {
              if (!controller.signal.aborted) {
                const errorText = error instanceof Error ? error.message : 'Unable to reach the coach right now.';
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, parts: [{ type: 'text', text: errorText }] } : message
                  )
                );
              }
              setStatus('ready');
              if (abortRef.current === controller) {
                abortRef.current = null;
              }
            });
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
