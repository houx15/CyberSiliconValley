'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JdEditor } from '@/components/enterprise/jd-editor';
import { postSseJson } from '@/lib/api/sse';
import { Sparkles, PenLine, Bot } from 'lucide-react';

interface StructuredJobData {
  title: string;
  description: string;
  skills: Array<{ name: string; level: string; required: boolean }>;
  seniority: string;
  timeline: string;
  deliverables: string[];
  budget: { min?: number; max?: number; currency: string };
  workMode: 'remote' | 'onsite' | 'hybrid';
}

const emptyJob: StructuredJobData = {
  title: '',
  description: '',
  skills: [],
  seniority: 'Mid',
  timeline: '',
  deliverables: [],
  budget: { currency: 'CNY' },
  workMode: 'remote',
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function NewJobPage() {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [structured, setStructured] = useState<StructuredJobData | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function sendForParsing(text: string) {
    const messageText = text.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
    };
    const assistantId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setIsLoading(true);

    try {
      await postSseJson(
        '/api/v1/jobs/parse',
        { message: messageText },
        {
          onEvent: (event) => {
            if (event.event === 'tool' && event.data.name === 'structure_job' && event.data.structured) {
              setStructured(event.data.structured as StructuredJobData);
            }

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
      const content = error instanceof Error ? error.message : '暂时无法解析，请重试。';
      setMessages((prev) =>
        prev.map((message) => (message.id === assistantId ? { ...message, content } : message))
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    void sendForParsing(chatInput);
    setChatInput('');
  }

  // Show editor after AI extracted structured data
  if (structured) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">审核并发布机会</h1>
          <Button variant="ghost" size="sm" onClick={() => setStructured(null)}>
            重新开始
          </Button>
        </div>
        <JdEditor data={structured} onUpdate={setStructured} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">发布新机会</h1>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border/50 bg-card/50 p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 px-4 ${mode === 'ai' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMode('ai')}
          >
            <Sparkles className="h-4 w-4" />
            AI 模式
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 px-4 ${mode === 'manual' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMode('manual')}
          >
            <PenLine className="h-4 w-4" />
            手动填写
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'ai' ? (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="flex h-[560px] flex-col">
              <CardContent className="flex flex-1 flex-col overflow-hidden pt-6">
                <ScrollArea className="flex-1">
                  <div className="space-y-3 py-2">
                    {messages.length === 0 && (
                      <div className="flex items-start gap-3 py-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>你好！我是 AI HR 助手。</p>
                          <p>告诉我你需要什么样的人才，我会帮你生成结构化的机会描述。你可以描述：</p>
                          <ul className="ml-4 list-disc space-y-1 text-xs">
                            <li>职位名称和职责</li>
                            <li>需要的技能和经验</li>
                            <li>工作方式（远程/现场/混合）</li>
                            <li>薪资范围和时间线</li>
                            <li>机会类型（全职/实习/项目/顾问等）</li>
                          </ul>
                          <p className="text-xs">也可以直接粘贴已有的职位描述，我来帮你结构化。</p>
                        </div>
                      </div>
                    )}
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg) => {
                        if (!msg.content) return null;
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className="flex items-start gap-2">
                              {msg.role === 'assistant' && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                  <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                  msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {isLoading && (
                      <div className="flex items-start gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="rounded-xl bg-muted px-3 py-2">
                          <div className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.1s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.2s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <form
                  onSubmit={handleChatSubmit}
                  className="flex gap-2 border-t border-border/50 pt-3"
                >
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="描述你需要什么样的人才，或直接粘贴职位描述..."
                    disabled={isLoading}
                    rows={3}
                    className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit(e);
                      }
                    }}
                  />
                  <Button type="submit" disabled={isLoading || !chatInput.trim()} size="sm" className="self-end">
                    发送
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <JdEditor data={emptyJob} onUpdate={() => {}} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
