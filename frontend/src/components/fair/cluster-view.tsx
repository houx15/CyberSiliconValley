'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import CompanyCard from './company-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClusterJob } from '@/types/graph';

type ClusterViewProps = {
  keyword: string;
  onBack: () => void;
  onJobClick: (jobId: string) => void;
};

export default function ClusterView({ keyword, onBack, onJobClick }: ClusterViewProps) {
  const [jobs, setJobs] = useState<ClusterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/graph/${encodeURIComponent(keyword)}/jobs`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load jobs for ${keyword}`);
        }

        const payload = (await response.json()) as { jobs?: ClusterJob[] };
        setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadJobs();
    return () => controller.abort();
  }, [keyword]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className="absolute inset-0 z-20 overflow-auto bg-slate-950/95 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.24em] text-sky-300/80">
              Cluster View
            </p>
            <h2 className="text-2xl font-semibold text-foreground">
              Opportunities matching <span className="text-sky-300">{`"${keyword}"`}</span>
            </h2>
          </div>

          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to graph
          </Button>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-xl border border-white/10 bg-white/5" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200">
            <p className="font-medium">无法加载机会列表。</p>
            <p className="mt-1 text-sm text-rose-200/80">{error}</p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              Back to graph
            </Button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">暂无开放机会。</p>
            <p className="mt-2">换个关键词试试，或等待更多机会发布。</p>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.03 }}
              >
                <CompanyCard job={job} onClick={onJobClick} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
