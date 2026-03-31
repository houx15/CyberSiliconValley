import { db } from '@/lib/db';
import { inboxItems, matches, talentProfiles } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Fetch companion status counts for a talent user.
 * Returns inbox unread count and new match count.
 */
export async function getTalentCompanionCounts(userId: string) {
  try {
    // Get the talent profile ID
    const [profile] = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);

    if (!profile) return { inboxCount: 0, matchCount: 0 };

    // Count unread inbox items
    const [inboxResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inboxItems)
      .where(and(eq(inboxItems.userId, userId), eq(inboxItems.read, false)));

    // Count new matches
    const [matchResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(eq(matches.talentId, profile.id), eq(matches.status, 'new')));

    return {
      inboxCount: inboxResult?.count ?? 0,
      matchCount: matchResult?.count ?? 0,
    };
  } catch (error) {
    console.warn('Failed to fetch companion counts:', error);
    return { inboxCount: 0, matchCount: 0 };
  }
}
