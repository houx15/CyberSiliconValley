'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { JobStatus } from '@/types';

interface JobItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  matchCount: number;
  shortlistedCount: number;
}

interface JobListProps {
  jobs: JobItem[];
}

const statusConfig: Record<
  JobStatus,
  { label: string; className: string }
> = {
  open: { label: 'Open', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  reviewing: {
    label: 'Reviewing',
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  filled: { label: 'Filled', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function JobList({ jobs }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <Card className="border-dashed border-border/50">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No jobs posted yet.</p>
          <Link
            href="/enterprise/jobs/new"
            className="mt-3 inline-block text-sm text-primary underline underline-offset-2"
          >
            Post your first job
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const status = statusConfig[job.status as JobStatus] || statusConfig.open;
        return (
          <Link key={job.id} href={`/enterprise/jobs/${job.id}`}>
            <Card className="transition-colors hover:border-primary/30 hover:bg-accent/30">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{job.title}</span>
                  <span className="text-xs text-muted-foreground">
                    Posted {formatDate(job.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="font-medium text-foreground">{job.matchCount}</strong>{' '}
                      matches
                    </span>
                    <span>
                      <strong className="font-medium text-foreground">
                        {job.shortlistedCount}
                      </strong>{' '}
                      shortlisted
                    </span>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
