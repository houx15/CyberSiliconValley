import { apiFetch, apiPost } from './client';

export type PreChatStatus =
  | 'pending_talent_opt_in'
  | 'pending_enterprise_opt_in'
  | 'active'
  | 'completed'
  | 'declined';

export interface PreChat {
  id: string;
  jobId: string;
  talentId: string;
  enterpriseId: string;
  status: PreChatStatus;
  talentOptedIn: boolean;
  enterpriseOptedIn: boolean;
  aiSummary: string | null;
  roundCount: number;
  maxRounds: number;
  createdAt: string;
  updatedAt: string;
}

export interface PreChatMessage {
  id: string;
  preChatId: string;
  senderType: 'ai_hr' | 'ai_talent' | 'human_enterprise' | 'human_talent';
  content: string;
  roundNumber: number;
  createdAt: string;
}

export interface PreChatWithMessages extends PreChat {
  messages: PreChatMessage[];
}

export interface MemoryEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface MemorySpace {
  id: string;
  ownerId: string;
  scopeType: 'talent_global' | 'enterprise_job' | 'enterprise_global';
  scopeRefId: string | null;
  entries: MemoryEntry[];
}

export async function initiatePreChat(jobId: string, talentId: string): Promise<PreChat> {
  return apiPost<PreChat>('/api/v1/prechat/initiate', { jobId, talentId });
}

export async function optInPreChat(preChatId: string): Promise<PreChat> {
  return apiPost<PreChat>(`/api/v1/prechat/${preChatId}/opt-in`, {});
}

export async function getPreChat(preChatId: string): Promise<PreChatWithMessages> {
  return apiFetch<PreChatWithMessages>(`/api/v1/prechat/${preChatId}`);
}

export async function sendHumanReply(preChatId: string, content: string): Promise<PreChatMessage> {
  return apiPost<PreChatMessage>(`/api/v1/prechat/${preChatId}/human-reply`, { content });
}

export async function getPreChatSummary(preChatId: string): Promise<{ summary: string }> {
  return apiFetch<{ summary: string }>(`/api/v1/prechat/${preChatId}/summary`);
}

export async function getMemorySpace(scopeType: string, scopeRefId?: string): Promise<MemorySpace> {
  const path = scopeRefId
    ? `/api/v1/memory/${scopeType}/${scopeRefId}`
    : `/api/v1/memory/${scopeType}`;
  return apiFetch<MemorySpace>(path);
}

export async function updateMemorySpace(
  scopeType: string,
  entries: MemoryEntry[],
  scopeRefId?: string
): Promise<MemorySpace> {
  const path = scopeRefId
    ? `/api/v1/memory/${scopeType}/${scopeRefId}`
    : `/api/v1/memory/${scopeType}`;
  return apiPost<MemorySpace>(path, { entries });
}
