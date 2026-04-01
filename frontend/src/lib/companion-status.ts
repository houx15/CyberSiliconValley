import { getUnreadInboxCount } from '@/lib/api/inbox';
import { getLatestReportByUserId } from '@/lib/api/seeking';

/**
 * Fetch companion status counts for a talent user.
 * Returns inbox unread count and new match count.
 */
export async function getTalentCompanionCounts(userId: string) {
  try {
    const [inboxCount, report] = await Promise.all([
      getUnreadInboxCount(userId),
      getLatestReportByUserId(userId),
    ]);

    return {
      inboxCount,
      matchCount: report?.scanSummary.highMatches ?? 0,
    };
  } catch (error) {
    console.warn('Failed to fetch companion counts:', error);
    return { inboxCount: 0, matchCount: 0 };
  }
}
