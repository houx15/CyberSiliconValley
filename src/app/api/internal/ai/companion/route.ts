import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { buildSystemPrompt } from '@/lib/ai/prompts/_base';
import {
  COMPANION_GENERAL_PROMPT,
  COMPANION_HOME_PROMPT,
  COMPANION_COACH_PROMPT,
} from '@/lib/ai/prompts/companion';
import { getOrCreateSession, loadChatHistory, saveChatMessage } from '@/lib/ai/chat';
import type { SessionType } from '@/types';

const SESSION_PROMPTS: Record<string, string> = {
  general: COMPANION_GENERAL_PROMPT,
  home: COMPANION_HOME_PROMPT,
  coach: COMPANION_COACH_PROMPT,
};

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { messages, sessionType = 'general' } = body as {
      messages: Array<{ role: string; content: string }>;
      sessionType?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'VALIDATION_ERROR', message: 'messages required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or create chat session
    const validSessionType = (
      ['general', 'coach'].includes(sessionType) ? sessionType : 'general'
    ) as SessionType;
    const session = await getOrCreateSession(userId, validSessionType);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to create session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load existing chat history
    const history = await loadChatHistory(session.id);

    // Save the latest user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      await saveChatMessage(session.id, 'user', lastMessage.content);
    }

    // Build system prompt
    const featurePrompt = SESSION_PROMPTS[sessionType] || COMPANION_GENERAL_PROMPT;
    const systemPrompt = buildSystemPrompt(featurePrompt);

    // Combine history + new messages for context (deduplicated)
    const allMessages = [
      ...history,
      ...messages.filter(
        (m: { role: string; content: string }) =>
          !history.some((h) => h.content === m.content && h.role === m.role)
      ),
    ];

    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages: allMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      onFinish: async ({ text }) => {
        try {
          if (text && session) {
            await saveChatMessage(session.id, 'assistant', text);
          }
        } catch (e) {
          console.warn('Failed to save assistant message:', e);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Companion AI error:', error);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
