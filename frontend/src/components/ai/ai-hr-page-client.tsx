'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  MessageSquare,
  ClipboardList,
  Briefcase,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  User,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MemoryViewer } from '@/components/memory/memory-viewer';
import { postSseJson } from '@/lib/api/sse';

/* ─── Types ─── */

type FunctionMode = 'needs' | 'report' | 'job-chat';
type PageTab = 'chat' | 'records';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionCard?: ActionCard;
}

interface ActionCard {
  type: 'publish_job' | 'update_company';
  title: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Session {
  id: string;
  title: string;
  mode: FunctionMode;
  updatedAt: string;
}

interface TalentRecord {
  id: string;
  talentName: string;
  matchScore: number;
  status: 'pre_chat' | 'pre_chat_done' | 'interview_invited' | 'interview_done' | 'rejected';
  summary: string;
  preChatPreview?: string;
  updatedAt: string;
}

interface JobGroup {
  jobId: string;
  jobTitle: string;
  talents: TalentRecord[];
}

/* ─── Constants ─── */

const FUNCTIONS: { mode: FunctionMode; icon: typeof MessageSquare; title: string; desc: string }[] = [
  { mode: 'needs', icon: MessageSquare, title: '沟通企业需求', desc: '了解需求、更新企业描述、发布新职位' },
  { mode: 'report', icon: ClipboardList, title: '昨日招聘汇报', desc: '招聘进展、候选人动态和市场变化' },
  { mode: 'job-chat', icon: Briefcase, title: '针对职位聊天', desc: '选择职位深入讨论需求和招聘反馈' },
];

const QUICK_PROMPTS: Record<FunctionMode, string[]> = {
  needs: ['我们需要招一个高级后端工程师', '更新公司介绍', '发布一个新的产品经理职位'],
  report: ['昨天有什么新进展', '这周面试了多少人', '有哪些候选人进入终面'],
  'job-chat': ['高级后端工程师这个岗位进展如何', '最近收到的简历质量怎么样', '调整一下职位要求'],
};

const MOCK_SESSIONS: Session[] = [
  { id: 'es1', title: '后端工程师需求讨论', mode: 'needs', updatedAt: '2 小时前' },
  { id: 'es2', title: '昨日招聘进展', mode: 'report', updatedAt: '今天' },
  { id: 'es3', title: 'LLM 架构师岗位反馈', mode: 'job-chat', updatedAt: '昨天' },
];

const MOCK_JOB_GROUPS: JobGroup[] = [
  {
    jobId: 'j1',
    jobTitle: '高级后端工程师',
    talents: [
      {
        id: 't1', talentName: '张伟', matchScore: 92, status: 'interview_invited',
        summary: '分布式系统经验丰富，技术栈高度匹配。',
        preChatPreview: 'AI HR: 该候选人有 5 年 Go 后端经验，在微服务架构方面...',
        updatedAt: '1 小时前',
      },
      {
        id: 't2', talentName: '李明', matchScore: 85, status: 'pre_chat_done',
        summary: '预沟通完成，候选人对远程工作模式很感兴趣。',
        preChatPreview: 'AI 伙伴: 候选人目前在杭州，可以接受远程...',
        updatedAt: '3 小时前',
      },
      {
        id: 't3', talentName: '王芳', matchScore: 78, status: 'pre_chat',
        summary: 'AI 正在进行预沟通...',
        updatedAt: '今天',
      },
    ],
  },
  {
    jobId: 'j2',
    jobTitle: 'LLM 应用架构师',
    talents: [
      {
        id: 't4', talentName: '陈强', matchScore: 88, status: 'pre_chat_done',
        summary: 'RAG 架构经验丰富，有多个落地项目。',
        preChatPreview: 'AI HR: 候选人在 RAG + Agent 方面有 3 个生产级项目...',
        updatedAt: '昨天',
      },
      {
        id: 't5', talentName: '赵慧', matchScore: 72, status: 'rejected',
        summary: '技术方向偏向 NLP 研究，与产品化要求有差距。',
        updatedAt: '2 天前',
      },
    ],
  },
  {
    jobId: 'j3',
    jobTitle: '���品经理（AI 方向）',
    talents: [
      {
        id: 't6', talentName: '孙鹏', matchScore: 81, status: 'interview_done',
        summary: '面试表现优秀，有丰富的 AI 产品经验。',
        updatedAt: '昨天',
      },
    ],
  },
];

const STATUS_CONFIG: Record<TalentRecord['status'], { label: string; color: string }> = {
  pre_chat: { label: '预沟通中', color: 'text-amber-400 bg-amber-500/10' },
  pre_chat_done: { label: '预沟通完成', color: 'text-emerald-400 bg-emerald-500/10' },
  interview_invited: { label: '已邀面试', color: 'text-blue-400 bg-blue-500/10' },
  interview_done: { label: '面试完成', color: 'text-purple-400 bg-purple-500/10' },
  rejected: { label: '未通过', color: 'text-muted-foreground bg-muted/30' },
};

/* ─── Component ─── */

export function AiHrPageClient() {
  const [pageTab, setPageTab] = useState<PageTab>('chat');
  const [activeMode, setActiveMode] = useState<FunctionMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(MOCK_JOB_GROUPS[0]?.jobId ?? null);
  const [expandedTalent, setExpandedTalent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (activeMode) inputRef.current?.focus();
  }, [activeMode]);

