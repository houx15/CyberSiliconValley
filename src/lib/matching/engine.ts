import { db } from '@/lib/db';
import { talentProfiles, jobs, matches, inboxItems, enterpriseProfiles } from '@/lib/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { computeFeatureScore } from './scoring';
import { generateEmbedding } from './embedding';
import type { Skill, StructuredJob, MatchBreakdown } from '@/types';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';

const SEMANTIC_WEIGHT = 0.4;
const FEATURE_WEIGHT = 0.6;
const TOP_N_SEMANTIC = 50;
const TOP_N_REASONING = 10;
const HIGH_MATCH_THRESHOLD = 80;

/**
 * Compute the hybrid match score from semantic and feature scores.
 * Both inputs on 0-100 scale; output on 0-100 scale.
 */
export function computeHybridScore(
  semanticScore: number,
  featureScore: number
): number {
  const hybrid =
    SEMANTIC_WEIGHT * semanticScore + FEATURE_WEIGHT * featureScore;
  return Math.round(Math.max(0, Math.min(100, hybrid)));
}

/**
 * Rank a set of candidates by their hybrid score (descending).
 */
export function rankCandidates(
  candidates: Array<{
    talentId: string;
    semanticScore: number;
    featureScore: number;
  }>
): Array<{
  talentId: string;
  semanticScore: number;
  featureScore: number;
  totalScore: number;
}> {
  return candidates
    .map((c) => ({
      ...c,
      totalScore: computeHybridScore(c.semanticScore, c.featureScore),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Find the top N talent profiles by embedding cosine similarity to a job.
 */
async function findSemanticMatches(
  jobId: string,
  limit: number = TOP_N_SEMANTIC
): Promise<
  Array<{
    id: string;
    displayName: string | null;
    headline: string | null;
    skills: unknown;
    experience: unknown;
    availability: string | null;
    cosineSimilarity: number;
  }>
> {
  const result = await db.execute(sql`
    SELECT
      tp.id,
      tp.display_name as "displayName",
      tp.headline,
      tp.skills,
      tp.experience,
      tp.availability,
      1 - (tp.embedding <=> j.embedding) as "cosineSimilarity"
    FROM talent_profiles tp, jobs j
    WHERE j.id = ${jobId}::uuid
      AND tp.embedding IS NOT NULL
      AND j.embedding IS NOT NULL
    ORDER BY tp.embedding <=> j.embedding
    LIMIT ${limit}
  `);

  return result as unknown as Array<{
    id: string;
    displayName: string | null;
    headline: string | null;
    skills: unknown;
    experience: unknown;
    availability: string | null;
    cosineSimilarity: number;
  }>;
}

/**
 * Generate AI reasoning for why a talent is a good/poor match for a job.
 */
async function generateMatchReasoning(
  talentProfile: {
    displayName: string | null;
    headline: string | null;
    skills: Skill[];
  },
  jobDetails: {
    title: string | null;
    structured: StructuredJob;
  },
  score: number
): Promise<string> {
  const model = getModel();

  const { text } = await generateText({
    model,
    system: `You are an AI recruiter analyzing talent-job fit. Be concise (2-3 sentences). Write in the language that matches the talent's name (Chinese name → Chinese, otherwise English).`,
    prompt: `Talent: ${talentProfile.displayName} — ${talentProfile.headline}
Skills: ${talentProfile.skills.map((s) => `${s.name} (${s.level})`).join(', ')}
Job: ${jobDetails.title}
Required Skills: ${jobDetails.structured.skills.map((s) => `${s.name} (${s.required ? 'must-have' : 'nice-to-have'})`).join(', ')}
Seniority: ${jobDetails.structured.seniority}
Match Score: ${score}/100

Explain why this talent is ${score >= 80 ? 'a strong' : score >= 60 ? 'a moderate' : 'a weak'} match for this role. Mention specific skill alignments and gaps.`,
    maxOutputTokens: 200,
  });

  return text;
}

/**
 * Run the full matching pipeline for a single job.
 *
 * 1. Query pgvector for top 50 talent profiles by cosine similarity
 * 2. Compute feature score for each candidate
 * 3. Compute hybrid score (0.4 * semantic + 0.6 * feature)
 * 4. Upsert results into the matches table
 * 5. For top 10, generate AI reasoning
 * 6. Create inbox notifications for high matches (>80%)
 */
export async function scanMatchesForJob(jobId: string): Promise<number> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const structured = job.structured as StructuredJob;

  // Step 1: Semantic search via pgvector
  const semanticMatches = await findSemanticMatches(jobId);

  if (semanticMatches.length === 0) {
    console.log(`[scan-matches] No embeddings found for job ${jobId}`);
    return 0;
  }

  // Step 2+3: Feature scoring + hybrid score for each candidate
  const scoredCandidates = semanticMatches.map((talent) => {
    const talentSkills = (talent.skills || []) as Skill[];
    const availability = talent.availability || 'open';

    const featureResult = computeFeatureScore(
      talentSkills,
      structured,
      availability
    );

    const semanticScore = Math.round((talent.cosineSimilarity ?? 0) * 100);
    const totalScore = computeHybridScore(semanticScore, featureResult.score);

    return {
      talentId: talent.id,
      displayName: talent.displayName,
      headline: talent.headline,
      skills: talentSkills,
      semanticScore,
      featureScore: featureResult.score,
      totalScore,
      breakdown: {
        semantic: semanticScore,
        feature: featureResult.score,
        dimensions: featureResult.dimensions,
      } satisfies MatchBreakdown,
    };
  });

  scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

  // Step 4: Upsert matches into DB
  for (const candidate of scoredCandidates) {
    await db
      .insert(matches)
      .values({
        jobId,
        talentId: candidate.talentId,
        score: candidate.totalScore,
        breakdown: candidate.breakdown,
        status: 'new',
      })
      .onConflictDoUpdate({
        target: [matches.jobId, matches.talentId],
        set: {
          score: candidate.totalScore,
          breakdown: candidate.breakdown,
        },
      });
  }

  // Step 5: Generate AI reasoning for top 10
  const topCandidates = scoredCandidates.slice(0, TOP_N_REASONING);

  for (const candidate of topCandidates) {
    try {
      const reasoning = await generateMatchReasoning(
        {
          displayName: candidate.displayName,
          headline: candidate.headline,
          skills: candidate.skills,
        },
        {
          title: job.title,
          structured,
        },
        candidate.totalScore
      );

      await db
        .update(matches)
        .set({ aiReasoning: reasoning })
        .where(
          and(
            eq(matches.jobId, jobId),
            eq(matches.talentId, candidate.talentId)
          )
        );
    } catch (error) {
      console.error(
        `[scan-matches] Failed to generate reasoning for talent ${candidate.talentId}:`,
        error
      );
    }
  }

  // Step 6: Create inbox notifications for high matches (>80%)
  const highMatches = scoredCandidates.filter(
    (c) => c.totalScore >= HIGH_MATCH_THRESHOLD
  );

  for (const candidate of highMatches) {
    const talentProfile = await db.query.talentProfiles.findFirst({
      where: eq(talentProfiles.id, candidate.talentId),
    });

    if (talentProfile?.userId) {
      await db.insert(inboxItems).values({
        userId: talentProfile.userId,
        itemType: 'match_notification',
        title: `New high match: ${job.title}`,
        content: {
          jobId,
          jobTitle: job.title,
          score: candidate.totalScore,
          breakdown: candidate.breakdown,
        },
      });
    }

    if (job.enterpriseId) {
      const enterpriseProfile = await db.query.enterpriseProfiles.findFirst({
        where: eq(enterpriseProfiles.id, job.enterpriseId),
      });

      if (enterpriseProfile?.userId) {
        await db.insert(inboxItems).values({
          userId: enterpriseProfile.userId,
          itemType: 'match_notification',
          title: `High match found: ${candidate.displayName} for ${job.title}`,
          content: {
            talentId: candidate.talentId,
            talentName: candidate.displayName,
            jobId,
            jobTitle: job.title,
            score: candidate.totalScore,
          },
        });
      }
    }
  }

  console.log(
    `[scan-matches] Job ${jobId}: ${scoredCandidates.length} matches, ${highMatches.length} high matches`
  );

  return scoredCandidates.length;
}
