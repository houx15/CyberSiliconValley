import { NextRequest } from 'next/server';
import { streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getModel } from '@/lib/ai/providers';
import { buildCoachSystemPrompt, COACH_TOOLS } from '@/lib/ai/prompts/coach';
import {
  getOrCreateSession,
  getSessionContext,
  updateSessionContext,
  saveChatMessage,
} from '@/lib/ai/chat';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs, matches, talentProfiles } from '@/lib/db/schema';
import type { CoachMode } from '@/types/graph';
import type { Skill } from '@/types';

const VALID_MODES: CoachMode[] = ['chat', 'resume-review', 'mock-interview', 'skill-gaps'];
const COACH_THREAD_CONTEXT_KEY = 'coachThreads';

type CoachTranscriptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type CoachThreadMap = Partial<Record<CoachMode, CoachTranscriptMessage[]>>;

function isCoachMode(mode: unknown): mode is CoachMode {
  return typeof mode === 'string' && VALID_MODES.includes(mode as CoachMode);
}

function extractMessageText(message: { content?: string; parts?: Array<{ type: string; text?: string }> }) {
  const textFromParts = message.parts
    ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');

  return (textFromParts || message.content || '').trim();
}

function normalizeTranscriptMessages(
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
): CoachTranscriptMessage[] {
  return messages
    .map((message) => ({
      role: message.role as CoachTranscriptMessage['role'],
      content: extractMessageText(message),
    }))
    .filter((message) => message.content.length > 0);
}

function dedupeTranscript(
  existing: CoachTranscriptMessage[],
  incoming: CoachTranscriptMessage[]
) {
  const seen = new Set(existing.map((message) => `${message.role}:${message.content}`));
  return incoming.filter((message) => {
    const key = `${message.role}:${message.content}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatRecentMatchSummary(rows: Array<{ score: number; jobTitle: string | null; companyName: string | null }>) {
  if (rows.length === 0) {
    return 'No recent matches yet. Use the conversation to explore target roles, skill gaps, and opportunities.';
  }

  const topMatches = rows.slice(0, 5).map((row) => {
    const title = row.jobTitle || 'Untitled role';
    const company = row.companyName || 'Unknown company';
    return `${title} at ${company} (${Math.round(row.score)}%)`;
  });

  const highMatches = rows.filter((row) => row.score >= 80).length;
  const mediumMatches = rows.filter((row) => row.score >= 60 && row.score < 80).length;

  return [
    `${highMatches} high matches (>80%)`,
    `${mediumMatches} medium matches (60-80%)`,
    `Top matches: ${topMatches.join(', ')}`,
  ].join('. ');
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    let auth;
    try {
      auth = await verifyJWT(token);
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }

    if (auth.role !== 'talent') {
      return new Response('Forbidden', { status: 403 });
    }

    const body = (await request.json()) as {
      messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
      mode?: CoachMode;
    };

    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mode = isCoachMode(body.mode) ? body.mode : 'chat';
    const session = await getOrCreateSession(auth.userId, 'coach');
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to create session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const context = await getSessionContext(session.id);
    const coachThreads = (context[COACH_THREAD_CONTEXT_KEY] as CoachThreadMap | undefined) ?? {};
    const modeHistory = coachThreads[mode] ?? [];
    const normalizedMessages = normalizeTranscriptMessages(messages);
    const newMessages = dedupeTranscript(modeHistory, normalizedMessages);
    const threadHistory = [...modeHistory, ...newMessages];

    await updateSessionContext(session.id, {
      ...context,
      [COACH_THREAD_CONTEXT_KEY]: {
        ...coachThreads,
        [mode]: threadHistory,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const lastUserMessage = lastMessage?.role === 'user' ? extractMessageText(lastMessage) : '';

    if (lastUserMessage.trim()) {
      await saveChatMessage(session.id, 'user', lastUserMessage);
    }

    const [profile] = await db
      .select()
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, auth.userId))
      .limit(1);

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Talent profile not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const recentMatches = await db
      .select({
        score: matches.score,
        jobTitle: jobs.title,
        companyName: enterpriseProfiles.companyName,
      })
      .from(matches)
      .innerJoin(jobs, eq(matches.jobId, jobs.id))
      .leftJoin(enterpriseProfiles, eq(jobs.enterpriseId, enterpriseProfiles.id))
      .where(eq(matches.talentId, profile.id))
      .orderBy(desc(matches.score))
      .limit(20);

    const skillList = (profile.skills as Skill[] | null | undefined) ?? [];
    const systemPrompt = buildCoachSystemPrompt(mode, {
      profileJson: JSON.stringify({
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        skills: skillList,
        experience: profile.experience,
        education: profile.education,
        goals: profile.goals,
        availability: profile.availability,
      }),
      goals: JSON.stringify(profile.goals || {}),
      recentMatchesSummary: formatRecentMatchSummary(recentMatches),
    });

    const allMessages = [
      ...threadHistory,
    ];

    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages: allMessages.map((message) => ({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content ?? '',
      })),
      tools: {
        updateProfileField: tool({
          description: COACH_TOOLS[0]!.function.description,
          inputSchema: zodSchema(
            z.object({
              field: z.enum(['headline', 'bio', 'skills', 'experience', 'education', 'goals', 'availability']),
              value: z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.null(),
                z.array(z.unknown()),
                z.record(z.string(), z.unknown()),
              ]),
            })
          ),
          execute: async ({ field, value }: { field: string; value: unknown }) => {
            const allowedFields = ['headline', 'bio', 'skills', 'experience', 'education', 'goals', 'availability'];
            if (!allowedFields.includes(field)) {
              return { success: false, error: `Field "${field}" is not updatable` };
            }

            const updateData: Record<string, unknown> = { updatedAt: new Date() };
            updateData[field] = value;

            await db
              .update(talentProfiles)
              .set(updateData)
              .where(eq(talentProfiles.userId, auth.userId));

            return { success: true, field, message: `Updated ${field} successfully` };
          },
        }),
        suggestSkill: tool({
          description: COACH_TOOLS[1]!.function.description,
          inputSchema: zodSchema(
            z.object({
              name: z.string(),
              reason: z.string(),
            })
          ),
          execute: async ({ name, reason }: { name: string; reason: string }) => {
            return {
              success: true,
              suggestion: { name, reason },
              message: `Suggested skill: ${name}`,
            };
          },
        }),
      },
      onFinish: async ({ text }) => {
        if (text) {
          await saveChatMessage(session.id, 'assistant', text);
          await updateSessionContext(session.id, {
            ...context,
            [COACH_THREAD_CONTEXT_KEY]: {
              ...coachThreads,
              [mode]: [...threadHistory, { role: 'assistant', content: text }],
            },
          });
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Coach AI error:', error);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
