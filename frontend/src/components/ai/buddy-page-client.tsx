'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserRound,
  Send,
  Loader2,
  FileEdit,
  HelpCircle,
  TrendingUp,
  GraduationCap,
  ArrowRight,
  Plus,
  MessageSquare,
  FileText,
  CheckCircle,
  ChevronRight,
  Eye,
  Send as SendIcon,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MemoryViewer } from '@/components/memory/memory-viewer';
import { postSseJson } from '@/lib/api/sse';
import Link from 'next/link';

/* ─── Types ─── */

type FunctionMode = 'profile' | 'questions' | 'analysis';
type PageTab = 'chat' | 'report';
type ReportFilter = 'all' | 'screened' | 'pre_chat' | 'pre_chat_done' | 'enterprise_inquiry' | 'action_needed';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  title: string;
  mode: FunctionMode;
  updatedAt: string;
}

type OpportunityCategory = 'fulltime' | 'project' | 'internship' | 'consulting' | 'task';

interface OpportunityRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  opportunityType: OpportunityCategory;
  location: string;
  workMode: string;
  matchScore: number;
  status: 'screened' | 'pre_chat' | 'pre_chat_done' | 'enterprise_inquiry' | 'action_needed';
  aiAssessment: string;
  skills: { name: string; matched: boolean }[];
  preChatSummary?: string;
  preChatMessages?: { sender: string; content: string }[];
  updatedAt: string;
}

/* ─── Constants ─── */

const OPP_TYPE_LABELS: Record<OpportunityCategory, { label: string; color: string }> = {
  fulltime:   { label: '全职', color: 'border-blue-500/30 text-blue-400' },
  project:    { label: '项目', color: 'border-purple-500/30 text-purple-400' },
  internship: { label: '实习', color: 'border-amber-500/30 text-amber-400' },
  consulting: { label: '顾问', color: 'border-teal-500/30 text-teal-400' },
  task:       { label: '短期', color: 'border-orange-500/30 text-orange-400' },
};

const FUNCTIONS: { mode: FunctionMode; icon: typeof FileEdit; title: string; desc: string }[] = [
  { mode: 'profile', icon: FileEdit, title: '更新 Profile', desc: '用对话方式更新你的能力画像和简历' },
  { mode: 'questions', icon: HelpCircle, title: '求职困惑', desc: '职业方向、面试准备、薪资等问题' },
  { mode: 'analysis', icon: TrendingUp, title: '机会分析', desc: '匹配测评、市场趋势和机会汇总' },
];

const QUICK_PROMPTS: Record<FunctionMode, string[]> = {
  profile: ['帮我优化工作经历描述', '我想添加一个新项目经历', '帮我改写技能标签'],
  questions: ['我该不该换行业？', '面试中如何谈薪资', '远程工作有哪些注意事项'],
  analysis: ['最近有哪些适合我的机会', '帮我分析这周的匹配趋势', '与上周相比有什么变化'],
};

const MOCK_SESSIONS: Session[] = [
  { id: 's1', title: '优化简历工作经历', mode: 'profile', updatedAt: '2 小时前' },
  { id: 's2', title: '远程工作机会分析', mode: 'analysis', updatedAt: '昨天' },
  { id: 's3', title: '面试准备建议', mode: 'questions', updatedAt: '3 天前' },
  { id: 's4', title: '技能标签调整', mode: 'profile', updatedAt: '上周' },
];

