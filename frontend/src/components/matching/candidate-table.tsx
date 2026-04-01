'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScoreDot } from './score-dot';
import type { Skill, MatchBreakdown, MatchStatus } from '@/types';

export interface CandidateRow {
  matchId: string;
  talentId: string;
  displayName: string | null;
  headline: string | null;
  score: number;
  breakdown: MatchBreakdown;
  status: MatchStatus;
  skills: Skill[];
  availability: string | null;
  aiReasoning?: string | null;
}

interface CandidateTableProps {
  candidates: CandidateRow[];
  jobSkills: Array<{ name: string; required: boolean }>;
  onSelectCandidate: (candidate: CandidateRow) => void;
  sortBy?: string;
  onSortChange?: (column: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  viewed: 'bg-zinc-500/20 text-zinc-400',
  shortlisted: 'bg-emerald-500/20 text-emerald-400',
  invited: 'bg-purple-500/20 text-purple-400',
  applied: 'bg-amber-500/20 text-amber-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export function CandidateTable({
  candidates,
  jobSkills,
  onSelectCandidate,
  sortBy = 'score',
  onSortChange,
}: CandidateTableProps) {
  const [filterThreshold, setFilterThreshold] = useState<number>(0);

  const filtered = useMemo(
    () => candidates.filter((c) => c.score >= filterThreshold),
    [candidates, filterThreshold]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'score') {
      arr.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'availability') {
      const order = { open: 0, busy: 1, not_looking: 2 };
      arr.sort(
        (a, b) =>
          (order[a.availability as keyof typeof order] ?? 3) -
          (order[b.availability as keyof typeof order] ?? 3)
      );
    } else {
      arr.sort((a, b) => {
        const aScore = a.breakdown.dimensions?.[sortBy] ?? 0;
        const bScore = b.breakdown.dimensions?.[sortBy] ?? 0;
        return bScore - aScore;
      });
    }
    return arr;
  }, [filtered, sortBy]);

  const handleHeaderClick = (column: string) => {
    onSortChange?.(column);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-4 text-sm">
        <label className="text-muted-foreground">Min score:</label>
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          value={filterThreshold}
          onChange={(e) => setFilterThreshold(Number(e.target.value))}
        >
          <option value={0}>All</option>
          <option value={50}>50+</option>
          <option value={60}>60+</option>
          <option value={70}>70+</option>
          <option value={80}>80+</option>
        </select>
        <span className="text-muted-foreground">
          {sorted.length} candidate{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th
                className="cursor-pointer px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('name')}
              >
                Candidate
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('score')}
              >
                Score
              </th>
              {jobSkills.map((skill) => (
                <th
                  key={skill.name}
                  className="cursor-pointer px-3 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => handleHeaderClick(skill.name)}
                >
                  <span className="text-xs">
                    {skill.name}
                    {skill.required && (
                      <span className="ml-0.5 text-amber-400">✱</span>
                    )}
                  </span>
                </th>
              ))}
              <th
                className="cursor-pointer px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleHeaderClick('availability')}
              >
                Availability
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((candidate) => (
              <tr
                key={candidate.matchId}
                className="cursor-pointer border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                onClick={() => onSelectCandidate(candidate)}
              >
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">
                      {candidate.displayName ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.headline ?? ''}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-lg font-bold ${
                      candidate.score >= 80
                        ? 'text-emerald-400'
                        : candidate.score >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {candidate.score}
                  </span>
                </td>
                {jobSkills.map((skill) => (
                  <td key={skill.name} className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreDot
                        score={
                          candidate.breakdown.dimensions?.[skill.name] ?? 0
                        }
                      />
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      candidate.availability === 'open'
                        ? 'border-emerald-600 text-emerald-400'
                        : candidate.availability === 'busy'
                          ? 'border-yellow-600 text-yellow-400'
                          : 'border-red-600 text-red-400'
                    }`}
                  >
                    {candidate.availability ?? 'unknown'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    className={`text-xs ${STATUS_COLORS[candidate.status] ?? ''}`}
                  >
                    {candidate.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={jobSkills.length + 4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No candidates match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
