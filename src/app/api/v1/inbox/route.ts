import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import {
  getUnreadInboxCount,
  listInboxItemsByUserId,
  type InboxFilter,
} from '@/lib/api/inbox';

const querySchema = z.object({
  filter: z
    .enum(['all', 'invites', 'prechats', 'matches', 'system'])
    .optional()
    .default('all'),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyJWT(token);
    const parsed = querySchema.safeParse({
      filter: request.nextUrl.searchParams.get('filter') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const filter = parsed.data.filter as InboxFilter;
    const [items, unreadCount] = await Promise.all([
      listInboxItemsByUserId(auth.userId, filter),
      getUnreadInboxCount(auth.userId),
    ]);

    return NextResponse.json({ data: { items, unreadCount } });
  } catch (error) {
    console.error('GET /api/v1/inbox error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
