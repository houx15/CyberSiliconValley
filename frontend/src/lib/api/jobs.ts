import { ApiError, apiFetch } from '@/lib/api/client';
import type { JobStatus, StructuredJob } from '@/types';

interface JobListResponse {
  jobs: EnterpriseJobListItem[];
}

export interface EnterpriseJobListItem {
  id: string;
  enterpriseId: string;
  title: string;
  description: string | null;
  structured: StructuredJob;
  status: JobStatus;
  autoMatch: boolean;
  autoPrechat: boolean;
  createdAt: string;
  updatedAt: string;
  matchCount: number;
  shortlistedCount: number;
}

export async function listEnterpriseJobs(): Promise<EnterpriseJobListItem[]> {
  try {
    const response = await apiFetch<JobListResponse>('/api/v1/jobs');
    return Array.isArray(response.jobs)
      ? response.jobs.map((job) => ({
          ...job,
          title: job.title || 'Untitled',
        }))
      : [];
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return [];
    }
    throw error;
  }
}

export function listOpenEnterpriseJobs(jobs: EnterpriseJobListItem[]) {
  return jobs
    .filter((job) => job.status === 'open')
    .map((job) => ({ id: job.id, title: job.title || 'Untitled' }));
}
