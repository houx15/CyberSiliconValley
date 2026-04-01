'use client';

import { useState, useEffect } from 'react';
import { Brain, Trash2, Loader2, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { getMemorySpace, updateMemorySpace } from '@/lib/api/prechat';
import type { MemoryEntry } from '@/lib/api/prechat';

interface MemoryViewerProps {
  scopeType: 'talent_global' | 'enterprise_job' | 'enterprise_global';
  scopeRefId?: string;
  title?: string;
}

export function MemoryViewer({ scopeType, scopeRefId, title }: MemoryViewerProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const fallback: MemoryEntry[] = [
        { key: '求职偏好', value: '远程优先，技术驱动团队', updatedAt: new Date().toISOString() },
        { key: '核心能力', value: 'RAG 架构、LLM 应用、系统设计', updatedAt: new Date().toISOString() },
        { key: '面试风格', value: '偏好技术深度对话，对行为面试也有准备', updatedAt: new Date().toISOString() },
        { key: '薪资预期', value: '年薪 40-60 万，可根据项目形式灵活协商', updatedAt: new Date().toISOString() },
        { key: '工作经历', value: '曾在字节跳动搜索团队工作 3 年，负责 embedding 召回模块；之后在创业公司带 AI 产品从 0 到 1', updatedAt: new Date().toISOString() },
        { key: '沟通风格', value: '偏好异步沟通，对技术讨论非常开放。面试时表达清晰有条理', updatedAt: new Date().toISOString() },
      ];

      let result: MemoryEntry[];
      try {
        const space = await getMemorySpace(scopeType, scopeRefId);
        result = space.entries;
      } catch {
        result = fallback;
      }

      if (!cancelled) {
        setEntries(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [scopeType, scopeRefId]);

  function removeEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    setEntries(next);
    updateMemorySpace(scopeType, next, scopeRefId).catch(() => {});
  }

  function updateEntry(index: number, value: string) {
    const next = entries.map((e, i) => (i === index ? { ...e, value, updatedAt: new Date().toISOString() } : e));
    setEntries(next);
  }

  function commitEntry() {
    updateMemorySpace(scopeType, entries, scopeRefId).catch(() => {});
  }

  function addEntry() {
    const next = [...entries, { key: '新记忆', value: '', updatedAt: new Date().toISOString() }];
    setEntries(next);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">{title || 'AI 记忆空间'}</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addEntry}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          AI 基于对话积累的记忆。你可以编辑或删除。
        </p>
      </div>

      {/* Scrollable entry list */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground/60">暂无记忆</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-0 divide-y divide-border/30">
            {entries.map((entry, i) => (
              <div key={`${entry.key}-${i}`} className="group px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-purple-400/80">{entry.key}</p>
                  <button
                    onClick={() => removeEntry(i)}
                    className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <textarea
                  className="mt-1 w-full resize-none rounded-md border-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
                  rows={Math.max(1, Math.ceil(entry.value.length / 20))}
                  value={entry.value}
                  onChange={(e) => updateEntry(i, e.target.value)}
                  onBlur={() => commitEntry()}
                  placeholder="输入记忆内容..."
                />
                <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                  {new Date(entry.updatedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
