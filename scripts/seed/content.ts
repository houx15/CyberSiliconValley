import { desc, eq, inArray, sql } from 'drizzle-orm';

import { createInboxItem } from '../../src/lib/api/inbox';
import { handleGenerateReport } from '../../src/lib/jobs/generate-report';
import { db } from '../../src/lib/db';
import {
  enterpriseProfiles,
  inboxItems,
  jobs,
  matches,
  seekingReports,
  talentProfiles,
  users,
} from '../../src/lib/db/schema';
import type { InboxItemType } from '../../src/lib/inbox-shared';
import { buildInboxMatchContent } from './prompts';

type MatchNotificationRow = {
  matchId: string;
  jobId: string;
  talentId: string;
  score: number;
  talentName: string | null;
  talentHeadline: string | null;
  talentUserId: string;
  jobTitle: string | null;
  companyName: string | null;
  enterpriseUserId: string;
};

type FakeReportJob = {
  data: { talentId: string };
  log: (message: string) => Promise<void>;
};

function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (typeof result === 'object' && result !== null && 'rows' in result) {
    return ((result as { rows?: T[] }).rows ?? []) as T[];
  }

  return [];
}

async function createSeedInboxItem(input: {
  userId: string;
  itemType: InboxItemType;
  title: string;
  content: Record<string, unknown>;
  read?: boolean;
}) {
  const existing = await db
    .select({ id: inboxItems.id })
    .from(inboxItems)
    .where(
      sql`${inboxItems.userId} = ${input.userId}
        AND ${inboxItems.itemType} = ${input.itemType}
        AND ${inboxItems.title} = ${input.title}`
    )
    .limit(1);

  if (existing[0]?.id) {
    return existing[0].id;
  }

  return createInboxItem(input);
}

