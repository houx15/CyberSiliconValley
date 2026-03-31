import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { EmbedJobData, ScanMatchJobData, ReportJobData, PrechatJobData, GraphJobData } from './queue';
import { embedProfile, embedJob } from '@/lib/matching/embedding';
import { scanMatchesForJob } from '@/lib/matching/engine';
import { handleGenerateReport } from './generate-report';
import { handlePreChat } from './pre-chat';
import { updateGraphWorker } from './workers/update-graph';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Worker: embed profiles and jobs
new Worker<EmbedJobData>(
  'embed',
  async (job) => {
    console.log(`[embed] Processing ${job.data.type} ${job.data.id}`);

    if (job.data.type === 'profile') {
      await embedProfile(job.data.id);
    } else if (job.data.type === 'job') {
      await embedJob(job.data.id);
    } else {
      console.warn(`[embed] Unknown type: ${job.data.type}`);
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// Worker: scan for matches
new Worker<ScanMatchJobData>(
  'scan-matches',
  async (job) => {
    console.log(`[scan-matches] Processing job ${job.data.jobId}`);
    const matchCount = await scanMatchesForJob(job.data.jobId);
    console.log(`[scan-matches] Found ${matchCount} matches for job ${job.data.jobId}`);
  },
  {
    connection,
    concurrency: 1,
  }
);

// Worker: generate seeking reports (Spec 5 — stub)
new Worker<ReportJobData>(
  'generate-report',
  async (job) => {
    console.log(`[generate-report] Processing talent ${job.data.talentId}`);
    await handleGenerateReport(job);
  },
  { connection }
);

// Worker: pre-chat (Spec 5 — stub)
new Worker<PrechatJobData>(
  'pre-chat',
  async (job) => {
    console.log(`[pre-chat] Processing job ${job.data.jobId} talent ${job.data.talentId}`);
    await handlePreChat(job);
  },
  { connection }
);

// Worker: update keyword graph (Spec 6 — stub)
new Worker<GraphJobData>(
  'update-graph',
  async (job) => {
    await updateGraphWorker(job);
  },
  { connection }
);

console.log('[workers] All workers started');
