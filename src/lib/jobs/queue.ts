import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const matchQueue = new Queue('scan-matches', { connection });
export const embedQueue = new Queue('embed', { connection });
export const reportQueue = new Queue('generate-report', { connection });
export const prechatQueue = new Queue('pre-chat', { connection });
export const graphQueue = new Queue('update-graph', { connection });

export type EmbedJobData = {
  type: 'profile' | 'job';
  id: string;
};

export type ScanMatchJobData = {
  jobId: string;
};

export type ReportJobData = {
  talentId: string;
};

export type PrechatJobData = {
  jobId: string;
  talentId: string;
};

export type GraphJobData = {
  trigger: 'job_created' | 'job_updated' | 'scheduled';
};
