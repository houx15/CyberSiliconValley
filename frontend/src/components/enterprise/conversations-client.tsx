'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  Building2,
  User,
  Send,
  Search,
  MessageSquare,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ─── Types ─── */

type SenderType = 'ai_hr' | 'ai_talent' | 'human_enterprise' | 'human_talent';
type ViewRole = 'talent' | 'enterprise';

interface ConversationMessage {
  id: string;
  senderType: SenderType;
  senderName: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  talentName: string;
  companyName: string;
  jobTitle: string;
  jobDescription?: string;
  talentHeadline?: string;
  talentSkills?: string[];
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  status: 'active' | 'completed' | 'declined';
  messages: ConversationMessage[];
}

/* ─── Sender config ─── */

const SENDER_CONFIG: Record<SenderType, {
  icon: typeof Bot;
  color: string;
  bg: string;
  bubbleBg: string;
}> = {
  ai_hr: {
    icon: Bot,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    bubbleBg: 'border border-emerald-500/20 bg-emerald-500/5',
  },
  ai_talent: {
    icon: Bot,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    bubbleBg: 'border border-purple-500/20 bg-purple-500/5',
  },
  human_enterprise: {
    icon: Building2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    bubbleBg: 'bg-primary text-primary-foreground',
  },
  human_talent: {
    icon: User,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    bubbleBg: 'bg-primary text-primary-foreground',
  },
};

