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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  listConversations,
  getConversation,
  sendMessage as apiSendMessage,
  pollNewMessages,
  type ConversationRecord,
  type DirectMessageRecord,
  type PreChatMessageRecord,
} from '@/lib/api/conversations';

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
  status: string;
  createdAt: string;
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

/* ─── Helpers to convert API data to local types ─── */

function preChatMsgToLocal(msg: PreChatMessageRecord, role: ViewRole): ConversationMessage {
  const nameMap: Record<string, string> = {
    ai_hr: 'AI HR',
    ai_talent: 'AI Talent',
    human_enterprise: role === 'enterprise' ? '我' : '招聘方',
    human_talent: role === 'talent' ? '我' : '候选人',
  };
  return {
    id: msg.id,
    senderType: msg.senderType as SenderType,
    senderName: nameMap[msg.senderType] || msg.senderType,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

function dmToLocal(msg: DirectMessageRecord, conv: ConversationRecord, role: ViewRole): ConversationMessage {
  const senderType = msg.senderType as SenderType;
  let senderName = senderType === 'human_enterprise' ? conv.companyName : conv.talentName;
  if (
    (role === 'enterprise' && senderType === 'human_enterprise') ||
    (role === 'talent' && senderType === 'human_talent')
  ) {
    senderName = '我';
  }
  return {
    id: msg.id,
    senderType,
    senderName,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: '进行中', color: 'text-emerald-400 bg-emerald-500/10' },
  completed: { label: '已完成', color: 'text-blue-400 bg-blue-500/10' },
  declined: { label: '未通过', color: 'text-muted-foreground bg-muted/30' },
  archived: { label: '已归档', color: 'text-muted-foreground bg-muted/30' },
};
const DEFAULT_STATUS = { label: '未知', color: 'text-muted-foreground bg-muted/30' };

/* ─── Props ─── */

interface ConversationsClientProps {
  role?: ViewRole;
}

/* ─── Component ─── */

export function ConversationsClient({ role = 'enterprise' }: ConversationsClientProps) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Fetch conversation list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const records = await listConversations();
        if (cancelled) return;
        const convs: Conversation[] = records.map((r) => ({
          id: r.id,
          talentName: r.talentName,
          companyName: r.companyName,
          jobTitle: r.jobTitle || '',
          talentHeadline: r.talentHeadline ?? undefined,
          lastMessage: r.lastMessage || '',
          lastMessageAt: r.lastMessageAt
            ? new Date(r.lastMessageAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '',
          unread: false,
          status: (r.status as Conversation['status']) || 'active',
          createdAt: r.createdAt,
          messages: [],
        }));
        setConversations(convs);
        if (!initialId && convs.length > 0) {
          setSelectedId(convs[0]!.id);
        }
      } catch {
        // Silently fail — will show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialId]);

  // Fetch full conversation detail when selection changes
  // Include conversations.length so this re-runs when the list populates (deep-link race fix)
  useEffect(() => {
    if (!selectedId) return;
    // Skip if messages already loaded
    const existing = conversations.find((c) => c.id === selectedId);
    if (existing && existing.messages.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const detail = await getConversation(selectedId);
        if (cancelled) return;
        const messages: ConversationMessage[] = [];
        if (detail.preChatMessages) {
          for (const m of detail.preChatMessages) {
            messages.push(preChatMsgToLocal(m, role));
          }
        }
        for (const m of detail.messages) {
          messages.push(dmToLocal(m, detail.conversation, role));
        }

        if (existing) {
          // Conversation is in the list — just update messages
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? { ...c, messages } : c))
          );
        } else {
          // Conversation not in list (e.g. deep-link beyond page limit) — prepend it
          const r = detail.conversation;
          const conv: Conversation = {
            id: r.id,
            talentName: r.talentName,
            companyName: r.companyName,
            jobTitle: r.jobTitle || '',
            talentHeadline: r.talentHeadline ?? undefined,
            lastMessage: r.lastMessage || '',
            lastMessageAt: r.lastMessageAt
              ? new Date(r.lastMessageAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '',
            unread: false,
            status: (r.status as Conversation['status']) || 'active',
            createdAt: r.createdAt,
            messages,
          };
          setConversations((prev) => [conv, ...prev]);
        }
      } catch {
        // Silent fail
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, role, conversations.length]);

  // Poll for new messages every 5 seconds (setTimeout-after-completion to prevent overlap)
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    const poll = async () => {
      const conv = conversationsRef.current.find((c) => c.id === selectedId);
      if (!conv) return;
      const serverMsgs = conv.messages.filter((m) => !m.id.startsWith('optimistic-'));
      const cursor = serverMsgs.length > 0
        ? serverMsgs[serverMsgs.length - 1]!.createdAt
        : conv.createdAt;
      try {
        const newMsgs = await pollNewMessages(selectedId, cursor);
        if (cancelled) return;
        if (newMsgs.length > 0) {
          const detail = await getConversation(selectedId);
          if (cancelled) return;
          const mapped = newMsgs.map((m) => dmToLocal(m, detail.conversation, role));
          const newest = mapped[mapped.length - 1]!;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== selectedId) return c;
              const withoutOptimistic = c.messages.filter((m) => !m.id.startsWith('optimistic-'));
              const existingIds = new Set(withoutOptimistic.map((m) => m.id));
              const fresh = mapped.filter((m) => !existingIds.has(m.id));
              if (fresh.length === 0 && withoutOptimistic.length === c.messages.length) return c;
              return {
                ...c,
                messages: [...withoutOptimistic, ...fresh],
                lastMessage: newest.content,
                lastMessageAt: new Date(newest.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              };
            })
          );
        }
      } catch {
        // Silent fail
      }
      if (!cancelled) {
        timer = setTimeout(poll, 5000);
      }
    };

    let timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId, role]);

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

  const sendReply = useCallback(async () => {
    const content = replyInput.trim();
    if (!content || !selectedId || sending) return;

    const senderType: SenderType = role === 'enterprise' ? 'human_enterprise' : 'human_talent';

    // Optimistic UI update
    const optimisticMsg: ConversationMessage = {
      id: `optimistic-${Date.now()}`,
      senderType,
      senderName: '我',
      content,
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? { ...c, messages: [...c.messages, optimisticMsg], lastMessage: content, lastMessageAt: '刚刚' }
          : c
      )
    );
    setReplyInput('');
    setSending(true);

    try {
      const msg = await apiSendMessage(selectedId, content);
      // Replace optimistic message with real one
      const realMsg: ConversationMessage = {
        id: msg.id,
        senderType: msg.senderType as SenderType,
        senderName: '我',
        content: msg.content,
        createdAt: msg.createdAt,
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== selectedId) return c;
          const hasOptimistic = c.messages.some((m) => m.id === optimisticMsg.id);
          const hasReal = c.messages.some((m) => m.id === realMsg.id);
          let updatedMessages: ConversationMessage[];
          if (hasOptimistic) {
            // Normal case: replace optimistic with real
            updatedMessages = c.messages.map((m) => (m.id === optimisticMsg.id ? realMsg : m));
          } else if (!hasReal) {
            // Poll already stripped optimistic but hasn't fetched this message yet — append
            updatedMessages = [...c.messages, realMsg];
          } else {
            // Already have the real message from poll — no change needed
            updatedMessages = c.messages;
          }
          return {
            ...c,
            messages: updatedMessages,
            lastMessage: msg.content,
            lastMessageAt: new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          };
        })
      );
    } catch {
      // Revert optimistic update — derive sidebar state from remaining messages
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== selectedId) return c;
          const remaining = c.messages.filter((m) => m.id !== optimisticMsg.id);
          const lastReal = remaining.filter((m) => !m.id.startsWith('optimistic-')).at(-1);
          return {
            ...c,
            messages: remaining,
            lastMessage: lastReal?.content ?? '',
            lastMessageAt: lastReal
              ? new Date(lastReal.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '',
          };
        })
      );
    } finally {
      setSending(false);
    }
  }, [replyInput, selectedId, role, sending, conversations]);

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
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', (STATUS_LABEL[selected.status] ?? DEFAULT_STATUS).color)}>
                {(STATUS_LABEL[selected.status] ?? DEFAULT_STATUS).label}
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
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', (STATUS_LABEL[selected.status] ?? DEFAULT_STATUS).color)}>
            {(STATUS_LABEL[selected.status] ?? DEFAULT_STATUS).label}
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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] -m-6 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">加载对话...</p>
        </div>
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
              <Button type="submit" size="icon" disabled={!replyInput.trim() || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
