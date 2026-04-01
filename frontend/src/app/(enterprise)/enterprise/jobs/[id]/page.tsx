'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CandidateTable,
  type CandidateRow,
} from '@/components/matching/candidate-table';
import { CandidateDetail } from '@/components/matching/candidate-detail';
import type { StructuredJob, MatchBreakdown, Skill, MatchStatus } from '@/types';

interface JobData {
  id: string;
  title: string | null;
  description: string | null;
  structured: StructuredJob;
  status: string | null;
  createdAt: string | null;
}

interface MatchData {
  matchId: string;
  talentId: string;
  score: number;
  breakdown: MatchBreakdown;
  status: string | null;
  aiReasoning: string | null;
  createdAt: string | null;
  displayName: string | null;
  headline: string | null;
  skills: unknown;
  availability: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-emerald-500/20 text-emerald-400 border-emerald-600',
  reviewing: 'bg-blue-500/20 text-blue-400 border-blue-600',
  filled: 'bg-purple-500/20 text-purple-400 border-purple-600',
  closed: 'bg-zinc-500/20 text-zinc-400 border-zinc-600',
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateRow | null>(null);
  const [sortBy, setSortBy] = useState('score');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      const data = await res.json();

      setJob(data.job);
      setCandidates(
        (data.matches as MatchData[]).map((m) => ({
          matchId: m.matchId,
          talentId: m.talentId,
          displayName: m.displayName,
          headline: m.headline,
          score: m.score,
          breakdown: m.breakdown,
          status: (m.status || 'new') as MatchStatus,
          skills: (m.skills || []) as Skill[],
          availability: m.availability,
          aiReasoning: m.aiReasoning,
        }))
      );
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScanMatches = async () => {
    setScanning(true);
    try {
      await fetch('/api/v1/matches/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      setTimeout(() => {
        fetchData();
        setScanning(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to trigger scan:', error);
      setScanning(false);
    }
  };

  const handleInvite = async (talentId: string) => {
    const match = candidates.find((c) => c.talentId === talentId);
    if (!match) return;

    await fetch(`/api/v1/matches/${match.matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invited' }),
    });

    setCandidates((prev) =>
      prev.map((c) =>
        c.talentId === talentId ? { ...c, status: 'invited' as MatchStatus } : c
      )
    );
  };

  const handleShortlist = async (talentId: string) => {
    const match = candidates.find((c) => c.talentId === talentId);
    if (!match) return;

    await fetch(`/api/v1/matches/${match.matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shortlisted' }),
    });

    setCandidates((prev) =>
      prev.map((c) =>
        c.talentId === talentId
          ? { ...c, status: 'shortlisted' as MatchStatus }
          : c
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        未找到该机会。
      </div>
    );
  }

  const jobSkills = (job.structured?.skills || []).map((s) => ({
    name: s.name,
    required: s.required,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Job Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            {job.title ?? '未命名机会'}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Posted{' '}
              {job.createdAt
                ? new Date(job.createdAt).toLocaleDateString()
                : 'recently'}
            </span>
            <span>{candidates.length} matches</span>
            <Badge
              variant="outline"
              className={STATUS_BADGE[job.status ?? 'open'] ?? ''}
            >
              {job.status ?? 'open'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScanMatches}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Re-scan Matches'}
          </Button>
          <Button onClick={() => router.push('/enterprise/screening')}>
            AI Screen
          </Button>
        </div>
      </div>

      {/* Candidate Table */}
      {candidates.length > 0 ? (
        <CandidateTable
          candidates={candidates}
          jobSkills={jobSkills}
          onSelectCandidate={setSelectedCandidate}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-zinc-800 text-muted-foreground">
          <div className="text-center">
            <div className="mb-2 text-lg">暂无匹配</div>
            <p className="mb-4 text-sm">
              AI 正在为这个机会扫描人才库。
            </p>
            <Button onClick={handleScanMatches} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Scan Now'}
            </Button>
          </div>
        </div>
      )}

      {/* Candidate Detail Sheet */}
      <CandidateDetail
        candidate={selectedCandidate}
        jobSkills={jobSkills}
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
        onInvite={handleInvite}
        onShortlist={handleShortlist}
      />
    </div>
  );
}
