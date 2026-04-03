import { apiFetch, apiPost } from './client';

/* ─── Types ─── */

export interface ConversationRecord {
  id: string;
  talentId: string;
  enterpriseId: string;
  jobId: string | null;
  preChatId: string | null;
  status: string;
  talentName: string;
  companyName: string;
  jobTitle: string | null;
  talentHeadline: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface DirectMessageRecord {
  id: string;
  conversationId: string;
  senderType: 'human_enterprise' | 'human_talent';
  content: string;
  createdAt: string;
}

export interface PreChatMessageRecord {
  id: string;
  preChatId: string;
  senderType: 'ai_hr' | 'ai_talent' | 'human_enterprise' | 'human_talent';
  content: string;
  roundNumber: number;
  createdAt: string;
}

interface ConversationListResponse {
  conversations: ConversationRecord[];
}

interface ConversationDetailResponse {
  conversation: ConversationRecord;
  messages: DirectMessageRecord[];
  preChatMessages: PreChatMessageRecord[] | null;
  hasMore: boolean;
}

interface SendMessageResponse {
  message: DirectMessageRecord;
}

interface PollMessagesResponse {
  messages: DirectMessageRecord[];
}

/* ─── API Functions ─── */

export async function listConversations(): Promise<ConversationRecord[]> {
  const res = await apiFetch<ConversationListResponse>('/api/v1/conversations');
  return res.conversations;
}

export async function getConversation(
  id: string
): Promise<ConversationDetailResponse> {
  return apiFetch<ConversationDetailResponse>(`/api/v1/conversations/${id}`);
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<DirectMessageRecord> {
  const res = await apiPost<SendMessageResponse>(
    `/api/v1/conversations/${conversationId}/messages`,
    { content }
  );
  return res.message;
}

export async function pollNewMessages(
  conversationId: string,
  after: string
): Promise<DirectMessageRecord[]> {
  const res = await apiFetch<PollMessagesResponse>(
    `/api/v1/conversations/${conversationId}/messages/poll?after=${encodeURIComponent(after)}`
  );
  return res.messages;
}
