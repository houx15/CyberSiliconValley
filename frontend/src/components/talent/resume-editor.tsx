'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, PenLine, Send, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ProfileEditor } from './profile-editor';
import type { Skill, Experience, Availability } from '@/types';
import { postSseJson } from '@/lib/api/sse';

type ResumeMode = 'ai' | 'manual';

interface ResumeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ResumeEditorProps {
  profile: {
    displayName: string;
    headline: string;
    bio: string;
    skills: Skill[];
    experience: Experience[];
    education: Array<{ institution: string; degree: string; field: string; year: string }>;
    goals: { targetRoles?: string[]; workPreferences?: string[] };
    availability: Availability;
    salaryRange: { min?: number; max?: number; currency?: string };
  };
}

export function ResumeEditor({ profile }: ResumeEditorProps) {
  const [mode, setMode] = useState<ResumeMode>('ai');

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
        <button
          onClick={() => setMode('ai')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            mode === 'ai'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bot className="h-4 w-4" />
          AI 模式
        </button>
        <button
          onClick={() => setMode('manual')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            mode === 'manual'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <PenLine className="h-4 w-4" />
          手工模式
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === 'ai' ? (
          <motion.div
            key="ai"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <AiResumeMode />
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ProfileEditor initial={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AiResumeMode() {
  const [messages, setMessages] = useState<ResumeMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'ready' | 'streaming'>('ready');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isLoading = status === 'streaming';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;

      const userMsg: ResumeMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
      const assistantId = `assistant-${Date.now()}`;
      const nextMessages = [...messages, userMsg];
      const controller = new AbortController();
      abortRef.current = controller;

      setMessages([...nextMessages, { id: assistantId, role: 'assistant', content: '' }]);
      setInput('');
      setStatus('streaming');

      void postSseJson(
        '/api/v1/talent/resume-ai',
        {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === 'text') {
              const delta = String(event.data.delta ?? '');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m
                )
              );
            }
            if (event.event === 'done') {
              const finalMessage = String(event.data.message ?? '');
              if (finalMessage) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: finalMessage } : m
                  )
                );
              }
              setStatus('ready');
              abortRef.current = null;
            }
          },
        }
      ).catch((err) => {
        if (!controller.signal.aborted) {
          const errorText = err instanceof Error ? err.message : '暂时无法连接 AI，请稍后重试。';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: errorText } : m
            )
          );
        }
        setStatus('ready');
        abortRef.current = null;
      });
    },
    [input, isLoading, messages]
  );

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-purple-400" />
          用对话更新你的简历
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          告诉 AI 你想更新什么，比如「我最近学了 Rust」「帮我优化项目描述」「加上我在字节的实习」
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80" ref={scrollRef}>
          <div className="space-y-3 pr-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  说点什么，AI 会帮你更新简历。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['我最近在做一个 RAG 项目', '帮我优化职业头衔', '添加新技能：Rust'].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/50 bg-muted/30 text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  思考中...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="shrink-0" title="上传文件">
            <Upload className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="告诉 AI 你想更新的内容..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