const MOCK_OPPORTUNITIES: OpportunityRecord[] = [
  {
    id: 'o1', companyName: 'ByteDance', jobTitle: '高级后端工程师',
    opportunityType: 'fulltime' as OpportunityCategory,
    location: '北京', workMode: '混合',
    matchScore: 92, status: 'action_needed',
    aiAssessment: '技术栈高度匹配。你在分布式系统和 Go 微服务方面的经验与该机会要求完美契合。建议尽快进入面试流程。',
    skills: [{ name: 'Go', matched: true }, { name: 'Kubernetes', matched: true }, { name: '分布式系统', matched: true }, { name: 'gRPC', matched: true }, { name: 'Java', matched: false }],
    preChatSummary: 'AI HR 确认了团队规模和技术方向，双方技术栈高度一致。企业对候选人的系统设计能力印象深刻。',
    preChatMessages: [
      { sender: 'AI HR', content: '该候选人在分布式系统方面有 5 年经验，主导过日均亿级请求的微服务架构。' },
      { sender: 'AI 伙伴', content: '候选人对 Go 后端和 Kubernetes 编排有深入理解，也有 gRPC 服务间通信的实战经验。' },
      { sender: 'AI HR', content: '团队目前在做全球化架构升级，非常需要这方面的人才。我们希望尽快安排面试。' },
    ],
    updatedAt: '1 小时前',
  },
  {
    id: 'o2', companyName: 'Moonshot AI', jobTitle: 'RAG 平台搭建（项目合作）',
    opportunityType: 'project' as OpportunityCategory,
    location: '杭州', workMode: '远程',
    matchScore: 87, status: 'pre_chat_done',
    aiAssessment: 'RAG 架构经验是核心优势。候选人有多个生产级 LLM 应用项目，但在模型微调方面经验偏少。整体匹配度高。',
    skills: [{ name: 'Python', matched: true }, { name: 'RAG', matched: true }, { name: 'LangChain', matched: true }, { name: '向量数据库', matched: true }, { name: '模型微调', matched: false }],
    preChatSummary: '预沟通完成。双方在技术方向和远程工作模式上达成共识。企业对 RAG 实战经验很满意，等待安排正式面试。',
    preChatMessages: [
      { sender: 'AI HR', content: '我们的核心产品是面向企业的 RAG 平台，想了解候选人在大规模检索增强方面的经验。' },
      { sender: 'AI 伙伴', content: '候选人目前负责的项目日均处理 10 万+ 文档检索请求，使用自研 embedding + Milvus 向量数据库。' },
      { sender: 'AI HR', content: '很好，我们的方向完全吻合。候选人可以接受远程工作吗？' },
      { sender: 'AI 伙伴', content: '候选人首选远程工作模式，目前在杭州，时区完全匹配。' },
    ],
    updatedAt: '3 小时前',
  },
  {
    id: 'o3', companyName: 'Ant Group', jobTitle: 'AI 平台工程实习',
    opportunityType: 'internship' as OpportunityCategory,
    location: '杭州', workMode: '现场',
    matchScore: 78, status: 'pre_chat',
    aiAssessment: '模型部署和 MLOps 方面有基础，但与该实习要求的深度有一定差距。平台工程经验是加分项。',
    skills: [{ name: 'Python', matched: true }, { name: 'Docker', matched: true }, { name: 'MLOps', matched: false }, { name: 'PyTorch', matched: true }],
    updatedAt: '今天',
  },
  {
    id: 'o4', companyName: 'PingCAP', jobTitle: '分布式存储研发',
    opportunityType: 'fulltime' as OpportunityCategory,
    location: '北京', workMode: '混合',
    matchScore: 73, status: 'screened',
    aiAssessment: '分布式系统基础扎实，但在存储引擎层面的经验偏少。可以作为备选考虑。',
    skills: [{ name: 'Go', matched: true }, { name: '分布式系统', matched: true }, { name: 'Raft', matched: false }, { name: 'RocksDB', matched: false }],
    updatedAt: '昨天',
  },
  {
    id: 'o5', companyName: 'Meituan', jobTitle: '搜索推荐技术顾问',
    opportunityType: 'consulting' as OpportunityCategory,
    location: '北京', workMode: '远程',
    matchScore: 68, status: 'enterprise_inquiry',
    aiAssessment: '企业主动发来询问。虽然搜索推荐不是核心方向，但候选人的数据处理和系统架构能力被认可。',
    skills: [{ name: 'Python', matched: true }, { name: 'Elasticsearch', matched: false }, { name: '推荐系统', matched: false }],
    updatedAt: '2 天前',
  },
  {
    id: 'o6', companyName: 'Xiaomi', jobTitle: 'IoT 数据采集脚本（2周）',
    opportunityType: 'task' as OpportunityCategory,
    location: '北京', workMode: '远程',
    matchScore: 65, status: 'screened',
    aiAssessment: '后端架构经验匹配，但 IoT 领域经验空白。建议关注但不优先。',
    skills: [{ name: 'Go', matched: true }, { name: '微服务', matched: true }, { name: 'MQTT', matched: false }, { name: 'IoT', matched: false }],
    updatedAt: '3 天前',
  },
];

