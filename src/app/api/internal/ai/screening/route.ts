import { NextRequest } from 'next/server';
import { streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { screeningSystemPrompt } from '@/lib/ai/prompts/screening';
import {
  loadChatHistory,
  saveChatMessage,
  getOrCreateSession,
} from '@/lib/ai/chat';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  talentProfiles,
  jobs,
  matches,
  enterpriseProfiles,
} from '@/lib/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import type { Skill } from '@/types';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload;
  try {
    payload = await verifyJWT(token);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  if (payload.role !== 'enterprise') {
    return new Response('Forbidden', { status: 403 });
  }

  const { message } = await request.json();

  // Load enterprise context
  const enterprise = await db.query.enterpriseProfiles.findFirst({
    where: eq(enterpriseProfiles.userId, payload.userId),
  });

  const activeJobs = await db.query.jobs.findMany({
    where: eq(jobs.status, 'open'),
  });

  const enterpriseJobs = enterprise
    ? activeJobs.filter((j) => j.enterpriseId === enterprise.id)
    : [];

  // Get or create screening chat session
  const session = await getOrCreateSession(payload.userId, 'screening');

  // Load chat history
  const history = await loadChatHistory(session!.id);

  // Save user message
  await saveChatMessage(session!.id, 'user', message);

  const model = getModel();
  const systemPrompt = screeningSystemPrompt({
    companyName: enterprise?.companyName || 'Your Company',
    activeJobs: enterpriseJobs.map((j) => ({ id: j.id, title: j.title || 'Untitled' })),
  });

  const result = streamText({
    model,
    system: systemPrompt,
    messages: [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ],
    tools: {
      searchTalent: tool({
        description:
          'Search the talent pool by query text and optional filters. Returns ranked candidates with match scores.',
        inputSchema: zodSchema(
          z.object({
            query: z
              .string()
              .describe('Search query — skills, role, or description of ideal candidate'),
            filters: z
              .object({
                availability: z
                  .enum(['open', 'busy', 'not_looking'])
                  .optional()
                  .describe('Filter by availability'),
                minScore: z
                  .number()
                  .optional()
                  .describe('Minimum match score (0-100)'),
                jobId: z
                  .string()
                  .optional()
                  .describe('Job ID to match against'),
              })
              .optional()
              .describe('Optional filters'),
          })
        ),
        execute: async ({ query, filters }: { query: string; filters?: { availability?: string; minScore?: number; jobId?: string } }) => {
          // If a jobId is provided, use existing matches
          if (filters?.jobId) {
            const existingMatches = await db
              .select({
                talentId: matches.talentId,
                score: matches.score,
                breakdown: matches.breakdown,
                aiReasoning: matches.aiReasoning,
                displayName: talentProfiles.displayName,
                headline: talentProfiles.headline,
                skills: talentProfiles.skills,
                availability: talentProfiles.availability,
              })
              .from(matches)
              .leftJoin(
                talentProfiles,
                eq(matches.talentId, talentProfiles.id)
              )
              .where(eq(matches.jobId, filters.jobId))
              .orderBy(desc(matches.score))
              .limit(20);

            return {
              candidates: existingMatches.map((m) => ({
                talentId: m.talentId,
                name: m.displayName,
                headline: m.headline,
                skills: m.skills,
                availability: m.availability,
                matchScore: m.score,
                reasoning: m.aiReasoning,
              })),
              total: existingMatches.length,
            };
          }

          // Otherwise, do a semantic search using pgvector
          const { generateEmbedding } = await import(
            '@/lib/matching/embedding'
          );
          const queryEmbedding = await generateEmbedding(query);

          const results = await db.execute(sql`
            SELECT
              tp.id as "talentId",
              tp.display_name as "displayName",
              tp.headline,
              tp.skills,
              tp.availability,
              1 - (tp.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
            FROM talent_profiles tp
            WHERE tp.embedding IS NOT NULL
            ${filters?.availability ? sql`AND tp.availability = ${filters.availability}` : sql``}
            ORDER BY tp.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
            LIMIT 20
          `);

          const candidates = (results as unknown as Array<Record<string, unknown>>).map(
            (r) => ({
              talentId: r.talentId as string,
              name: r.displayName as string,
              headline: r.headline as string,
              skills: r.skills,
              availability: r.availability as string,
              matchScore: Math.round(
                ((r.similarity as number) ?? 0) * 100
              ),
            })
          );

          return {
            candidates: filters?.minScore
              ? candidates.filter(
                  (c) => c.matchScore >= (filters.minScore ?? 0)
                )
              : candidates,
            total: candidates.length,
          };
        },
      }),

      compareCandidates: tool({
        description:
          'Compare multiple candidates side-by-side on specific skill dimensions. Returns a comparison matrix.',
        inputSchema: zodSchema(
          z.object({
            talentIds: z
              .array(z.string())
              .min(2)
              .max(5)
              .describe('Talent profile IDs to compare'),
            dimensions: z
              .array(z.string())
              .describe('Skill or attribute names to compare on'),
          })
        ),
        execute: async ({ talentIds, dimensions }: { talentIds: string[]; dimensions: string[] }) => {
          const profiles = [];

          for (const talentId of talentIds) {
            const profile = await db.query.talentProfiles.findFirst({
              where: eq(talentProfiles.id, talentId),
            });

            if (profile) {
              const skills = (profile.skills || []) as Skill[];
              const dimensionScores: Record<string, string> = {};

              for (const dim of dimensions) {
                const skill = skills.find(
                  (s) =>
                    s.name.toLowerCase() === dim.toLowerCase()
                );
                dimensionScores[dim] = skill
                  ? `${skill.level} ✓`
                  : 'Not listed ✗';
              }

              profiles.push({
                talentId,
                name: profile.displayName,
                headline: profile.headline,
                dimensions: dimensionScores,
                availability: profile.availability,
              });
            }
          }

          return { comparison: profiles };
        },
      }),

      shortlistCandidate: tool({
        description:
          'Add a candidate to the shortlist for a specific job. Updates the match status to shortlisted.',
        inputSchema: zodSchema(
          z.object({
            talentId: z.string().describe('Talent profile ID to shortlist'),
            jobId: z.string().describe('Job ID to shortlist for'),
          })
        ),
        execute: async ({ talentId, jobId }: { talentId: string; jobId: string }) => {
          const existingMatch = await db.query.matches.findFirst({
            where: and(
              eq(matches.jobId, jobId),
              eq(matches.talentId, talentId)
            ),
          });

          if (existingMatch) {
            await db
              .update(matches)
              .set({ status: 'shortlisted' })
              .where(eq(matches.id, existingMatch.id));
          } else {
            await db.insert(matches).values({
              jobId,
              talentId,
              score: 0,
              breakdown: { semantic: 0, feature: 0, dimensions: {} },
              status: 'shortlisted',
            });
          }

          const talent = await db.query.talentProfiles.findFirst({
            where: eq(talentProfiles.id, talentId),
          });
          const targetJob = await db.query.jobs.findFirst({
            where: eq(jobs.id, jobId),
          });

          return {
            success: true,
            message: `${talent?.displayName ?? 'Candidate'} has been shortlisted for "${targetJob?.title ?? 'the position'}"`,
          };
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session!.id, 'assistant', text);
      }
    },
  });

  return result.toTextStreamResponse();
}
