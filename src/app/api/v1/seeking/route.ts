import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getLatestReportByUserId } from '@/lib/api/seeking';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyJWT(token);
    if (auth.role !== 'talent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await getLatestReportByUserId(auth.userId);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('GET /api/v1/seeking error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