const FILTER_CONFIG: { key: ReportFilter; label: string; color: string }[] = [
  { key: 'all', label: '全部', color: 'text-foreground bg-accent' },
  { key: 'screened', label: '预筛选完成', color: 'text-blue-400 bg-blue-500/10' },
  { key: 'pre_chat', label: '预沟通中', color: 'text-amber-400 bg-amber-500/10' },
  { key: 'pre_chat_done', label: '预沟通完成', color: 'text-emerald-400 bg-emerald-500/10' },
  { key: 'enterprise_inquiry', label: '企业主动询问', color: 'text-purple-400 bg-purple-500/10' },
  { key: 'action_needed', label: '全部待处理', color: 'text-rose-400 bg-rose-500/10' },
];

const STATUS_LABELS: Record<OpportunityRecord['status'], string> = {
  screened: '预筛选完成',
  pre_chat: '预沟通中',
  pre_chat_done: '预沟通完成',
  enterprise_inquiry: '企业主动询问',
  action_needed: '需要处理',
};

/* ─── Component ─── */

export function BuddyPageClient() {
  const [pageTab, setPageTab] = useState<PageTab>('chat');
  const [activeMode, setActiveMode] = useState<FunctionMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [expandedOpp, setExpandedOpp] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState<string | null>(null);
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
            persona: 'buddy',
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

  // Report filtering
  const filteredOpps = MOCK_OPPORTUNITIES.filter((o) => {
    if (reportFilter === 'all') return true;
    if (reportFilter === 'action_needed') return o.status === 'action_needed' || o.status === 'enterprise_inquiry';
    return o.status === reportFilter;
  });

  const statusCounts = {
    screened: MOCK_OPPORTUNITIES.filter((o) => o.status === 'screened').length,
    pre_chat: MOCK_OPPORTUNITIES.filter((o) => o.status === 'pre_chat').length,
    pre_chat_done: MOCK_OPPORTUNITIES.filter((o) => o.status === 'pre_chat_done').length,
    enterprise_inquiry: MOCK_OPPORTUNITIES.filter((o) => o.status === 'enterprise_inquiry').length,
    action_needed: MOCK_OPPORTUNITIES.filter((o) => o.status === 'action_needed' || o.status === 'enterprise_inquiry').length,
  };

  const isChat = pageTab === 'chat';

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-0 -m-6">
      {/* ── Left sidebar: sessions (chat mode only) ── */}
      {isChat && (
        <div className="flex w-64 shrink-0 flex-col border-r border-border/50 bg-background">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500">
                <UserRound className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">AI 伙伴</span>
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

          <div className="border-t border-border/50 p-3">
            <Link
              href="/talent/coach"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50"
            >
              <GraduationCap className="h-4 w-4 text-amber-400" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">AI 教练</p>
                <p className="text-[10px] text-muted-foreground">深度职业指导</p>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
          {!isChat && (
            <div className="mr-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500">
                <UserRound className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">AI 伙伴</span>
              <Separator orientation="vertical" className="mx-2 h-5" />
            </div>
          )}
          <button
            onClick={() => setPageTab('chat')}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isChat ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            对话
          </button>
          <button
            onClick={() => setPageTab('report')}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              !isChat ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            工作报告
            {statusCounts.action_needed > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {statusCounts.action_needed}
              </Badge>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isChat ? (
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
                      <h2 className="text-lg font-semibold text-foreground">你好，今天需要什么帮助？</h2>
                      <p className="mt-1 text-sm text-muted-foreground">选择一个功能开始对话</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {FUNCTIONS.map((fn) => {
                        const Icon = fn.icon;
                        return (
                          <Card
                            key={fn.mode}
                            className="cursor-pointer border-border/50 bg-card/80 transition-all hover:border-primary/40 hover:bg-card"
                            onClick={() => selectMode(fn.mode)}
                          >
                            <CardContent className="space-y-2 p-4">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
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
                  <div className="flex items-center gap-1 border-b border-border/30 px-4 py-2">
                    {FUNCTIONS.map((fn) => {
                      const Icon = fn.icon;
                      return (
                        <button
                          key={fn.mode}
                          onClick={() => selectMode(fn.mode)}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            activeMode === fn.mode
                              ? 'bg-primary/10 text-primary'
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
                                className="rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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
                              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500">
                                <UserRound className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div
                              className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'border border-border/50 bg-card text-foreground'
                              }`}
                            >
                              {msg.content}
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
            /* ── Report Tab (full width, no sidebars) ── */
            <motion.div
              key="report-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto"
            >
              <div className="mx-auto max-w-4xl space-y-5 p-6">
                {/* Summary line */}
                <div className="space-y-1">
                  <p className="text-sm text-foreground/80">
                    今日总共浏览了{' '}
                    <span className="font-semibold text-foreground">1,247</span>{' '}
                    个机会，发现：
                  </p>
                </div>

                {/* Filter cards */}
                <div className="grid grid-cols-5 gap-3">
                  {FILTER_CONFIG.filter((f) => f.key !== 'all').map((filter) => {
                    const count = statusCounts[filter.key as keyof typeof statusCounts] ?? 0;
                    const isActive = reportFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => setReportFilter(isActive ? 'all' : filter.key)}
                        className={`rounded-xl border p-3 text-center transition-all ${
                          isActive
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border/50 bg-card/80 hover:border-border'
                        }`}
                      >
                        <p className={`text-xl font-bold ${filter.color.split(' ')[0]}`}>{count}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{filter.label}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Active filter indicator */}
                {reportFilter !== 'all' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Filter className="h-3 w-3" />
                      {FILTER_CONFIG.find((f) => f.key === reportFilter)?.label}
                    </Badge>
                    <button
                      onClick={() => setReportFilter('all')}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      清除筛选
                    </button>
                  </div>
                )}

                <Separator />

                {/* Opportunity list */}
                <div className="space-y-3">
                  {filteredOpps.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">暂无该状态的机会</p>
                  ) : (
                    filteredOpps.map((opp, i) => {
                      const isExpanded = expandedOpp === opp.id;
                      const isTranscriptOpen = showTranscript === opp.id;

                      return (
                        <motion.div
                          key={opp.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <Card className="border-border/50 bg-card/80 transition-colors hover:bg-card">
                            <CardContent className="p-0">
                              {/* Header row */}
                              <button
                                onClick={() => setExpandedOpp(isExpanded ? null : opp.id)}
                                className="flex w-full items-center gap-4 px-4 py-3 text-left"
                              >
                                {/* Score */}
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                  opp.matchScore >= 80
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : opp.matchScore >= 70
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : 'bg-muted text-muted-foreground'
                                }`}>
                                  {opp.matchScore}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">{opp.jobTitle}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${OPP_TYPE_LABELS[opp.opportunityType].color}`}>
                                      {OPP_TYPE_LABELS[opp.opportunityType].label}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {opp.companyName} · {opp.location} · {opp.workMode}
                                  </p>
                                </div>

                                <Badge variant="outline" className={`shrink-0 text-[11px] ${
                                  opp.status === 'action_needed'
                                    ? 'border-rose-500/30 text-rose-400'
                                    : opp.status === 'enterprise_inquiry'
                                      ? 'border-purple-500/30 text-purple-400'
                                      : opp.status === 'pre_chat_done'
                                        ? 'border-emerald-500/30 text-emerald-400'
                                        : opp.status === 'pre_chat'
                                          ? 'border-amber-500/30 text-amber-400'
                                          : 'border-border text-muted-foreground'
                                }`}>
                                  {STATUS_LABELS[opp.status]}
                                </Badge>

                                <span className="text-[10px] text-muted-foreground">{opp.updatedAt}</span>
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="border-t border-border/30 px-4 py-4 space-y-4"
                                >
                                  {/* Skills */}
                                  <div className="flex flex-wrap gap-1.5">
                                    {opp.skills.map((skill) => (
                                      <Badge
                                        key={skill.name}
                                        variant="outline"
                                        className={skill.matched
                                          ? 'border-emerald-500/30 text-emerald-400'
                                          : 'border-rose-500/30 text-rose-400'
                                        }
                                      >
                                        {skill.matched ? <CheckCircle className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
                                        {skill.name}
                                      </Badge>
                                    ))}
                                  </div>

                                  {/* AI assessment */}
                                  <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
                                    <p className="text-sm leading-relaxed text-foreground/80">{opp.aiAssessment}</p>
                                  </div>

                                  {/* Pre-chat summary */}
                                  {opp.preChatSummary && (
                                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-2">
                                      <p className="text-[11px] font-medium uppercase tracking-wide text-primary/60">预沟通摘要</p>
                                      <p className="text-sm text-foreground/80">{opp.preChatSummary}</p>
                                      {opp.preChatMessages && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowTranscript(isTranscriptOpen ? null : opp.id);
                                          }}
                                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                          <Eye className="h-3 w-3" />
                                          {isTranscriptOpen ? '收起对话记录' : '查看完整对话记录'}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Pre-chat transcript */}
                                  {isTranscriptOpen && opp.preChatMessages && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      className="rounded-lg border border-border/30 bg-background p-3 space-y-2"
                                    >
                                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">对话记录</p>
                                      {opp.preChatMessages.map((msg, idx) => {
                                        const isHr = msg.sender === 'AI HR';
                                        return (
                                          <div key={idx} className={`flex gap-2 ${isHr ? 'flex-row-reverse' : ''}`}>
                                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium ${
                                              isHr ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                                            }`}>
                                              {isHr ? 'HR' : '伙'}
                                            </div>
                                            <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                                              isHr
                                                ? 'bg-emerald-500/5 text-foreground/80'
                                                : 'bg-purple-500/5 text-foreground/80'
                                            }`}>
                                              {msg.content}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </motion.div>
                                  )}

                                  {/* Actions */}
                                  <div className="flex gap-2">
                                    {(opp.status === 'screened' || opp.status === 'pre_chat_done' || opp.status === 'action_needed' || opp.status === 'enterprise_inquiry') && (
                                      <Button size="sm" className="gap-1.5 text-xs">
                                        <SendIcon className="h-3 w-3" />
                                        主动投递
                                      </Button>
                                    )}
                                    {opp.status === 'screened' && (
                                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                                        <MessageSquare className="h-3 w-3" />
                                        发起预沟通
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="text-xs">
                                      不感兴趣
                                    </Button>
                                  </div>
                                </motion.div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right sidebar: Memory (chat mode only) ── */}
      {isChat && (
        <div className="hidden w-72 shrink-0 flex-col border-l border-border/50 bg-background lg:flex">
          <div className="flex-1 overflow-auto p-4">
            <MemoryViewer scopeType="talent_global" title="我的 AI 记忆" />
          </div>
        </div>
      )}
    </div>
  );
}
