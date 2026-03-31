import { streamText, zodSchema } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { buildSystemPrompt } from '@/lib/ai/prompts/_base';
import { JD_PARSE_PROMPT } from '@/lib/ai/prompts/jd-parse';
import {
  getOrCreateSession,
  loadChatHistory,
  saveChatMessage,
  getSessionContext,
} from '@/lib/ai/chat';

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { messages } = await req.json();
  const session = await getOrCreateSession(userId, 'jd_parse');
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
  const systemPrompt = buildSystemPrompt(JD_PARSE_PROMPT, context);

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: history,
    tools: {
      structureJob: {
        description: 'Return the structured job data extracted from the JD',
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
              .describe('Skills with level and required/nice-to-have'),
            seniority: z.string().describe('Junior, Mid, Senior, or Lead'),
            timeline: z.string().describe('Start date and duration'),
            deliverables: z.array(z.string()).describe('Expected deliverables'),
            budget: z.object({
              min: z.number().optional(),
              max: z.number().optional(),
              currency: z.string().default('USD'),
            }),
            workMode: z.enum(['remote', 'onsite', 'hybrid']).default('remote'),
          })
        ),
        execute: async (data: {
          title: string;
          description: string;
          skills: Array<{ name: string; level: string; required: boolean }>;
          seniority: string;
          timeline: string;
          deliverables: string[];
          budget: { min?: number; max?: number; currency: string };
          workMode: 'remote' | 'onsite' | 'hybrid';
        }) => {
          return {
            success: true,
            structured: {
              title: data.title,
              description: data.description,
              skills: data.skills,
              seniority: data.seniority,
              timeline: data.timeline,
              deliverables: data.deliverables,
              budget: data.budget,
              workMode: data.workMode,
            },
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