  function selectMode(mode: FunctionMode) {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveMode(mode);
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setPageTab('chat');
  }

  function newChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveMode(null);
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setPageTab('chat');
  }

  function handleActionResponse(msgId: string, approved: boolean) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.actionCard) return m;
        return { ...m, actionCard: { ...m.actionCard, status: approved ? 'approved' : 'rejected' } };
      })
    );
  }

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isLoading || !activeMode) return;

      const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      setIsLoading(true);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await postSseJson(
          '/api/v1/companion',
          {
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            persona: 'ai-hr',
            functionMode: activeMode,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.event === 'text') {
                const delta = String(event.data.delta ?? '');
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${delta}` } : m))
                );
              }
              if (event.event === 'action') {
                const actionCard: ActionCard = {
                  type: String(event.data.type ?? 'publish_job') as ActionCard['type'],
                  title: String(event.data.title ?? ''),
                  summary: String(event.data.summary ?? ''),
                  status: 'pending',
                };
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, actionCard } : m))
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
        if (!controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: '抱歉，出了点问题。请重试。' } : m))
          );
        }
      } finally {
        setIsLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [input, isLoading, messages, activeMode]
  );

  const totalTalents = MOCK_JOB_GROUPS.reduce((acc, g) => acc + g.talents.length, 0);

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-0 -m-6">
      {/* ── Left sidebar: sessions ── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border/50 bg-background">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI HR</span>
          </div>
          <button
            onClick={newChat}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 py-1">
            {MOCK_SESSIONS.map((session) => {
              const fn = FUNCTIONS.find((f) => f.mode === session.mode);
              const Icon = fn?.icon ?? MessageSquare;
              return (
                <button
                  key={session.id}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground">{session.updatedAt}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
          <button
            onClick={() => setPageTab('chat')}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              pageTab === 'chat' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            对话
          </button>
          <button
            onClick={() => setPageTab('records')}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              pageTab === 'records' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            AI HR 工作报告
            <Badge variant="outline" className="ml-1 h-5 border-border/50 px-1.5 text-[10px]">
              {totalTalents}
            </Badge>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {pageTab === 'chat' ? (
            <motion.div
              key="chat-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {!activeMode ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8">
                  <div className="w-full max-w-2xl space-y-6">
                    <div className="text-center">
                      <h2 className="text-lg font-semibold text-foreground">AI HR 为你服务</h2>
                      <p className="mt-1 text-sm text-muted-foreground">选择一个功能开始</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {FUNCTIONS.map((fn) => {
                        const Icon = fn.icon;
                        return (
                          <Card
                            key={fn.mode}
                            className="cursor-pointer border-border/50 bg-card/80 transition-all hover:border-emerald-500/40 hover:bg-card"
                            onClick={() => selectMode(fn.mode)}
                          >
                            <CardContent className="space-y-2 p-4">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                                <Icon className="h-4.5 w-4.5 text-emerald-400" />
                              </div>
                              <h3 className="text-sm font-medium text-foreground">{fn.title}</h3>
                              <p className="text-xs leading-relaxed text-muted-foreground">{fn.desc}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mode tabs */}
                  <div className="flex items-center gap-1 border-b border-border/30 px-4 py-2">
                    {FUNCTIONS.map((fn) => {
                      const Icon = fn.icon;
                      return (
                        <button
                          key={fn.mode}
                          onClick={() => selectMode(fn.mode)}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            activeMode === fn.mode
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {fn.title}
                        </button>
                      );
                    })}
                    <div className="flex-1" />
                    <button onClick={() => setActiveMode(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      返回
                    </button>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1" ref={scrollRef}>
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
                      {messages.length === 0 && (
                        <div className="space-y-4 py-12">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                              {FUNCTIONS.find((f) => f.mode === activeMode)?.desc}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {QUICK_PROMPTS[activeMode].map((prompt) => (
                              <button
                                key={prompt}
                                onClick={() => sendMessage(prompt)}
                                className="rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-foreground"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex items-start gap-2">
                            {msg.role === 'assistant' && (
                              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500">
                                <Bot className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div className="space-y-2">
                              <div
                                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                  msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border border-border/50 bg-card text-foreground'
                                }`}
                              >
                                {msg.content}
                              </div>

                              {msg.actionCard && (
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                      {msg.actionCard.type === 'publish_job' ? (
                                        <Briefcase className="h-4 w-4 text-emerald-400" />
                                      ) : (
                                        <ClipboardList className="h-4 w-4 text-emerald-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <p className="text-sm font-medium text-foreground">{msg.actionCard.title}</p>
                                      <p className="text-xs text-muted-foreground">{msg.actionCard.summary}</p>
                                    </div>
                                  </div>
                                  {msg.actionCard.status === 'pending' ? (
                                    <div className="mt-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => handleActionResponse(msg.id, true)}
                                      >
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        同意执行
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        onClick={() => handleActionResponse(msg.id, false)}
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        拒绝
                                      </Button>
                                    </div>
                                  ) : (
                                    <p className={`mt-3 text-xs font-medium ${
                                      msg.actionCard.status === 'approved' ? 'text-emerald-400' : 'text-muted-foreground'
                                    }`}>
                                      {msg.actionCard.status === 'approved' ? '已批准执行' : '已拒绝'}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {isLoading && messages[messages.length - 1]?.role === 'user' && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            思考中...
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="border-t border-border/60 px-4 py-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                      }}
                      className="mx-auto flex w-full max-w-3xl items-end gap-2"
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
                        placeholder="输入消息... (Shift+Enter 换行)"
                        disabled={isLoading}
                        className="flex-1"
                        maxRows={6}
                      />
                      <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            /* ── Records Tab: talent grouped by job ── */
            <motion.div
              key="records-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto"
            >
              <div className="mx-auto max-w-4xl space-y-4 p-6">
                {MOCK_JOB_GROUPS.map((group) => (
                  <Card key={group.jobId} className="border-border/50 bg-card/80">
                    <button
                      onClick={() => setExpandedJob(expandedJob === group.jobId ? null : group.jobId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <Briefcase className="h-4 w-4 text-emerald-400" />
                      <span className="flex-1 text-sm font-medium text-foreground">{group.jobTitle}</span>
                      <Badge variant="outline" className="border-border/50 text-xs">
                        {group.talents.length} 人
                      </Badge>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedJob === group.jobId ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedJob === group.jobId && (
                      <div className="border-t border-border/30">
                        {group.talents.map((talent) => {
                          const statusCfg = STATUS_CONFIG[talent.status];
                          const isExpanded = expandedTalent === talent.id;

                          return (
                            <div key={talent.id} className="border-b border-border/20 last:border-b-0">
                              <button
                                onClick={() => setExpandedTalent(isExpanded ? null : talent.id)}
                                className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-accent/30"
                              >
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="flex-1 text-sm text-foreground">{talent.talentName}</span>
                                <Badge variant="outline" className={`text-[11px] ${
                                  talent.matchScore >= 80
                                    ? 'border-emerald-500/30 text-emerald-400'
                                    : talent.matchScore >= 70
                                      ? 'border-amber-500/30 text-amber-400'
                                      : 'border-border text-muted-foreground'
                                }`}>
                                  {talent.matchScore}%
                                </Badge>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{talent.updatedAt}</span>
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>

                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="space-y-2 px-6 pb-3 pt-1"
                                >
                                  <p className="text-xs text-foreground/80">{talent.summary}</p>
                                  {talent.preChatPreview && (
                                    <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">预沟通摘要</p>
                                      <p className="text-xs text-foreground/70">{talent.preChatPreview}</p>
                                      <button className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline">
                                        <Eye className="h-3 w-3" />
                                        查看完整对话记录
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right sidebar: Memory ── */}
      <div className="hidden w-72 shrink-0 flex-col border-l border-border/50 bg-background lg:flex">
        <div className="flex-1 overflow-auto p-4">
          <MemoryViewer scopeType="enterprise_global" title="AI HR 记忆" />
        </div>
      </div>
    </div>
  );
}
