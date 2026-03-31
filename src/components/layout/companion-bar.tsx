'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CompanionBarProps {
  /** Pre-computed status message (counts etc.) from server */
  statusMessage?: string;
  /** Available session types for tab switching */
  sessionTypes?: string[];
}

const DEFAULT_TABS = ['general', 'home', 'coach'];

export function CompanionBar({ statusMessage, sessionTypes }: CompanionBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('companion');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tabs = sessionTypes || DEFAULT_TABS;

  useEffect(() => {
    if (messagesEndRef.current && expanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  // Reset messages when switching tabs
  useEffect(() => {
    setMessages([]);
  }, [activeTab]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/internal/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          sessionType: activeTab,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const assistantId = `assistant-${Date.now()}`;
      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add empty assistant message
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        const currentContent = assistantContent;

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m))
        );
      }
    } catch (error) {
      console.error('Companion chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, activeTab]);

  return (
    <div className="rounded-lg border border-border/50 bg-accent/30 transition-all">
      {/* Collapsed bar */}
      <button
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 opacity-80">
            <MessageSquare className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm text-muted-foreground">
            {statusMessage || t('collapsed')}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded chat */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Session tabs */}
          <div className="flex gap-1 border-b border-border/30 px-4 py-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(`tab_${tab}`)}
              </button>
            ))}
          </div>

          {/* Messages area */}
          <div className="max-h-72 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground/60">
                {t('emptyChat')}
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-3 flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="mb-3 flex justify-start">
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 border-t border-border/30 px-4 py-3"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" variant="ghost" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
