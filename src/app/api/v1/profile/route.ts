import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { embedQueue } from '@/lib/jobs/queue';
import type { EmbedJobData } from '@/lib/jobs/queue';

const skillSchema = z.object({
  name: z.string().min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  category: z.string().min(1),
});

const experienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  duration: z.string(),
  description: z.string(),
});

const patchSchema = z.object({
  displayName: z.string().max(255).optional(),
  headline: z.string().max(500).optional(),
  bio: z.string().optional(),
  skills: z.array(skillSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    year: z.string(),
  })).optional(),
  goals: z.object({
    targetRoles: z.array(z.string()).optional(),
    workPreferences: z.array(z.string()).optional(),
  }).optional(),
  availability: z.enum(['open', 'busy', 'not_looking']).optional(),
  salaryRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const [profile] = await db
      .select()
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('GET /api/v1/profile error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const data = patchSchema.parse(body);

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.displayName !== undefined) updateFields.displayName = data.displayName;
    if (data.headline !== undefined) updateFields.headline = data.headline;
    if (data.bio !== undefined) updateFields.bio = data.bio;
    if (data.skills !== undefined) updateFields.skills = data.skills;
    if (data.experience !== undefined) updateFields.experience = data.experience;
    if (data.education !== undefined) updateFields.education = data.education;
    if (data.goals !== undefined) updateFields.goals = data.goals;
    if (data.availability !== undefined) updateFields.availability = data.availability;
    if (data.salaryRange !== undefined) updateFields.salaryRange = data.salaryRange;

    const [updated] = await db
      .update(talentProfiles)
      .set(updateFields)
      .where(eq(talentProfiles.userId, userId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Profile not found' },
        { status: 404 }
      );
    }

    // Queue embed-profile background job
    try {
      await embedQueue.add('embed-profile', {
        type: 'profile',
        id: updated.id,
      } satisfies EmbedJobData);
    } catch (e) {
      // Don't fail the request if queue is unavailable
      console.warn('Failed to queue embed-profile job:', e);
    }

    return NextResponse.json({ profile: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PATCH /api/v1/profile error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
