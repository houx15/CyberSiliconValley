import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, matches, talentProfiles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (payload.role !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobMatches = await db
      .select({
        matchId: matches.id,
        talentId: matches.talentId,
        score: matches.score,
        breakdown: matches.breakdown,
        status: matches.status,
        aiReasoning: matches.aiReasoning,
        createdAt: matches.createdAt,
        displayName: talentProfiles.displayName,
        headline: talentProfiles.headline,
        skills: talentProfiles.skills,
        availability: talentProfiles.availability,
      })
      .from(matches)
      .leftJoin(talentProfiles, eq(matches.talentId, talentProfiles.id))
      .where(eq(matches.jobId, id))
      .orderBy(desc(matches.score));

    return NextResponse.json({
      job,
      matches: jobMatches,
    });
  } catch (error) {
    console.error('[GET /api/v1/jobs/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
