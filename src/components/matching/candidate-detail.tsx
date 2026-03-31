'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScoreDot } from './score-dot';
import { motion } from 'framer-motion';
import type { CandidateRow } from './candidate-table';
import type { Skill } from '@/types';

interface CandidateDetailProps {
  candidate: CandidateRow | null;
  jobSkills: Array<{ name: string; required: boolean }>;
  open: boolean;
  onClose: () => void;
  onInvite: (talentId: string) => void;
  onShortlist: (talentId: string) => void;
}

function CountUpScore({ value }: { value: number }) {
  return (
    <motion.span
      className={`text-5xl font-bold ${
        value >= 80
          ? 'text-emerald-400'
          : value >= 60
            ? 'text-yellow-400'
            : 'text-red-400'
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {value}
    </motion.span>
  );
}

export function CandidateDetail({
  candidate,
  jobSkills,
  open,
  onClose,
  onInvite,
  onShortlist,
}: CandidateDetailProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!candidate) return null;

  const skills = candidate.skills || [];

  const skillsByCategory = skills.reduce<Record<string, Skill[]>>(
    (acc, skill) => {
      const cat = skill.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(skill);
      return acc;
    },
    {}
  );

  const handleInvite = async () => {
    setActionLoading('invite');
    try {
      await onInvite(candidate.talentId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleShortlist = async () => {
    setActionLoading('shortlist');
    try {
      await onShortlist(candidate.talentId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-[600px] overflow-y-auto sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {candidate.displayName ?? 'Unknown Candidate'}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {candidate.headline ?? ''}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Match Score */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
            <div>
              <div className="text-sm text-muted-foreground">Match Score</div>
              <CountUpScore value={candidate.score} />
            </div>
            <div className="space-y-1 text-right text-xs text-muted-foreground">
              <div>
                Semantic: {candidate.breakdown.semantic ?? 0}%
              </div>
              <div>
                Feature: {candidate.breakdown.feature ?? 0}%
              </div>
            </div>
          </div>

          {/* Skill Match Grid */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Skill Match</h3>
            <div className="grid grid-cols-2 gap-2">
              {jobSkills.map((jobSkill) => {
                const dimScore =
                  candidate.breakdown.dimensions?.[jobSkill.name] ?? 0;
                const hasSkill = skills.some(
                  (s) =>
                    s.name.toLowerCase() === jobSkill.name.toLowerCase()
                );

                return (
                  <div
                    key={jobSkill.name}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                      hasSkill && dimScore >= 0.8
                        ? 'border-emerald-800/50 bg-emerald-950/20'
                        : hasSkill
                          ? 'border-yellow-800/50 bg-yellow-950/20'
                          : 'border-zinc-800 bg-zinc-900/50'
                    }`}
                  >
                    <span>
                      {hasSkill && dimScore > 0 ? '✓ ' : ''}
                      {jobSkill.name}
                      {jobSkill.required && (
                        <span className="ml-1 text-amber-400">✱</span>
                      )}
                    </span>
                    <ScoreDot score={dimScore} />
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Capability Portrait */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Skills</h3>
            <div className="space-y-3">
              {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                <div key={category}>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catSkills.map((skill) => {
                      const isJobMatch = jobSkills.some(
                        (js) =>
                          js.name.toLowerCase() === skill.name.toLowerCase()
                      );
                      const opacity =
                        skill.level === 'expert'
                          ? 'opacity-100'
                          : skill.level === 'advanced'
                            ? 'opacity-80'
                            : skill.level === 'intermediate'
                              ? 'opacity-60'
                              : 'opacity-40';

                      return (
                        <Badge
                          key={skill.name}
                          variant={isJobMatch ? 'default' : 'outline'}
                          className={`${opacity} ${
                            isJobMatch
                              ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                              : ''
                          }`}
                        >
                          {isJobMatch && '✓ '}
                          {skill.name}
                          <span className="ml-1 text-xs opacity-60">
                            {skill.level}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* AI Reasoning */}
          {candidate.aiReasoning && (
            <div>
              <h3 className="mb-2 text-sm font-medium">AI Analysis</h3>
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-muted-foreground">
                {candidate.aiReasoning}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleInvite}
              disabled={actionLoading !== null}
              className="flex-1"
            >
              {actionLoading === 'invite' ? 'Sending...' : 'Send Invite'}
            </Button>
            <Button
              variant="outline"
              onClick={handleShortlist}
              disabled={actionLoading !== null}
              className="flex-1"
            >
              {actionLoading === 'shortlist'
                ? 'Adding...'
                : 'Add to Shortlist'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
