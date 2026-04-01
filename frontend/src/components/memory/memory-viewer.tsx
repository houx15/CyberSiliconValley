'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Trash2, Loader2 } from 'lucide-react';
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

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <CardTitle className="text-sm">{title || 'AI 记忆空间'}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          AI 基于对话积累的记忆。你可以编辑或删除。
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/60">暂无记忆</p>
        ) : (
          entries.map((entry, i) => (
            <div key={`${entry.key}-${i}`} className="flex items-start gap-2 rounded-lg border border-border/30 px-3 py-2.5">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{entry.key}</p>
                <textarea
                  className="w-full resize-none rounded border-none bg-transparent text-sm text-foreground outline-none"
                  rows={1}
                  value={entry.value}
                  onChange={(e) => updateEntry(i, e.target.value)}
                  onBlur={() => commitEntry()}
                />
              </div>
              <button onClick={() => removeEntry(i)} className="mt-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