/* ─── Mock data ─── */

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    talentName: '张伟',
    companyName: '智谱科技',
    jobTitle: '高级后端工程师',
    jobDescription: '负责微服务架构的设计与优化，技术栈以 Go + gRPC + Kubernetes 为主。团队目前 12 人，产品已服务数十家企业客户。',
    talentHeadline: '5年 Go 后端经验 · 分布式系统专家',
    talentSkills: ['Go', 'gRPC', 'Kubernetes', 'Kafka', 'PostgreSQL'],
    lastMessage: '好的，我对远程工作模式很感兴趣，可以进一步聊聊。',
    lastMessageAt: '10:32',
    unread: true,
    status: 'active',
    messages: [
      { id: 'm1', senderType: 'ai_hr', senderName: 'AI HR', content: '你好张伟，我是智谱科技的 AI HR。我们注意到您在分布式系统方面有丰富的经验，目前有一个高级后端工程师的机会想和您聊聊。这个角色主要负责微服务架构的设计与优化，您之前在这方面有哪些实践经验呢？', createdAt: '2026-03-31T09:00:00Z' },
      { id: 'm2', senderType: 'ai_talent', senderName: '张伟', content: '你好！我在之前的公司负责过一套 Go 微服务架构的从零搭建，日均处理请求量在 500 万左右。我对高并发场景下的服务治理比较有经验，包括限流、熔断和链路追踪。', createdAt: '2026-03-31T09:05:00Z' },
      { id: 'm3', senderType: 'ai_hr', senderName: 'AI HR', content: '非常棒的经验！你们当时的技术栈是怎样的？我们这边主要用 Go + gRPC + Kubernetes，想看看是否匹配。', createdAt: '2026-03-31T09:08:00Z' },
      { id: 'm4', senderType: 'ai_talent', senderName: '张伟', content: '技术栈很接近。我们用的是 Go + gRPC，容器编排用的 K8s，消息队列用 Kafka。监控方面用 Prometheus + Grafana。基本上是业界比较主流的方案。', createdAt: '2026-03-31T09:15:00Z' },
      { id: 'm5', senderType: 'ai_hr', senderName: 'AI HR', content: '技术栈高度匹配。另外想了解一下，您对工作模式有什么偏好？我们支持远程和混合办公。', createdAt: '2026-03-31T09:20:00Z' },
      { id: 'm6', senderType: 'ai_talent', senderName: '张伟', content: '我目前在杭州，远程办公对我来说非常理想。我之前远程工作过一年多，效率和协作都没有问题。', createdAt: '2026-03-31T09:25:00Z' },
      { id: 'm7', senderType: 'human_enterprise', senderName: '招聘负责人', content: '张伟你好，我是技术团队的负责人。看了 AI 的沟通记录，你的背景确实很匹配我们的需求。想问一下你对薪资有什么预期？', createdAt: '2026-03-31T14:00:00Z' },
      { id: 'm8', senderType: 'human_talent', senderName: '张伟', content: '好的，我对远程工作模式很感兴趣，可以进一步聊聊。薪资方面我的预期是年薪 50-65 万，可以根据具体情况协商。', createdAt: '2026-03-31T14:32:00Z' },
    ],
  },
  {
    id: 'conv-2',
    talentName: '李明',
    companyName: '智谱科技',
    jobTitle: '高级后端工程师',
    jobDescription: '负责微服务架构的设计与优化，技术栈以 Go + gRPC + Kubernetes 为主。',
    talentHeadline: '蚂蚁集团前技术专家 · 云原生方向',
    talentSkills: ['Go', 'Python', 'K8s', 'Docker', 'GPU调度'],
    lastMessage: 'AI 预沟通已完成，候选人对项目方向很感兴趣。',
    lastMessageAt: '昨天',
    unread: false,
    status: 'completed',
    messages: [
      { id: 'm10', senderType: 'ai_hr', senderName: 'AI HR', content: '你好李明，我们正在寻找一位高级后端工程师。看到你在云原生和 DevOps 方面的经验，想和你聊聊这个机会。', createdAt: '2026-03-30T10:00:00Z' },
      { id: 'm11', senderType: 'ai_talent', senderName: '李明', content: '你好，感谢联系。我目前确实在看新的机会。能介绍一下具体的团队和项目方向吗？', createdAt: '2026-03-30T10:10:00Z' },
      { id: 'm12', senderType: 'ai_hr', senderName: 'AI HR', content: '当然。这是一个做 AI 基础设施的团队，主要负责模型推理平台和数据管道。技术栈以 Go 和 Python 为主，部署在 K8s 上。团队目前 8 人，产品已有企业客户在使用。', createdAt: '2026-03-30T10:15:00Z' },
      { id: 'm13', senderType: 'ai_talent', senderName: '李明', content: 'AI 基础设施方向很有意思。我之前在蚂蚁做过类似的推理服务优化，对 GPU 调度和模型部署有一些经验。这个方向我很感兴趣。', createdAt: '2026-03-30T10:25:00Z' },
      { id: 'm14', senderType: 'ai_hr', senderName: 'AI HR', content: '太好了，你的背景和我们的需求非常匹配。AI 预沟通已完成，候选人对项目方向很感兴趣。建议企业方安排进一步面试。', createdAt: '2026-03-30T10:30:00Z' },
    ],
  },
  {
    id: 'conv-3',
    talentName: '陈强',
    companyName: '月之暗面',
    jobTitle: 'LLM 应用架构师',
    jobDescription: '负责 LLM 应用层架构设计，包括 RAG 系统、Agent 框架和企业级 AI 产品的落地。需要有生产级 AI 系统的架构经验。',
    talentHeadline: 'RAG/Agent 技术专家 · 3个生产级项目',
    talentSkills: ['RAG', 'LangChain', 'LLM', 'Python', 'Vector DB'],
    lastMessage: '我在 RAG + Agent 方面有 3 个生产级项目的经验。',
    lastMessageAt: '昨天',
    unread: false,
    status: 'active',
    messages: [
      { id: 'm20', senderType: 'ai_hr', senderName: 'AI HR', content: '陈强你好，月之暗面有一个 LLM 应用架构师的机会，需要有 RAG 架构落地经验的人才。看到您的背景非常匹配。', createdAt: '2026-03-30T14:00:00Z' },
      { id: 'm21', senderType: 'ai_talent', senderName: '陈强', content: '你好！RAG 是我目前主要的技术方向。我在 RAG + Agent 方面有 3 个生产级项目的经验，包括企业知识库、智能客服和代码生成助手。', createdAt: '2026-03-30T14:10:00Z' },
      { id: 'm22', senderType: 'ai_hr', senderName: 'AI HR', content: '这些经验非常宝贵。能详细说一下在企业知识库项目中你是如何处理多模态文档检索的吗？', createdAt: '2026-03-30T14:15:00Z' },
      { id: 'm23', senderType: 'ai_talent', senderName: '陈强', content: '我们采用了混合检索方案：dense embedding（BGE-M3）+ sparse（BM25），配合 reranker。对于多模态内容，图表走 OCR + 描述生成后入索引，PDF 走分块 + metadata 增强。整体召回率从 65% 提升到 89%。', createdAt: '2026-03-30T14:25:00Z' },
    ],
  },
  {
    id: 'conv-4',
    talentName: '王芳',
    companyName: '百川智能',
    jobTitle: '高级后端工程师',
    jobDescription: '负责大模型推理服务的后端架构，优化服务吞吐量和延迟。',
    talentHeadline: 'Java/Go 后端开发 · 4年经验',
    talentSkills: ['Java', 'Go', 'Spring Boot', 'MySQL'],
    lastMessage: 'AI 正在进行预沟通...',
    lastMessageAt: '今天',
    unread: false,
    status: 'active',
    messages: [
      { id: 'm30', senderType: 'ai_hr', senderName: 'AI HR', content: '你好王芳，百川智能有一个高级后端工程师的机会，主要做大模型推理服务的后端架构。看到你在后端开发方面有不错的经验，想进一步了解一下。', createdAt: '2026-04-01T08:00:00Z' },
      { id: 'm31', senderType: 'ai_talent', senderName: '王芳', content: '你好，谢谢联系。我目前在一家中型公司做 Java 后端，正在考虑转型到 Go 技术栈。能介绍一下你们的技术栈和团队规模吗？', createdAt: '2026-04-01T08:15:00Z' },
    ],
  },
  {
    id: 'conv-5',
    talentName: '赵慧',
    companyName: '月之暗面',
    jobTitle: 'LLM 应用架构师',
    jobDescription: '负责 LLM 应用层架构设计，包括 RAG 系统和 Agent 框架。',
    talentHeadline: 'NLP 研究员 · ACL/EMNLP 发表',
    talentSkills: ['NLP', 'PyTorch', 'Transformers', '模型训练'],
    lastMessage: '候选人技术方向偏向 NLP 研究，与产品化要求有差距。',
    lastMessageAt: '2 天前',
    unread: false,
    status: 'declined',
    messages: [
      { id: 'm40', senderType: 'ai_hr', senderName: 'AI HR', content: '赵慧你好，月之暗面有一个 LLM 应用架构师的机会，需要有实际产品落地经验。看到你在 NLP 方面的研究背景，想了解一下。', createdAt: '2026-03-29T09:00:00Z' },
      { id: 'm41', senderType: 'ai_talent', senderName: '赵慧', content: '你好。我的背景主要是学术研究方向，在 ACL、EMNLP 发过几篇论文。工程落地经验相对少一些，更擅长模型训练和评估。', createdAt: '2026-03-29T09:20:00Z' },
      { id: 'm42', senderType: 'ai_hr', senderName: 'AI HR', content: '感谢你的坦诚。我们这个角色更偏向工程和产品化，需要有生产级系统的架构经验。你的研究背景非常出色，但可能和当前需求有些差距。如果后续有更偏研究方向的机会，我们会第一时间联系你。', createdAt: '2026-03-29T09:30:00Z' },
    ],
  },
];

