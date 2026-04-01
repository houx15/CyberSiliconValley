'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JdEditor } from '@/components/enterprise/jd-editor';
import { postSseJson } from '@/lib/api/sse';

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
  budget: { currency: 'USD' },
  workMode: 'remote',
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function NewJobPage() {
  const [structured, setStructured] = useState<StructuredJobData | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function sendForParsing(text: string) {
    const messageText = text.trim();
    if (!messageText || isLoading) {
      return;
    }

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

  function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    void sendForParsing(pasteText);
  }

  function handleLinkSubmit() {
    if (!linkUrl.trim()) return;
    void sendForParsing(`Please parse this job posting URL: ${linkUrl}`);
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    void sendForParsing(chatInput);
    setChatInput('');
  }

  // If we have structured data, show the editor
  if (structured) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">审核并发布机会</h1>
          <Button variant="ghost" size="sm" onClick={() => setStructured(null)}>
            Start Over
          </Button>
        </div>
        <JdEditor data={structured} onUpdate={setStructured} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-lg font-medium">发布新机会</h1>

      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">粘贴描述</TabsTrigger>
          <TabsTrigger value="link">链接 URL</TabsTrigger>
          <TabsTrigger value="chat">对话描述</TabsTrigger>
          <TabsTrigger value="manual">手动填写</TabsTrigger>
        </TabsList>

        {/* Paste JD Tab */}
        <TabsContent value="paste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">粘贴机会描述</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={10}
                placeholder="在此粘贴完整的机会描述（全职、实习、项目等均可）..."
              />
              <div className="flex justify-end">
                <Button onClick={handlePasteSubmit} disabled={!pasteText.trim() || isLoading}>
                  {isLoading ? 'Parsing...' : 'Parse with AI'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Link URL Tab */}
        <TabsContent value="link" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">链接已有发布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/opportunity"
              />
              <p className="text-xs text-muted-foreground">
                粘贴 URL，我们会尝试提取机会详情。
              </p>
              <div className="flex justify-end">
                <Button onClick={handleLinkSubmit} disabled={!linkUrl.trim() || isLoading}>
                  {isLoading ? 'Parsing...' : 'Parse URL'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="flex h-[500px] flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">描述你的需求</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="space-y-3 py-2">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      告诉我你在寻找什么样的人才——可以是全职、实习、项目合作、顾问等任何形式。
                    </p>
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
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {isLoading && (
                    <div className="flex justify-start">
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
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="描述你需要什么样的人才..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !chatInput.trim()} size="sm">
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="space-y-4">
          <JdEditor data={emptyJob} onUpdate={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
