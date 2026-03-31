import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matches, inboxItems, talentProfiles, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { MatchStatus } from '@/types';

export async function PATCH(
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

    const body = await request.json();
    const { status } = body as { status: MatchStatus };

    const validStatuses: MatchStatus[] = [
      'new',
      'viewed',
      'shortlisted',
      'invited',
      'applied',
      'rejected',
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(matches)
      .set({ status })
      .where(eq(matches.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // If status is 'invited', create an inbox item for the talent
    if (status === 'invited' && updated.talentId) {
      const talentProfile = await db.query.talentProfiles.findFirst({
        where: eq(talentProfiles.id, updated.talentId),
      });

      const job = updated.jobId
        ? await db.query.jobs.findFirst({
            where: eq(jobs.id, updated.jobId),
          })
        : null;

      if (talentProfile?.userId) {
        await db.insert(inboxItems).values({
          userId: talentProfile.userId,
          itemType: 'invite',
          title: `You've been invited to apply: ${job?.title ?? 'a position'}`,
          content: {
            jobId: updated.jobId,
            jobTitle: job?.title,
            matchId: id,
            score: updated.score,
          },
        });
      }
    }

    return NextResponse.json({ match: updated });
  } catch (error) {
    console.error('[PATCH /api/v1/matches/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
