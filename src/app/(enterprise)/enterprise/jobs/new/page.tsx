'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JdEditor } from '@/components/enterprise/jd-editor';
import type { UIMessage } from 'ai';

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

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function NewJobPage() {
  const [structured, setStructured] = useState<StructuredJobData | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [chatInput, setChatInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/internal/ai/jd-parse',
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'structureJob') {
        const args = toolCall.input as StructuredJobData;
        setStructured(args);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    sendMessage({ text: pasteText });
  }

  function handleLinkSubmit() {
    if (!linkUrl.trim()) return;
    sendMessage({ text: `Please parse this job posting URL: ${linkUrl}` });
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    sendMessage({ text: chatInput });
    setChatInput('');
  }

  // If we have structured data, show the editor
  if (structured) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Review & Publish Job</h1>
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
      <h1 className="text-lg font-medium">Post a New Job</h1>

      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">Paste JD</TabsTrigger>
          <TabsTrigger value="link">Link URL</TabsTrigger>
          <TabsTrigger value="chat">Describe in Chat</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        {/* Paste JD Tab */}
        <TabsContent value="paste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Paste Job Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={10}
                placeholder="Paste your full job description here..."
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
              <CardTitle className="text-sm">Link a Job Posting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
              />
              <p className="text-xs text-muted-foreground">
                Paste a URL and we will try to extract the job details.
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
              <CardTitle className="text-sm">Describe Your Requirements</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="space-y-3 py-2">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Tell me about the role or project you are hiring for, and I will structure it
                      into a job posting.
                    </p>
                  )}
                  <AnimatePresence mode="popLayout">
                    {messages.map((msg) => {
                      const text = getMessageText(msg);
                      if (!text) return null;
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
                            <div className="whitespace-pre-wrap">{text}</div>
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
                  placeholder="Describe the role..."
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
