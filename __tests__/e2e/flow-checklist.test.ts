import { and, eq, gte, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

async function loadDbContext() {
  const [{ db }, schema] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  return { db, ...schema };
}

describeIfDb('Seed Data: Entity Counts', () => {
  it('has exactly 5 predefined user accounts', async () => {
    const { db, users } = await loadDbContext();
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.email} LIKE '%@csv.dev' AND ${users.email} NOT LIKE '%-seed-%'`);

    expect(rows[0]?.count ?? 0).toBe(5);
  });

  it('has the expected seeded volume', async () => {
    const {
      db,
      enterpriseProfiles,
      inboxItems,
      jobs,
      keywordNodes,
      matches,
      seekingReports,
      talentProfiles,
    } = await loadDbContext();

    const [talentRows, enterpriseRows, jobRows, matchRows, keywordRows, inboxRows, reportRows] =
      await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(talentProfiles),
        db.select({ count: sql<number>`count(*)::int` }).from(enterpriseProfiles),
        db.select({ count: sql<number>`count(*)::int` }).from(jobs),
        db.select({ count: sql<number>`count(*)::int` }).from(matches),
        db.select({ count: sql<number>`count(*)::int` }).from(keywordNodes),
        db.select({ count: sql<number>`count(*)::int` }).from(inboxItems),
        db.select({ count: sql<number>`count(*)::int` }).from(seekingReports),
      ]);

    expect(talentRows[0]?.count ?? 0).toBeGreaterThanOrEqual(50);
    expect(enterpriseRows[0]?.count ?? 0).toBeGreaterThanOrEqual(15);
    expect(jobRows[0]?.count ?? 0).toBeGreaterThanOrEqual(30);
    expect(matchRows[0]?.count ?? 0).toBeGreaterThanOrEqual(100);
    expect(keywordRows[0]?.count ?? 0).toBeGreaterThanOrEqual(40);
    expect(inboxRows[0]?.count ?? 0).toBeGreaterThanOrEqual(40);
    expect(reportRows[0]?.count ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describeIfDb('Seed Data: Demo Account Quality', () => {
  for (const email of ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev']) {
    it(`${email} has a complete seeded experience`, async () => {
      const { db, inboxItems, matches, seekingReports, talentProfiles, users } =
        await loadDbContext();

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(user).toBeDefined();

      const [profile] = await db
        .select({
          id: talentProfiles.id,
          onboardingDone: talentProfiles.onboardingDone,
          displayName: talentProfiles.displayName,
          skills: talentProfiles.skills,
        })
        .from(talentProfiles)
        .where(eq(talentProfiles.userId, user!.id))
        .limit(1);
      expect(profile).toBeDefined();
      expect(profile?.onboardingDone).toBe(true);
      expect(profile?.displayName).toBeTruthy();
      expect(Array.isArray(profile?.skills) ? profile.skills.length : 0).toBeGreaterThanOrEqual(3);

      const [highMatches] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(matches)
        .where(and(eq(matches.talentId, profile!.id), gte(matches.score, 80)));
      expect(highMatches?.count ?? 0).toBeGreaterThanOrEqual(3);

      const [reportCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(seekingReports)
        .where(eq(seekingReports.talentId, profile!.id));
      expect(reportCount?.count ?? 0).toBeGreaterThanOrEqual(1);

      const [inboxCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inboxItems)
        .where(eq(inboxItems.userId, user!.id));
      expect(inboxCount?.count ?? 0).toBeGreaterThan(0);
    });
  }
});

describeIfDb('Seed Data: Match and Graph Integrity', () => {
  it('has high, mid, and low match ranges', async () => {
    const { db, matches } = await loadDbContext();

    const [highRows, midRows, lowRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(matches).where(gte(matches.score, 80)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(matches)
        .where(sql`${matches.score} >= 60 AND ${matches.score} < 80`),
      db.select({ count: sql<number>`count(*)::int` }).from(matches).where(sql`${matches.score} < 60`),
    ]);

    expect(highRows[0]?.count ?? 0).toBeGreaterThan(0);
    expect(midRows[0]?.count ?? 0).toBeGreaterThan(0);
    expect(lowRows[0]?.count ?? 0).toBeGreaterThan(0);
  });

  it('uses only controlled skill vocabulary names in sampled profiles and jobs', async () => {
    const { db, jobs, talentProfiles } = await loadDbContext();
    const { ALL_SKILLS } = await import('../../scripts/seed/vocabulary');
    const skillSet = new Set(ALL_SKILLS);

    const [profileRows, jobRows] = await Promise.all([
      db.select({ skills: talentProfiles.skills }).from(talentProfiles).limit(20),
      db.select({ structured: jobs.structured }).from(jobs).limit(20),
    ]);

    for (const row of profileRows) {
      const skills = Array.isArray(row.skills) ? (row.skills as Array<{ name: string }>) : [];
      for (const skill of skills) {
        expect(skillSet.has(skill.name)).toBe(true);
      }
    }

    for (const row of jobRows) {
      const structured =
        typeof row.structured === 'object' && row.structured !== null
          ? (row.structured as { skills?: Array<{ name: string }> })
          : {};
      for (const skill of structured.skills ?? []) {
        expect(skillSet.has(skill.name)).toBe(true);
      }
    }
  });
});
