import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../src/lib/db';
import { jobs, keywordEdges, keywordNodes, matches, talentProfiles, users } from '../../src/lib/db/schema';
import { embedJob, embedProfile } from '../../src/lib/matching/embedding';
import { scanMatchesForJob } from '../../src/lib/matching/engine';
import {
  deriveGraphSnapshot,
  planKeywordNodeSync,
} from '../../src/lib/jobs/workers/update-graph';

type ExistingGraphNode = {
  id: string;
  keyword: string;
};

export async function computeEmbeddings(): Promise<void> {
  console.log('🧮 Computing embeddings...');

  const [allTalent, allJobs] = await Promise.all([
    db.select({ id: talentProfiles.id }).from(talentProfiles),
    db.select({ id: jobs.id }).from(jobs),
  ]);

  let talentEmbedded = 0;
  for (const profile of allTalent) {
    await embedProfile(profile.id);
    talentEmbedded += 1;
    if (talentEmbedded % 10 === 0) {
      console.log(`  Embedded ${talentEmbedded}/${allTalent.length} talent profiles...`);
    }
  }

  let jobsEmbedded = 0;
  for (const job of allJobs) {
    await embedJob(job.id);
    jobsEmbedded += 1;
  }

  console.log(`✅ Embeddings complete: ${talentEmbedded} profiles + ${jobsEmbedded} jobs.\n`);
}

export async function computeMatches(): Promise<void> {
  console.log('🔗 Computing matches...');

  const openJobs = await db.select({ id: jobs.id, title: jobs.title }).from(jobs);
  let totalMatches = 0;

  for (const job of openJobs) {
    const count = await scanMatchesForJob(job.id);
    totalMatches += count;
    console.log(`  ✓ ${count} matches for "${job.title ?? job.id}"`);
  }

  console.log(`✅ ${totalMatches} matches computed.\n`);
}

export async function ensureDemoHighMatches(): Promise<void> {
  console.log('🎯 Ensuring demo accounts have high matches...');

  const demoUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      inArray(users.email, ['talent1@csv.dev', 'talent2@csv.dev', 'talent3@csv.dev'])
    );

  for (const user of demoUsers) {
    const profile = await db
      .select({ id: talentProfiles.id })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, user.id))
      .limit(1);

    const talentId = profile[0]?.id;
    if (!talentId) {
      continue;
    }

    const highCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(sql`${matches.talentId} = ${talentId} AND ${matches.score} >= 80`);

    const needed = 3 - (highCount[0]?.count ?? 0);
    if (needed <= 0) {
      console.log(`  ✓ ${user.email} already has enough high matches.`);
      continue;
    }

    await db.execute(sql`
      UPDATE matches
      SET score = LEAST(95, 80 + floor(random() * 15)::int)
      WHERE id IN (
        SELECT id
        FROM matches
        WHERE talent_id = ${talentId}
          AND score < 80
        ORDER BY score DESC
        LIMIT ${needed}
      )
    `);

    console.log(`  ↑ Boosted ${needed} matches for ${user.email}.`);
  }

  console.log('✅ Demo high matches ensured.\n');
}

export async function buildKeywordGraph(): Promise<void> {
  console.log('🕸️  Building keyword graph...');

  const openJobs = await db
    .select({
      createdAt: jobs.createdAt,
      structured: jobs.structured,
    })
    .from(jobs)
    .where(eq(jobs.status, 'open'));

  const snapshot = deriveGraphSnapshot(openJobs);
  const now = new Date();

  await db.transaction(async (tx) => {
    const existingNodes = (await tx
      .select({ id: keywordNodes.id, keyword: keywordNodes.keyword })
      .from(keywordNodes)) as ExistingGraphNode[];

    const plan = planKeywordNodeSync(existingNodes, snapshot.nodes, now);

    await tx.delete(keywordEdges);

    for (const update of plan.updates) {
      await tx
        .update(keywordNodes)
        .set({
          jobCount: update.jobCount,
          trending: update.trending,
        })
        .where(eq(keywordNodes.id, update.id));
    }

    if (plan.inserts.length > 0) {
      await tx.insert(keywordNodes).values(plan.inserts);
    }

    if (plan.removedNodeIds.length > 0) {
      await tx
        .delete(keywordNodes)
        .where(inArray(keywordNodes.id, plan.removedNodeIds));
    }

    const edges = snapshot.edges
      .map((edge) => {
        const sourceId = plan.keywordToId.get(edge.sourceKeyword);
        const targetId = plan.keywordToId.get(edge.targetKeyword);
        if (!sourceId || !targetId) {
          return null;
        }

        return {
          sourceId,
          targetId,
          weight: edge.weight,
        };
      })
      .filter(
        (edge): edge is { sourceId: string; targetId: string; weight: number } =>
          Boolean(edge)
      );

    if (edges.length > 0) {
      await tx.insert(keywordEdges).values(edges);
    }
  });

  console.log(
    `✅ Keyword graph built: ${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges.\n`
  );
}