const STATUS_LABEL: Record<Conversation['status'], { label: string; color: string }> = {
  active: { label: '进行中', color: 'text-emerald-400 bg-emerald-500/10' },
  completed: { label: '已完成', color: 'text-blue-400 bg-blue-500/10' },
  declined: { label: '未通过', color: 'text-muted-foreground bg-muted/30' },
};

/* ─── Props ─── */

interface ConversationsClientProps {
  role?: ViewRole;
}

/* ─── Component ─── */

export function ConversationsClient({ role = 'enterprise' }: ConversationsClientProps) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [selectedId, setSelectedId] = useState<string | null>(initialId || MOCK_CONVERSATIONS[0]?.id || null);
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Update selectedId when URL changes (deep linking)
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && conversations.some((c) => c.id === id)) {
      setSelectedId(id);
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [selected?.messages.length]);

  const filteredConversations = searchQuery
    ? conversations.filter(
        (c) =>
          c.talentName.includes(searchQuery) ||
          c.companyName.includes(searchQuery) ||
          c.jobTitle.includes(searchQuery) ||
          c.lastMessage.includes(searchQuery)
      )
    : conversations;

  // Enterprise: group conversations by job title
  const groupedByJob = role === 'enterprise'
    ? filteredConversations.reduce<Record<string, Conversation[]>>((acc, c) => {
        const key = c.jobTitle;
        if (!acc[key]) acc[key] = [];
        acc[key]!.push(c);
        return acc;
      }, {})
    : null;

  const sendReply = useCallback(() => {
    const content = replyInput.trim();
    if (!content || !selectedId) return;

    const senderType: SenderType = role === 'enterprise' ? 'human_enterprise' : 'human_talent';
    const senderName = role === 'enterprise' ? '招聘负责人' : '我';

    const newMsg: ConversationMessage = {
      id: `msg-${Date.now()}`,
      senderType,
      senderName,
      content,
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? { ...c, messages: [...c.messages, newMsg], lastMessage: content, lastMessageAt: '刚刚' }
          : c
      )
    );
    setReplyInput('');
  }, [replyInput, selectedId, role]);

  function isAiMessage(senderType: SenderType) {
    return senderType === 'ai_hr' || senderType === 'ai_talent';
  }

  // Right-aligned = "my" messages
  function isRightAligned(senderType: SenderType) {
    if (role === 'enterprise') {
      return senderType === 'human_enterprise' || senderType === 'ai_hr';
    }
    // Talent: talent's own messages and AI talent are on the right
    return senderType === 'human_talent' || senderType === 'ai_talent';
  }

  // "My" message gets primary bubble style
  function isMyMessage(senderType: SenderType) {
    if (role === 'enterprise') {
      return senderType === 'human_enterprise';
    }
    return senderType === 'human_talent';
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return '今天';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨天';
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  function groupMessagesByDate(messages: ConversationMessage[]) {
    const groups: { date: string; messages: ConversationMessage[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const date = formatDate(msg.createdAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [] });
      }
      groups[groups.length - 1]!.messages.push(msg);
    }
    return groups;
  }

  /* ─── Render list item ─── */
  function renderListItem(conv: Conversation) {
    const isSelected = conv.id === selectedId;
    return (
      <button
        key={conv.id}
        onClick={() => setSelectedId(conv.id)}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
          isSelected ? 'bg-accent/50' : 'hover:bg-accent/30'
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500">
          <span className="text-sm font-medium text-white">
            {role === 'enterprise' ? conv.talentName.charAt(0) : conv.companyName.charAt(0)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {role === 'enterprise' ? conv.talentName : conv.companyName}
              </span>
              {conv.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">{conv.lastMessageAt}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70">{conv.jobTitle}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
        </div>
      </button>
    );
  }

  /* ─── Render header info ─── */
  function renderChatHeader() {
    if (!selected) return null;

    if (role === 'enterprise') {
      // Enterprise sees candidate detail
      return (
        <div className="shrink-0 border-b border-border/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500">
                <span className="text-sm font-medium text-white">{selected.talentName.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{selected.talentName}</h3>
                {selected.talentHeadline && (
                  <p className="text-[11px] text-muted-foreground">{selected.talentHeadline}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.talentSkills?.slice(0, 4).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
              ))}
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_LABEL[selected.status].color)}>
                {STATUS_LABEL[selected.status].label}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">
            <Briefcase className="mr-1 inline h-3 w-3" />
            {selected.jobTitle}
          </p>
        </div>
      );
    }

    // Talent sees company + job info
    return (
      <div className="shrink-0 border-b border-border/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{selected.companyName}</h3>
              <p className="text-[11px] text-muted-foreground">{selected.jobTitle}</p>
            </div>
          </div>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_LABEL[selected.status].color)}>
            {STATUS_LABEL[selected.status].label}
          </span>
        </div>
        {selected.jobDescription && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground/70">
            {selected.jobDescription}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* ── Left: Conversation list ── */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border/50 bg-background">
        <div className="shrink-0 border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">对话记录</h2>
            <Badge variant="outline" className="border-border/50 text-[10px]">
              {conversations.length} 条对话
            </Badge>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={role === 'enterprise' ? '搜索候选人、机会...' : '搜索公司、职位...'}
              className="w-full rounded-lg border border-border/50 bg-muted/30 py-1.5 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {role === 'enterprise' && groupedByJob ? (
            // Enterprise: grouped by job
            <div className="divide-y divide-border/30">
              {Object.entries(groupedByJob).map(([jobTitle, convs]) => (
                <div key={jobTitle}>
                  <div className="flex items-center gap-2 bg-muted/20 px-4 py-2">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">{jobTitle}</span>
                    <span className="text-[10px] text-muted-foreground/50">({convs.length})</span>
                  </div>
                  <div className="divide-y divide-border/20">
                    {convs.map(renderListItem)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Talent: flat list
            <div className="divide-y divide-border/20">
              {filteredConversations.map(renderListItem)}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Chat area ── */}
      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {renderChatHeader()}

          {/* Messages */}
          <div className="flex-1 overflow-auto" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-6 px-6 py-4">
              {groupMessagesByDate(selected.messages).map((group) => (
                <div key={group.date} className="space-y-3">
                  <div className="flex items-center justify-center py-2">
                    <span className="rounded-full bg-muted/50 px-3 py-0.5 text-[10px] text-muted-foreground">
                      {group.date}
                    </span>
                  </div>

                  {group.messages.map((msg, i) => {
                    const config = SENDER_CONFIG[msg.senderType];
                    const Icon = config.icon;
                    const right = isRightAligned(msg.senderType);
                    const ai = isAiMessage(msg.senderType);
                    const mine = isMyMessage(msg.senderType);

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn('flex gap-2.5', right ? 'flex-row-reverse' : 'flex-row')}
                      >
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.bg)}>
                          <Icon className={cn('h-4 w-4', config.color)} />
                        </div>

                        <div className={cn('max-w-[70%] space-y-1', right ? 'items-end' : 'items-start')}>
                          <div className={cn('flex items-center gap-1.5', right ? 'flex-row-reverse' : 'flex-row')}>
                            <span className={cn('text-[11px] font-medium', config.color)}>
                              {mine ? '我' : msg.senderName}
                            </span>
                            {ai && (
                              <Badge
                                variant="outline"
                                className={cn('h-4 border-current px-1 text-[9px] font-normal leading-none', config.color)}
                              >
                                AI
                              </Badge>
                            )}
                          </div>
                          <div className={cn(
                            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                            mine ? 'bg-primary text-primary-foreground' : config.bubbleBg
                          )}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className={cn('text-[10px] text-muted-foreground/40', right ? 'text-right' : 'text-left')}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}

              <div className="flex justify-center py-2">
                <p className="text-[10px] text-muted-foreground/50">
                  AI 预沟通结束后，如未开启「不在线时 AI 自动回复」，AI 将不再自动回复
                </p>
              </div>
            </div>
          </div>

          {/* Reply input */}
          <div className="shrink-0 border-t border-border/50 px-6 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); sendReply(); }}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <AutoTextarea
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="输入回复... (Shift+Enter 换行)"
                className="flex-1"
                maxRows={4}
              />
              <Button type="submit" size="icon" disabled={!replyInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">选择一个对话查看详情</p>
          </div>
        </div>
      )}
    </div>
  );
}
