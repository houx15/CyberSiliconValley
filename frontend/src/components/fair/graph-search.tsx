'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { GraphNode } from '@/types/graph';

type GraphSearchProps = {
  nodes: GraphNode[];
  onSearch: (keyword: string | null) => void;
};

export function getKeywordSuggestions(nodes: GraphNode[], query: string): GraphNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  return nodes
    .filter((node) => node.keyword.toLowerCase().includes(trimmed))
    .sort((left, right) => {
      const leftExact = left.keyword.toLowerCase() === trimmed;
      const rightExact = right.keyword.toLowerCase() === trimmed;
      if (leftExact !== rightExact) {
        return leftExact ? -1 : 1;
      }

      if (right.jobCount !== left.jobCount) {
        return right.jobCount - left.jobCount;
      }

      return left.keyword.localeCompare(right.keyword);
    })
    .slice(0, 8);
}

export function shouldClearSearch(value: string): boolean {
  return value.trim().length === 0;
}

export default function GraphSearch({ nodes, onSearch }: GraphSearchProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const suggestions = useMemo(() => getKeywordSuggestions(nodes, query), [nodes, query]);

  function handleSelect(keyword: string) {
    setQuery(keyword);
    setExpanded(false);
    onSearch(keyword);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && suggestions.length > 0) {
      event.preventDefault();
      handleSelect(suggestions[0]!.keyword);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery('');
      setExpanded(false);
      onSearch(null);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Search keywords..."
          className="pl-9"
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setExpanded(true);
            if (shouldClearSearch(nextValue)) {
              onSearch(null);
            }
          }}
          onFocus={() => setExpanded(true)}
          onBlur={() => {
            window.setTimeout(() => setExpanded(false), 160);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {expanded && suggestions.length > 0 && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur-sm">
          {suggestions.map((node) => (
            <button
              key={node.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5"
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(node.keyword);
              }}
            >
              <span>{node.keyword}</span>
              <span className="text-xs text-muted-foreground">{node.jobCount} 个机会</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
