import { and, desc, eq, inArray, sql } from 'drizzle-orm';
export {
  INBOX_FILTER_TABS,
  INBOX_FILTER_TO_TYPES,
  INBOX_ITEM_TYPES,
  type InboxFilter,
  type InboxItemRow,
  type InboxItemType,
} from '@/lib/inbox-shared';
import {
  INBOX_FILTER_TO_TYPES,
  type InboxFilter,
  type InboxItemRow,
  type InboxItemType,
} from '@/lib/inbox-shared';

export async function listInboxItemsByUserId(
  userId: string,
  filter: InboxFilter = 'all'
): Promise<InboxItemRow[]> {
  const [{ db }, { inboxItems }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const selectedTypes = INBOX_FILTER_TO_TYPES[filter];
  const condition =
    selectedTypes === null
      ? eq(inboxItems.userId, userId)
      : and(
          eq(inboxItems.userId, userId),
          inArray(inboxItems.itemType, selectedTypes)
        );

  const rows = await db
    .select({
      id: inboxItems.id,
      itemType: inboxItems.itemType,
      title: inboxItems.title,
      content: inboxItems.content,
      read: inboxItems.read,
      createdAt: inboxItems.createdAt,
    })
    .from(inboxItems)
    .where(condition)
    .orderBy(desc(inboxItems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    itemType: row.itemType as InboxItemType,
    title: row.title ?? '',
    content: (row.content as Record<string, unknown>) ?? {},
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markInboxItemRead(
  id: string,
  userId: string
): Promise<boolean> {
  const [{ db }, { inboxItems }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const rows = await db
    .update(inboxItems)
    .set({ read: true })
    .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
    .returning({ id: inboxItems.id });

  return rows.length > 0;
}

export async function getUnreadInboxCount(userId: string): Promise<number> {
  const [{ db }, { inboxItems }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), eq(inboxItems.read, false)));

  return rows[0]?.count ?? 0;
}

export async function createInboxItem(input: {
  userId: string;
  itemType: InboxItemType;
  title: string;
  content: Record<string, unknown>;
  read?: boolean;
}): Promise<string> {
  const [{ db }, { inboxItems }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const rows = await db
    .insert(inboxItems)
    .values({
      userId: input.userId,
      itemType: input.itemType,
      title: input.title,
      content: input.content,
      read: input.read ?? false,
    })
    .returning({ id: inboxItems.id });

  return rows[0]?.id ?? '';
}
