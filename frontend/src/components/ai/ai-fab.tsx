'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, UserRound, X, Send, Maximize2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { postSseJson } from '@/lib/api/sse';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiFabProps {
  persona: 'buddy' | 'ai-hr';
}

export function AiFab({ persona }: AiFabProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pathname = usePathname();
  const fullPageHref = persona === 'buddy' ? '/talent/buddy' : '/enterprise/ai-hr';
  const label = persona === 'buddy' ? 'AI 伙伴' : 'AI HR';
  const gradientClass = persona === 'ai-hr'
    ? 'from-emerald-600 to-teal-500'
    : 'from-primary to-purple-500';

  // Hide on dedicated AI pages
  const hideRoutes = ['/talent/buddy', '/talent/coach', '/enterprise/ai-hr'];
  const hidden = hideRoutes.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      await postSseJson(
        '/api/v1/companion',
        {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          persona,
        },
        {
          onEvent: (event) => {
            if (event.event === 'text') {
              const delta = String(event.data.delta ?? '');
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${delta}` } : m))
              );
            }
            if (event.event === 'done') {
              const finalMessage = String(event.data.message ?? '');
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: finalMessage || m.content } : m))
              );
            }
          },
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: '抱歉，出了点问题。请重试。' } : m))
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, persona]);

  if (hidden) return null;

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} shadow-lg shadow-black/20 transition-transform hover:scale-105`}
        whileTap={{ scale: 0.95 }}
        aria-label={`Open ${label}`}
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : persona === 'ai-hr' ? (
          <Bot className="h-5 w-5 text-white" />
        ) : (
          <UserRound className="h-5 w-5 text-white" />
        )}
      </motion.button>

      {/* Slide-out panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl shadow-black/30"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass}`}>
                  {persona === 'ai-hr' ? (
                    <Bot className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <Link
                href={fullPageHref}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <Maximize2 className="h-3 w-3" />
                完整页面
              </Link>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center py-12">
                  <p className="text-center text-xs text-muted-foreground/60">
                    有什么可以帮你的？
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/50 bg-card text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="mb-3 flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    思考中...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2 border-t border-border/50 px-4 py-3"
            >
              <AutoTextarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="输入消��..."
                className="flex-1 text-sm"
                maxRows={4}
                disabled={isLoading}
              />
              <Button type="submit" size="icon" variant="ghost" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
