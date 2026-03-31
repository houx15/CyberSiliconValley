import { streamText, zodSchema } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { buildSystemPrompt } from '@/lib/ai/prompts/_base';
import { ENTERPRISE_ONBOARDING_PROMPT } from '@/lib/ai/prompts/enterprise-onboarding';
import {
  getOrCreateSession,
  loadChatHistory,
  saveChatMessage,
  updateSessionContext,
  getSessionContext,
} from '@/lib/ai/chat';
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { embedQueue, matchQueue } from '@/lib/jobs/queue';
import type { EmbedJobData, ScanMatchJobData } from '@/lib/jobs/queue';

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { messages } = await req.json();
  const session = await getOrCreateSession(userId, 'enterprise_onboarding');
  if (!session) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), { status: 500 });
  }
  const context = await getSessionContext(session.id);

  // Save incoming user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'user') {
    await saveChatMessage(session.id, 'user', lastMessage.content);
  }

  const history = await loadChatHistory(session.id);
  const systemPrompt = buildSystemPrompt(ENTERPRISE_ONBOARDING_PROMPT, context);

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: history,
    tools: {
      setCompanyProfile: {
        description: 'Save the company profile with gathered information',
        inputSchema: zodSchema(
          z.object({
            companyName: z.string().describe('The company name'),
            industry: z.string().describe('The industry sector'),
            companySize: z.string().describe('Company size range, e.g. "50-200", "1000+"'),
            website: z.string().optional().describe('Company website URL'),
            description: z.string().describe('Brief company description'),
            aiMaturity: z
              .string()
              .optional()
              .describe('AI adoption level: early, growing, mature, or leading'),
          })
        ),
        execute: async (data: {
          companyName: string;
          industry: string;
          companySize: string;
          website?: string;
          description: string;
          aiMaturity?: string;
        }) => {
          const [existing] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, userId))
            .limit(1);

          if (existing) {
            await db
              .update(enterpriseProfiles)
              .set({
                companyName: data.companyName,
                industry: data.industry,
                companySize: data.companySize,
                website: data.website || null,
                description: data.description,
                aiMaturity: data.aiMaturity || null,
                updatedAt: new Date(),
              })
              .where(eq(enterpriseProfiles.id, existing.id));
          } else {
            await db.insert(enterpriseProfiles).values({
              userId,
              companyName: data.companyName,
              industry: data.industry,
              companySize: data.companySize,
              website: data.website || null,
              description: data.description,
              aiMaturity: data.aiMaturity || null,
            });
          }

          await updateSessionContext(session.id, {
            ...context,
            step: 'company_confirmed',
            companyName: data.companyName,
            industry: data.industry,
            companySize: data.companySize,
            website: data.website,
            description: data.description,
            aiMaturity: data.aiMaturity,
          });

          return { success: true, message: 'Company profile saved' };
        },
      },

      createJob: {
        description: 'Create the first job posting from the gathered requirements',
        inputSchema: zodSchema(
          z.object({
            title: z.string().describe('Job title or project name'),
            description: z.string().describe('Full job/project description'),
            skills: z
              .array(
                z.object({
                  name: z.string(),
                  level: z.string(),
                  required: z.boolean(),
                })
              )
              .describe('Required and nice-to-have skills'),
            seniority: z.string().describe('Seniority level: Junior, Mid, Senior, or Lead'),
            timeline: z.string().describe('Timeline information'),
            deliverables: z.array(z.string()).optional().describe('Expected deliverables'),
            budget: z
              .object({
                min: z.number().optional(),
                max: z.number().optional(),
                currency: z.string().default('USD'),
              })
              .optional()
              .describe('Budget range'),
            workMode: z
              .enum(['remote', 'onsite', 'hybrid'])
              .default('remote')
              .describe('Work mode preference'),
          })
        ),
        execute: async (data: {
          title: string;
          description: string;
          skills: Array<{ name: string; level: string; required: boolean }>;
          seniority: string;
          timeline: string;
          deliverables?: string[];
          budget?: { min?: number; max?: number; currency: string };
          workMode: 'remote' | 'onsite' | 'hybrid';
        }) => {
          const [profile] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, userId))
            .limit(1);

          if (!profile) {
            return {
              success: false,
              message: 'Company profile not found. Please set up your company first.',
            };
          }

          const structured = {
            skills: data.skills,
            seniority: data.seniority,
            timeline: data.timeline,
            deliverables: data.deliverables || [],
            budget: data.budget || { currency: 'USD' },
            workMode: data.workMode,
          };

          const [job] = await db
            .insert(jobs)
            .values({
              enterpriseId: profile.id,
              title: data.title,
              description: data.description,
              structured,
              status: 'open',
              autoMatch: true,
              autoPrechat: false,
            })
            .returning();

          if (job) {
            // Queue background jobs
            try {
              await embedQueue.add('embed-job', {
                type: 'job',
                id: job.id,
              } satisfies EmbedJobData);
              await matchQueue.add('scan-matches', {
                jobId: job.id,
              } satisfies ScanMatchJobData);
            } catch {
              // Queue might not be available in dev
            }

            await updateSessionContext(session.id, {
              ...context,
              step: 'job_created',
              jobId: job.id,
              jobTitle: data.title,
            });

            return { success: true, message: 'Job posting created', jobId: job.id };
          }

          return { success: false, message: 'Failed to create job' };
        },
      },

      completeOnboarding: {
        description: 'Mark onboarding as complete and redirect user to dashboard',
        inputSchema: zodSchema(
          z.object({
            autoMatch: z.boolean().default(true).describe('Enable automatic matching'),
            autoPrechat: z
              .boolean()
              .default(false)
              .describe('Enable automatic pre-screening chats'),
            dealBreakers: z
              .array(z.string())
              .optional()
              .describe('Absolute requirements or deal-breakers'),
          })
        ),
        execute: async (data: {
          autoMatch: boolean;
          autoPrechat: boolean;
          dealBreakers?: string[];
        }) => {
          const [profile] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, userId))
            .limit(1);

          if (!profile) {
            return { success: false, message: 'Company profile not found.' };
          }

          await db
            .update(enterpriseProfiles)
            .set({
              onboardingDone: true,
              preferences: {
                autoMatch: data.autoMatch,
                autoPrechat: data.autoPrechat,
                dealBreakers: data.dealBreakers || [],
              },
              updatedAt: new Date(),
            })
            .where(eq(enterpriseProfiles.id, profile.id));

          const ctx = await getSessionContext(session.id);
          if (ctx.jobId) {
            await db
              .update(jobs)
              .set({
                autoMatch: data.autoMatch,
                autoPrechat: data.autoPrechat,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, ctx.jobId as string));
          }

          await updateSessionContext(session.id, {
            ...ctx,
            step: 'complete',
            onboardingDone: true,
          });

          return {
            success: true,
            message: 'Onboarding complete',
            redirect: '/enterprise/dashboard',
          };
        },
      },
    },
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session.id, 'assistant', text);
      }
    },
  });

  return result.toTextStreamResponse();
}
