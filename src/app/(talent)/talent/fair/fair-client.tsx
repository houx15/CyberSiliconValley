'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import KeywordGraph from '@/components/fair/keyword-graph';
import ClusterView from '@/components/fair/cluster-view';
import JobDetailSheet from '@/components/fair/job-detail-sheet';
import GraphSearch from '@/components/fair/graph-search';
import { Skeleton } from '@/components/ui/skeleton';
import type { GraphData } from '@/types/graph';

type FairClientProps = {
  userSkills: string[];
};

const EMPTY_GRAPH: GraphData = {
  nodes: [],
  edges: [],
};

export function resolveJobSheetKeyword(
  sheetKeyword: string | null,
  activeKeyword: string | null,
  searchKeyword: string | null
): string {
  return sheetKeyword ?? activeKeyword ?? searchKeyword ?? '';
}

export default function FairClient({ userSkills }: FairClientProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);
  const [sheetKeyword, setSheetKeyword] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGraph() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/v1/graph', { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Failed to load opportunity graph');
        }

        const payload = (await response.json()) as GraphData;
        if (!controller.signal.aborted) {
          setGraphData(payload);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Failed to load opportunity graph');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadGraph();
    return () => controller.abort();
  }, []);

  const graph = graphData ?? EMPTY_GRAPH;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-3xl flex-col items-center gap-5">
          <Skeleton className="h-80 w-full rounded-[28px] border border-white/10 bg-white/5" />
          <Skeleton className="h-16 w-2/3 rounded-2xl border border-white/10 bg-white/5" />
          <p className="text-sm text-muted-foreground">Rendering opportunity graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-10">
        <div className="max-w-xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-100">
          <p className="text-lg font-semibold">Unable to load Opportunity Fair.</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_38%),linear-gradient(180deg,_rgba(6,10,21,0.96),_rgba(9,12,20,0.94))]">
      <div className="border-b border-white/10 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300/70">
              Talent Market Map
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Opportunity Fair
            </h1>
          </div>

          <GraphSearch nodes={graph.nodes} onSearch={setSearchKeyword} />
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden px-6 py-6">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
          {graph.nodes.length === 0 ? (
            <div className="flex min-h-[480px] items-center justify-center rounded-[28px] border border-white/10 bg-white/5 px-6 text-center">
              <div className="max-w-lg space-y-3">
                <p className="text-xl font-semibold text-foreground">
                  No opportunity data available yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your AI is scanning the market. When graph data is seeded, the keyword map will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
              <KeywordGraph
                data={graph}
                userSkills={userSkills}
                onKeywordClick={setActiveKeyword}
                searchKeyword={searchKeyword}
              />

              <AnimatePresence>
                {activeKeyword ? (
                  <ClusterView
                    keyword={activeKeyword}
                    onBack={() => setActiveKeyword(null)}
                    onJobClick={(jobId) => {
                      setSheetKeyword(activeKeyword);
                      setSelectedJobId(jobId);
                      setSheetOpen(true);
                    }}
                  />
                ) : null}
              </AnimatePresence>

              <JobDetailSheet
                jobId={selectedJobId}
                keyword={resolveJobSheetKeyword(sheetKeyword, activeKeyword, searchKeyword)}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
