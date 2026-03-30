import { db } from '@/lib/db';
import { chatSessions, chatMessages } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { SessionType } from '@/types';

export async function getOrCreateSession(userId: string, sessionType: SessionType) {
  const [existing] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.sessionType, sessionType)))
    .limit(1);

  if (existing) return existing;

  const [session] = await db
    .insert(chatSessions)
    .values({ userId, sessionType })
    .returning();

  return session;
}

export async function loadChatHistory(sessionId: string) {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));
}

export async function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(chatMessages).values({
    sessionId,
    role,
    content,
    metadata: metadata || {},
  });
}

export async function updateSessionContext(sessionId: string, context: Record<string, unknown>) {
  await db
    .update(chatSessions)
    .set({ context, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function getSessionContext(sessionId: string): Promise<Record<string, unknown>> {
  const [session] = await db
    .select({ context: chatSessions.context })
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  return (session?.context as Record<string, unknown>) || {};
}
