import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matches, jobs, talentProfiles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await verifyJWT(token);

    const results = await db
      .select({
        matchId: matches.id,
        jobId: matches.jobId,
        talentId: matches.talentId,
        score: matches.score,
        breakdown: matches.breakdown,
        status: matches.status,
        aiReasoning: matches.aiReasoning,
        createdAt: matches.createdAt,
        jobTitle: jobs.title,
        talentName: talentProfiles.displayName,
        talentHeadline: talentProfiles.headline,
      })
      .from(matches)
      .leftJoin(jobs, eq(matches.jobId, jobs.id))
      .leftJoin(talentProfiles, eq(matches.talentId, talentProfiles.id))
      .orderBy(desc(matches.score));

    return NextResponse.json({ matches: results });
  } catch (error) {
    console.error('[GET /api/v1/matches]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
