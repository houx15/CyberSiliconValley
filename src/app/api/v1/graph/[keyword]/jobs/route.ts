import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { getJobDetail, getJobsForKeyword } from '@/lib/graph/queries';

async function getTalentProfileId(request: NextRequest): Promise<string | undefined> {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return undefined;
    }

    const auth = await verifyJWT(token);
    if (auth.role !== 'talent') {
      return undefined;
    }

    const rows = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, auth.userId))
      .limit(1);

    return rows[0]?.id;
  } catch {
    return undefined;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  try {
    const { keyword } = await params;
    const decodedKeyword = decodeURIComponent(keyword);
    const talentId = await getTalentProfileId(request);
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (jobId) {
      const detail = await getJobDetail(jobId, talentId);
      if (!detail) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(detail);
    }

    const jobs = await getJobsForKeyword(decodedKeyword, talentId);
    return NextResponse.json({ keyword: decodedKeyword, jobs });
  } catch (error) {
    console.error('GET /api/v1/graph/[keyword]/jobs error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch keyword jobs' },
      { status: 500 }
    );
  }
}
