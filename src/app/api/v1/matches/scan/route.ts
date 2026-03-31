import { NextRequest, NextResponse } from 'next/server';
import { matchQueue } from '@/lib/jobs/queue';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
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
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const job = await matchQueue.add('scan', { jobId });

    return NextResponse.json({
      message: 'Match scan queued',
      queueJobId: job.id,
    });
  } catch (error) {
    console.error('[POST /api/v1/matches/scan]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