export async function seedInboxItems(): Promise<void> {
  console.log('📬 Generating inbox items...');

  const highMatches = unwrapRows<MatchNotificationRow>(
    await db.execute(sql`
      SELECT
        m.id AS "matchId",
        m.job_id AS "jobId",
        m.talent_id AS "talentId",
        m.score,
        tp.display_name AS "talentName",
        tp.headline AS "talentHeadline",
        tp.user_id AS "talentUserId",
        j.title AS "jobTitle",
        ep.company_name AS "companyName",
        ep.user_id AS "enterpriseUserId"
      FROM matches m
      JOIN talent_profiles tp ON m.talent_id = tp.id
      JOIN jobs j ON m.job_id = j.id
      JOIN enterprise_profiles ep ON j.enterprise_id = ep.id
      WHERE m.score >= 60
      ORDER BY m.score DESC
      LIMIT 80
    `)
  );

  let inboxCount = 0;
  const targetCount = 50;

  for (const row of highMatches.filter((item) => item.score >= 70).slice(0, 20)) {
    if (inboxCount >= targetCount) {
      break;
    }

    const { title, content } = buildInboxMatchContent('talent_match', {
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      score: Math.round(row.score),
      matchedSkills: [],
    });

    await createSeedInboxItem({
      userId: row.talentUserId,
      itemType: 'match_notification',
      title,
      content,
      read: Math.random() > 0.6,
    });
    inboxCount += 1;
  }

  for (const row of highMatches.filter((item) => item.score >= 75).slice(0, 15)) {
    if (inboxCount >= targetCount) {
      break;
    }

    const { title, content } = buildInboxMatchContent('enterprise_match', {
      talentId: row.talentId,
      talentName: row.talentName,
      talentHeadline: row.talentHeadline,
      jobId: row.jobId,
      score: Math.round(row.score),
    });

    await createSeedInboxItem({
      userId: row.enterpriseUserId,
      itemType: 'match_notification',
      title,
      content,
      read: Math.random() > 0.5,
    });
    inboxCount += 1;
  }

  const demoTalentUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev']));

  for (const user of demoTalentUsers) {
    if (inboxCount >= targetCount) {
      break;
    }

    const [profile] = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);
    if (!profile?.id) {
      continue;
    }

    const topMatch = unwrapRows<{
      matchId: string;
      jobId: string;
      jobTitle: string;
      companyName: string;
    }>(
      await db.execute(sql`
        SELECT
          m.id AS "matchId",
          m.job_id AS "jobId",
          j.title AS "jobTitle",
          ep.company_name AS "companyName"
        FROM matches m
        JOIN jobs j ON m.job_id = j.id
        JOIN enterprise_profiles ep ON j.enterprise_id = ep.id
        WHERE m.talent_id = ${profile.id}
        ORDER BY m.score DESC
        LIMIT 1
      `)
    )[0];

    if (!topMatch) {
      continue;
    }

    const { title, content } = buildInboxMatchContent('invite', {
      jobId: topMatch.jobId,
      companyName: topMatch.companyName,
      jobTitle: topMatch.jobTitle,
    });

    await createSeedInboxItem({
      userId: user.id,
      itemType: 'invite',
      title,
      content,
      read: false,
    });
    await db
      .update(matches)
      .set({ status: 'invited' })
      .where(eq(matches.id, topMatch.matchId));
    inboxCount += 1;
  }

  const demoPrechatJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyName: enterpriseProfiles.companyName,
      enterpriseId: jobs.enterpriseId,
    })
    .from(jobs)
    .leftJoin(enterpriseProfiles, eq(jobs.enterpriseId, enterpriseProfiles.id))
    .orderBy(desc(jobs.createdAt))
    .limit(2);

  for (const [index, user] of demoTalentUsers.entries()) {
    if (inboxCount >= targetCount || index >= demoPrechatJobs.length) {
      break;
    }

    const job = demoPrechatJobs[index];
    if (!job?.id) {
      continue;
    }

    const { title, content } = buildInboxMatchContent('prechat_summary', {
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      summary:
        'AI 预聊天显示这家公司很关注你的生产级系统经验，尤其是复杂场景下的检索优化、延迟控制与跨团队落地能力。',
      highlights: ['技术匹配度高', '沟通反馈积极', '适合尽快进入正式面试'],
    });

    await createSeedInboxItem({
      userId: user.id,
      itemType: 'prechat_summary',
      title,
      content,
      read: false,
    });
    inboxCount += 1;
  }

  const systemMessages = [
    '个人资料完善度提升至 95%',
    '新技能趋势: Agent Framework 需求增长 45%',
    '本周市场报告已生成',
    '您的 AI 伙伴发现了 3 个新机会',
    '技能图谱已更新',
  ];

  for (const message of systemMessages) {
    for (const user of demoTalentUsers) {
      if (inboxCount >= targetCount) {
        break;
      }

      await createSeedInboxItem({
        userId: user.id,
        itemType: 'system',
        title: message,
        content: {
          type: 'system',
          message,
        },
        read: Math.random() > 0.3,
      });
      inboxCount += 1;
    }
  }

  console.log(`✅ ${inboxCount} inbox items generated.\n`);
}

export async function seedSeekingReports(): Promise<void> {
  console.log('📊 Generating seeking reports...');

  const demoTalentProfiles = await db
    .select({
      id: talentProfiles.id,
    })
    .from(talentProfiles)
    .innerJoin(users, eq(talentProfiles.userId, users.id))
    .where(inArray(users.email, ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev']))
    .limit(3);

  for (const profile of demoTalentProfiles) {
    const existing = await db
      .select({ id: seekingReports.id })
      .from(seekingReports)
      .where(eq(seekingReports.talentId, profile.id))
      .limit(1);

    if (existing[0]?.id) {
      console.log(`  ✓ Report already exists for talent ${profile.id}`);
      continue;
    }

    const fakeJob: FakeReportJob = {
      data: { talentId: profile.id },
      log: async () => undefined,
    };

    await handleGenerateReport(fakeJob as never);
    console.log(`  ✓ Report generated for talent ${profile.id}`);
  }

  console.log('✅ Seeking reports generated.\n');
}
