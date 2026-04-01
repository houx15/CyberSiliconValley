'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { postSseJson } from '@/lib/api/sse';

interface ScreeningChatProps {
  activeJobs: Array<{ id: string; title: string }>;
}

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ScreeningChat({ activeJobs }: ScreeningChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const suggestions = activeJobs.length > 0
    ? [
        `Find top candidates for "${activeJobs[0]?.title}"`,
        'Show me all candidates with Python expertise',
        'Compare the top 3 matches',
      ]
    : [
        'Find candidates skilled in NLP and RAG',
        'Who are the best machine learning engineers?',
        'Search for senior AI engineers available now',
      ];

  const handleSend = async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim() || isLoading) return;
    setInputValue('');
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
    };
    const assistantId = `assistant-${Date.now()}`;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      await postSseJson(
        '/api/v1/screening',
        { message: messageText },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === 'text') {
              const delta = String(event.data.delta ?? '');
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: `${message.content}${delta}` }
                    : message
                )
              );
            }

            if (event.event === 'done') {
              const finalMessage = String(event.data.message ?? '');
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId ? { ...message, content: finalMessage || message.content } : message
                )
              );
            }
          },
        }
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const content = error instanceof Error ? error.message : 'Unable to screen candidates right now.';
        setMessages((prev) =>
          prev.map((message) => (message.id === assistantId ? { ...message, content } : message))
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const welcomeText = activeJobs.length > 0
    ? `I'm ready to help you screen candidates. You have ${activeJobs.length} active job${activeJobs.length > 1 ? 's' : ''}: ${activeJobs.map((j) => `"${j.title}"`).join(', ')}. What would you like to explore?`
    : `I'm ready to help you screen candidates from the talent pool. What kind of talent are you looking for?`;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-4 py-4">
          {/* Welcome message */}
          <div className="flex gap-3 justify-start">
            <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-xs font-bold text-white">AI</span>
            </Avatar>
            <div className="max-w-[80%] rounded-lg bg-zinc-800 px-4 py-3 text-sm text-foreground">
              <div className="whitespace-pre-wrap">{welcomeText}</div>
            </div>
          </div>

          {messages.map((message) => {
            if (!message.content) return null;

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                    <span className="text-xs font-bold text-white">AI</span>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-foreground'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-xs font-bold text-white">AI</span>
              </Avatar>
              <div className="rounded-lg bg-zinc-800 px-4 py-3">
                <div className="flex gap-1">
                  <span className="animate-bounce text-muted-foreground">.</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: '0.1s' }}>.</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: '0.2s' }}>.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {suggestions.map((text) => (
              <Badge
                key={text}
                variant="outline"
                className="cursor-pointer transition-colors hover:bg-zinc-800"
                onClick={() => handleSend(text)}
              >
                {text}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mx-auto flex max-w-3xl gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about candidates, compare talent, or shortlist picks..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
