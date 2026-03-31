'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanyReveal } from './company-reveal';
import type { UIMessage } from 'ai';

interface OnboardingContext {
  step?: string;
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  description?: string;
  aiMaturity?: string;
  jobTitle?: string;
  jobId?: string;
  onboardingDone?: boolean;
}

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function OnboardingChat() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<OnboardingContext>({});
  const [inputValue, setInputValue] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/internal/ai/enterprise-onboarding',
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'setCompanyProfile') {
        const args = toolCall.input as Record<string, string>;
        setContext((prev) => ({
          ...prev,
          step: 'company_confirmed',
          companyName: args.companyName,
          industry: args.industry,
          companySize: args.companySize,
          website: args.website,
          description: args.description,
          aiMaturity: args.aiMaturity,
        }));
      } else if (toolCall.toolName === 'createJob') {
        const args = toolCall.input as Record<string, string>;
        setContext((prev) => ({
          ...prev,
          step: 'job_created',
          jobTitle: args.title,
        }));
      } else if (toolCall.toolName === 'completeOnboarding') {
        setContext((prev) => ({
          ...prev,
          step: 'complete',
          onboardingDone: true,
        }));
        setTimeout(() => {
          router.push('/enterprise/dashboard');
        }, 2000);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || context.step === 'complete') return;
    sendMessage({ text: inputValue });
    setInputValue('');
  }

  return (
    <div className="flex h-full gap-6">
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-muted-foreground"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500">
                  <span className="text-lg text-white">C</span>
                </div>
                <p className="text-sm">
                  Welcome! I am your CSV companion. Let us get your company set up so we can find
                  the right talent for you.
                </p>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  Start by telling me your company name or website.
                </p>
              </motion.div>
            )}

            {messages.map((msg) => {
              const text = getMessageText(msg);
              if (!text) return null;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{text}</div>
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-3 border-t border-border/50 pt-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              context.step === 'complete'
                ? 'Onboarding complete! Redirecting...'
                : 'Type your message...'
            }
            disabled={isLoading || context.step === 'complete'}
            className="flex-1"
            autoFocus
          />
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim() || context.step === 'complete'}
          >
            Send
          </Button>
        </form>
      </div>

      {/* Side panel — company reveal card */}
      <div className="hidden w-80 shrink-0 lg:block">
        <CompanyReveal data={context} step={context.step || ''} />
      </div>
    </div>
  );
}
