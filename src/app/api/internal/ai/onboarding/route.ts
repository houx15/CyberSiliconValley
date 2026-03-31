import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod/v4';
import { getModel } from '@/lib/ai/providers';
import {
  getOrCreateSession,
  loadChatHistory,
  saveChatMessage,
  updateSessionContext,
  getSessionContext,
} from '@/lib/ai/chat';
import { buildOnboardingPrompt } from '@/lib/ai/prompts/onboarding';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function POST(req: Request) {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  const clientMessages = body.messages as Array<{
    role: string;
    parts?: Array<{ type: string; text?: string }>;
    content?: string;
  }>;
  const lastMsg = clientMessages?.[clientMessages.length - 1];

  if (!lastMsg || lastMsg.role !== 'user') {
    return new Response(JSON.stringify({ error: 'No user message provided' }), { status: 400 });
  }

  const userText =
    lastMsg.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('') ||
    lastMsg.content ||
    '';

  if (!userText) {
    return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400 });
  }

  const session = await getOrCreateSession(userId, 'onboarding');
  if (!session) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), { status: 500 });
  }

  const context = await getSessionContext(session.id);

  const existingProfiles = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.userId, userId))
    .limit(1);

  let profile = existingProfiles[0];

  if (!profile) {
    const inserted = await db.insert(talentProfiles).values({ userId }).returning();
    profile = inserted[0];
  }

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Failed to create profile' }), { status: 500 });
  }

  const profileRef = { current: profile };
  const history = await loadChatHistory(session.id);

  await saveChatMessage(session.id, 'user', userText);

  const systemPrompt = buildOnboardingPrompt(context);

  const revealFieldSchema = z.object({
    field: z.enum(['displayName', 'headline', 'bio', 'experience', 'goals']),
    value: z.unknown(),
  });

  const skillSchema = z.object({
    name: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    category: z.string(),
  });

  const completeSchema = z.object({
    summary: z.string(),
  });

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: [...history, { role: 'user' as const, content: userText }],
    tools: {
      revealProfileField: tool({
        description:
          "Reveal a profile field on the user's screen and save it to their profile.",
        inputSchema: revealFieldSchema,
        execute: async ({ field, value }) => {
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          const contextUpdate: Record<string, unknown> = { ...context };

          if (field === 'displayName' || field === 'headline' || field === 'bio') {
            updateData[field] = value;
            contextUpdate[field] = value;
          } else if (field === 'experience') {
            const currentExp =
              (profileRef.current.experience as object[] | null) || [];
            const newExp = [...currentExp, value];
            updateData.experience = newExp;
            contextUpdate.experience = newExp;
          } else if (field === 'goals') {
            const currentGoals =
              (profileRef.current.goals as Record<string, unknown> | null) || {};
            const mergedGoals = { ...currentGoals, ...(value as Record<string, unknown>) };
            updateData.goals = mergedGoals;
            contextUpdate.goals = mergedGoals;
          }

          await db
            .update(talentProfiles)
            .set(updateData)
            .where(eq(talentProfiles.userId, userId));
          await updateSessionContext(session.id, contextUpdate);

          return { success: true, field, value };
        },
      }),

      addSkillTag: tool({
        description:
          "Add a skill tag to the user's profile.",
        inputSchema: skillSchema,
        execute: async ({ name, level, category }) => {
          const currentSkills =
            (profileRef.current.skills as Array<{
              name: string;
              level: string;
              category: string;
            }> | null) || [];

          if (currentSkills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
            return { success: true, duplicate: true, name };
          }

          const newSkill = { name, level, category };
          const updatedSkills = [...currentSkills, newSkill];

          await db
            .update(talentProfiles)
            .set({ skills: updatedSkills, updatedAt: new Date() })
            .where(eq(talentProfiles.userId, userId));

          const contextUpdate: Record<string, unknown> = { ...context, skills: updatedSkills };
          await updateSessionContext(session.id, contextUpdate);

          profileRef.current = { ...profileRef.current, skills: updatedSkills };

          return { success: true, name, level, category };
        },
      }),

      completeOnboarding: tool({
        description: 'Mark onboarding as complete.',
        inputSchema: completeSchema,
        execute: async ({ summary }) => {
          await db
            .update(talentProfiles)
            .set({ onboardingDone: true, updatedAt: new Date() })
            .where(eq(talentProfiles.userId, userId));

          await updateSessionContext(session.id, {
            ...context,
            onboardingComplete: true,
            summary,
          });

          return { success: true, message: 'Onboarding complete!' };
        },
      }),
    },
    stopWhen: stepCountIs(5),
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session.id, 'assistant', text);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
