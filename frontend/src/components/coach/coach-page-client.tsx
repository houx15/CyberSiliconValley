'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Brain,
  Target,
  MessageCircle,
  Send,
  Loader2,
  Plus,
  X,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { postSseJson } from '@/lib/api/sse';

/* ─── Types ─── */

type CoachStep = 'select' | 'detail' | 'brief' | 'chat';

interface Coach {
  id: string;
  name: string;
  specialty: string;
  description: string;
  background: string;
  solves: string[];
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CoachSession {
  id: string;
  coachId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  hasReport: boolean;
}

/* ─── Constants ─── */

const COACHES: Coach[] = [
  {
    id: 'general',
    name: '全能教练',
    specialty: '职业规划 · 简历优化 · 面试准备',
    description: '你的全方位 AI 职业顾问。无论是方向选择、简历打磨、面试模拟还是技能提升，都可以找我聊。',
    background: '拥有 10 年人力资源和职业咨询经验，曾帮助超过 5000 位 AI 领域人才完���职业转型。擅长从全局视角分析职业路径，结合市场趋势给出切实可行的建议。',
    solves: ['职业方向选择与规划', '简历结构和内容优化', '面试全流程准备', '技能差距分析'],
    icon: Sparkles,
    gradient: 'from-purple-500/20 to-blue-500/20',
  },
  {
    id: 'technical',
    name: '技术教练',
    specialty: '系统设计 · 算法 · 技术深度',
    description: '专注技术面的职业发展。帮你拆解系统设计题、梳理技术栈、定位技术方向。',
    background: '前大厂技术总监，在分布式系统、AI 基础设施领域有深厚积累。擅长用实际案例帮你建立系统设计思维，提升技术表达力。',
    solves: ['系统设计面试准备', '技术栈选择与深度提升', '技术方案评审模拟', '算法面试策略'],
    icon: Brain,
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    id: 'strategy',
    name: '求职策略师',
    specialty: '市场定位 · 薪资谈判 · Offer 决策',
    description: '从市场数据出发，帮你找准定位、优化投递策略、做出最优 Offer 选择。',
    background: '资深猎头转型职业策略顾问，对 AI 人才市场的薪资体系和企业偏好有精准判断。帮你用数据驱动的方式做出每一个职业决策。',
    solves: ['薪资谈判策略与技巧', 'Offer 对比与决策', '市场定位与目标公司筛选', '投递策略优化'],
    icon: Target,
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
  {
    id: 'behavioral',
    name: '沟通教练',
    specialty: '行为面试 · 故事打磨 · 表达训练',
    description: '用 STAR 法则打磨你的职业故事，训练你在行为面试中的表达力和说服力。',
    background: '传媒与心理学双学位背景，专注于职场沟通和表达训练。通过结构化的故事打磨和反复模拟，帮你在行为面试中展现真实且有说服力的自己。',
    solves: ['行为面试 STAR 故事准备', '自我介绍和电梯演讲', '冲突处理和领导力故事', '非母语面试表达训练'],
    icon: MessageCircle,
    gradient: 'from-rose-500/20 to-pink-500/20',
  },
];

const MOCK_SESSIONS: CoachSession[] = [
  { id: 'cs1', coachId: 'general', title: '职业方向讨论', updatedAt: '昨天', messageCount: 15, hasReport: true },
  { id: 'cs2', coachId: 'technical', title: '系统设计面试模拟', updatedAt: '3 天前', messageCount: 22, hasReport: true },
  { id: 'cs3', coachId: 'behavioral', title: 'STAR 故事打磨', updatedAt: '上周', messageCount: 10, hasReport: false },
];

/* ─── Component ─── */

export function CoachPageClient() {
  const [step, setStep] = useState<CoachStep>('select');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [userBrief, setUserBrief] = useState({
    skills: 'Python, Go, 分布式系统, LLM 应用',
    recentIssue: '',
    focus: '',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (step === 'chat') inputRef.current?.focus();
  }, [step]);

  function startNewSession() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep('select');
    setSelectedCoach(null);
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setUserBrief({ skills: userBrief.skills, recentIssue: '', focus: '' });
  }

  function selectCoachAndShowDetail(coach: Coach) {
    setSelectedCoach(coach);
    setStep('detail');
  }

  function confirmCoachAndShowBrief() {
    setStep('brief');
  }

  function confirmBriefAndStartChat() {
    setStep('chat');
    // Send initial context as first system-like message
    const briefText = [
      userBrief.skills && `我的技能: ${userBrief.skills}`,
      userBrief.recentIssue && `最近遇到的问题: ${userBrief.recentIssue}`,
      userBrief.focus && `咨询重点: ${userBrief.focus}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (briefText) {
      setMessages([
        { id: `user-brief`, role: 'user', content: briefText },
      ]);
      // Auto-trigger first response
      setTimeout(() => sendFirstMessage(briefText), 100);
    }
  }

  const sendFirstMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await postSseJson(
        '/api/v1/coach',
        {
          mode: 'chat',
          coachId: selectedCoach?.id,
          messages: [{ role: 'user', content }],
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
          prev.map((m) => (m.id === assistantId ? { ...m, content: '你好！很高兴见到你。让我们开始吧 — 先跟我说说你目前面临的主要问题？' } : m))
        );
      }
    } finally {
      setIsLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [selectedCoach]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

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
        '/api/v1/coach',
        {
          mode: 'chat',
          coachId: selectedCoach?.id,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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
  }, [input, isLoading, messages, selectedCoach]);

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-0 -m-6">
      {/* ── Left sidebar: session history ── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border/50 bg-background">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">AI 教练</span>
          </div>
          <button
            onClick={startNewSession}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 py-1">
            {MOCK_SESSIONS.map((session) => {
              const coach = COACHES.find((c) => c.id === session.coachId);
              const Icon = coach?.icon ?? Sparkles;
              return (
                <button
                  key={session.id}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground">{session.updatedAt}</p>
                      {session.hasReport && (
                        <Badge variant="outline" className="h-4 border-amber-500/30 px-1 text-[9px] text-amber-400">
                          报告
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 1: Select coach */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center p-8"
            >
              <div className="w-full max-w-3xl space-y-6">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-foreground">选择你的教练</h2>
                  <p className="mt-1 text-sm text-muted-foreground">每位教练有不同的专长，点击了解详情</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {COACHES.map((coach) => {
                    const Icon = coach.icon;
                    return (
                      <Card
                        key={coach.id}
                        className={`cursor-pointer border-border/50 transition-all hover:border-primary/40 hover:bg-card bg-gradient-to-br ${coach.gradient}`}
                        onClick={() => selectCoachAndShowDetail(coach)}
                      >
                        <CardContent className="flex flex-col items-center p-5 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background/60">
                            <Icon className="h-6 w-6 text-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">{coach.name}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{coach.specialty}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Coach detail modal */}
          {step === 'detail' && selectedCoach && (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center p-8"
            >
              <div className="w-full max-w-lg">
                <Card className={`border-border/50 bg-gradient-to-br ${selectedCoach.gradient}`}>
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/60">
                          <selectedCoach.icon className="h-6 w-6 text-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{selectedCoach.name}</h3>
                          <p className="text-xs text-muted-foreground">{selectedCoach.specialty}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStep('select')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">背景介绍</h4>
                      <p className="text-sm leading-relaxed text-foreground/80">{selectedCoach.background}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">擅长解决的问题</h4>
                      <ul className="space-y-1.5">
                        {selectedCoach.solves.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-foreground/80">
                            <ChevronRight className="h-3 w-3 text-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep('select')}
                      >
                        换一位
                      </Button>
                      <Button
                        className="flex-1 gap-1.5"
                        onClick={confirmCoachAndShowBrief}
                      >
                        选择 Ta
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Step 3: User brief modal */}
          {step === 'brief' && selectedCoach && (
            <motion.div
              key="brief"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center p-8"
            >
              <div className="w-full max-w-lg">
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">关于你的情况</h3>
                        <p className="text-xs text-muted-foreground">
                          帮助 {selectedCoach.name} 更好地了解你（可修改）
                        </p>
                      </div>
                      <button
                        onClick={() => setStep('detail')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">我的技能</label>
                        <AutoTextarea
                          value={userBrief.skills}
                          onChange={(e) => setUserBrief({ ...userBrief, skills: e.target.value })}
                          placeholder="例如: Python, React, 分布式系统..."
                          maxRows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">最近遇到的问题</label>
                        <AutoTextarea
                          value={userBrief.recentIssue}
                          onChange={(e) => setUserBrief({ ...userBrief, recentIssue: e.target.value })}
                          placeholder="例如: 面试中系统设计环节总是表达不清楚..."
                          maxRows={4}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">咨询重点</label>
                        <AutoTextarea
                          value={userBrief.focus}
                          onChange={(e) => setUserBrief({ ...userBrief, focus: e.target.value })}
                          placeholder="例如: 希望针对 XX 公司的面试做专门准备..."
                          maxRows={3}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep('detail')}
                      >
                        返回
                      </Button>
                      <Button
                        className="flex-1 gap-1.5"
                        onClick={confirmBriefAndStartChat}
                      >
                        开始咨询
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Step 4: Chat */}
          {step === 'chat' && selectedCoach && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border/50 px-6 py-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${selectedCoach.gradient}`}>
                  <selectedCoach.icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedCoach.name}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedCoach.specialty}</p>
                </div>
                <div className="flex-1" />
                <button
                  onClick={startNewSession}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  结束咨询
                </button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1" ref={scrollRef}>
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="flex items-start gap-2">
                        {msg.role === 'assistant' && (
                          <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${selectedCoach.gradient}`}>
                            <selectedCoach.icon className="h-3 w-3 text-foreground" />
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
