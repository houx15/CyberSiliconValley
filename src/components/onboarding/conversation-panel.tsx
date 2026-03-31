'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import type { UIMessage } from 'ai';

interface ConversationPanelProps {
  messages: UIMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
}

const quickChips = [
  { labelKey: 'chips.skills' as const, message: 'Let me tell you about my technical skills.' },
  { labelKey: 'chips.experience' as const, message: "I'd like to share my work experience." },
  { labelKey: 'chips.goals' as const, message: "Here are my career goals and what I'm looking for." },
  { labelKey: 'chips.done' as const, message: "I think that covers everything. Let's wrap up!" },
];

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function ConversationPanel({
  messages,
  isLoading,
  onSendMessage,
}: ConversationPanelProps) {
  const t = useTranslations('onboarding');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSendMessage(text);
  };

  const handleChipClick = (message: string) => {
    if (isLoading) return;
    onSendMessage(message);
  };

  // Filter to only show user and assistant messages with text content
  const visibleMessages = messages.filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && getMessageText(m)
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        {/* Mini avatar */}
        <div className="relative w-8 h-8">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6)',
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {t('companionName')}
          </h2>
          <p className="text-xs text-foreground/50">{t('companionStatus')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {visibleMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-foreground/90'
                }`}
              >
                <p
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'assistant' ? 'font-serif' : ''
                  }`}
                >
                  {getMessageText(message)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (visibleMessages.length === 0 || visibleMessages[visibleMessages.length - 1]?.role === 'user') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-1 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2 h-2 rounded-full bg-foreground/40"
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick chips */}
      {messages.length > 1 && (
        <div className="px-6 py-2 flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button
              key={chip.labelKey}
              onClick={() => handleChipClick(chip.message)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
            >
              {t(chip.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-border">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={t('inputPlaceholder')}
            rows={1}
            className="flex-1 resize-none bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center transition-colors disabled:opacity-30"
          >
            <Send className="w-4 h-4 text-foreground/70" />
          </button>
        </div>
      </form>
    </div>
  );
}
