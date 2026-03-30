import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { EmbedJobData, ScanMatchJobData, ReportJobData, PrechatJobData, GraphJobData } from './queue';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

new Worker<EmbedJobData>(
  'embed',
  async (job) => {
    console.log(`[embed] Processing ${job.data.type} ${job.data.id}`);
    // Stub: actual embedding logic in Spec 4
  },
  { connection }
);

new Worker<ScanMatchJobData>(
  'scan-matches',
  async (job) => {
    console.log(`[scan-matches] Processing job ${job.data.jobId}`);
    // Stub: actual matching logic in Spec 4
  },
  { connection }
);

new Worker<ReportJobData>(
  'generate-report',
  async (job) => {
    console.log(`[generate-report] Processing for talent ${job.data.talentId}`);
    // Stub: actual report generation in Spec 5
  },
  { connection }
);

new Worker<PrechatJobData>(
  'pre-chat',
  async (job) => {
    console.log(`[pre-chat] Processing job ${job.data.jobId} talent ${job.data.talentId}`);
    // Stub: actual pre-chat logic in Spec 5
  },
  { connection }
);

new Worker<GraphJobData>(
  'update-graph',
  async (job) => {
    console.log(`[update-graph] Triggered by ${job.data.trigger}`);
    // Stub: actual graph update logic in Spec 6
  },
  { connection }
);

console.log('Workers started. Waiting for jobs...');
