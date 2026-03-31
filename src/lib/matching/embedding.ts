import { embed } from 'ai';
import { getEmbeddingModel } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { talentProfiles, jobs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Build a text block from a talent profile for embedding.
 */
export function buildProfileEmbeddingText(profile: {
  displayName?: string | null;
  headline?: string | null;
  skills?: Array<{ name: string; level?: string; category?: string }>;
  experience?: Array<{ role?: string; company?: string; description?: string }>;
}): string {
  const parts: string[] = [];

  if (profile.displayName) parts.push(profile.displayName);
  if (profile.headline) parts.push(profile.headline);

  if (profile.skills && Array.isArray(profile.skills)) {
    const skillNames = profile.skills.map((s) => s.name).join(', ');
    if (skillNames) parts.push(`Skills: ${skillNames}`);
  }

  if (profile.experience && Array.isArray(profile.experience)) {
    for (const exp of profile.experience) {
      const expParts: string[] = [];
      if (exp.role) expParts.push(exp.role);
      if (exp.company) expParts.push(`at ${exp.company}`);
      if (exp.description) expParts.push(exp.description);
      if (expParts.length > 0) parts.push(expParts.join(' '));
    }
  }

  return parts.join('. ').slice(0, 8000);
}

/**
 * Build a text block from a job posting for embedding.
 */
export function buildJobEmbeddingText(job: {
  title?: string | null;
  description?: string | null;
  structured?: {
    skills?: Array<{ name: string }>;
    seniority?: string;
    workMode?: string;
  };
}): string {
  const parts: string[] = [];

  if (job.title) parts.push(job.title);
  if (job.description) parts.push(job.description);

  if (job.structured?.skills && Array.isArray(job.structured.skills)) {
    const skillNames = job.structured.skills.map((s) => s.name).join(', ');
    if (skillNames) parts.push(`Required skills: ${skillNames}`);
  }

  if (job.structured?.seniority) {
    parts.push(`Seniority: ${job.structured.seniority}`);
  }

  if (job.structured?.workMode) {
    parts.push(`Work mode: ${job.structured.workMode}`);
  }

  return parts.join('. ').slice(0, 8000);
}

/**
 * Generate an embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getEmbeddingModel();

  const { embedding } = await embed({
    model,
    value: text,
  });

  return embedding;
}

/**
 * Generate and store an embedding for a talent profile.
 */
export async function embedProfile(profileId: string): Promise<void> {
  const profile = await db.query.talentProfiles.findFirst({
    where: eq(talentProfiles.id, profileId),
  });

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  const text = buildProfileEmbeddingText({
    displayName: profile.displayName,
    headline: profile.headline,
    skills: profile.skills as Array<{ name: string; level?: string; category?: string }>,
    experience: profile.experience as Array<{ role?: string; company?: string; description?: string }>,
  });

  if (!text.trim()) {
    console.warn(`[embed-profile] Empty text for profile ${profileId}, skipping`);
    return;
  }

  const embedding = await generateEmbedding(text);

  await db.execute(
    sql`UPDATE talent_profiles SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${profileId}::uuid`
  );

  console.log(`[embed-profile] Embedded profile ${profileId} (${text.length} chars)`);
}

/**
 * Generate and store an embedding for a job posting.
 */
export async function embedJob(jobId: string): Promise<void> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const text = buildJobEmbeddingText({
    title: job.title,
    description: job.description,
    structured: job.structured as {
      skills?: Array<{ name: string }>;
      seniority?: string;
      workMode?: string;
    },
  });

  if (!text.trim()) {
    console.warn(`[embed-job] Empty text for job ${jobId}, skipping`);
    return;
  }

  const embedding = await generateEmbedding(text);

  await db.execute(
    sql`UPDATE jobs SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${jobId}::uuid`
  );

  console.log(`[embed-job] Embedded job ${jobId} (${text.length} chars)`);
}
