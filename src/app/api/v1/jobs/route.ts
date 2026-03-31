import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { embedQueue, matchQueue } from '@/lib/jobs/queue';
import type { EmbedJobData, ScanMatchJobData } from '@/lib/jobs/queue';

const createJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  structured: z.object({
    skills: z.array(
      z.object({
        name: z.string(),
        level: z.string(),
        required: z.boolean(),
      })
    ),
    seniority: z.string(),
    timeline: z.string(),
    deliverables: z.array(z.string()),
    budget: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      currency: z.string(),
    }),
    workMode: z.enum(['remote', 'onsite', 'hybrid']),
  }),
  autoMatch: z.boolean().default(true),
  autoPrechat: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: 'Enterprise profile not found' }, { status: 404 });
  }

  const jobsList = await db
    .select()
    .from(jobs)
    .where(eq(jobs.enterpriseId, profile.id))
    .orderBy(desc(jobs.createdAt));

  return NextResponse.json({ jobs: jobsList });
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createJobSchema.parse(body);

    const [profile] = await db
      .select()
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'Enterprise profile not found' }, { status: 404 });
    }

    const [job] = await db
      .insert(jobs)
      .values({
        enterpriseId: profile.id,
        title: data.title,
        description: data.description || null,
        structured: data.structured,
        status: 'open',
        autoMatch: data.autoMatch,
        autoPrechat: data.autoPrechat,
      })
      .returning();

    if (job) {
      // Queue background jobs
      try {
        await embedQueue.add('embed-job', {
          type: 'job',
          id: job.id,
        } satisfies EmbedJobData);
        await matchQueue.add('scan-matches', {
          jobId: job.id,
        } satisfies ScanMatchJobData);
      } catch {
        // Queue might not be available — non-fatal
      }
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
