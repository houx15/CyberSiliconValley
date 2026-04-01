import { apiFetch } from '@/lib/api/client';

export interface ScanSummary {
  totalScanned: number;
  highMatches: number;
  mediumMatches: number;
  periodLabel: string;
}

export interface HighMatchItem {
  matchId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  workMode: string;
  score: number;
  skillMatches: Array<{
    skill: string;
    matched: boolean;
    level: string;
  }>;
  aiAssessment: string;
}

export interface PreChatItem {
  inboxItemId: string;
  companyName: string;
  jobTitle: string;
  summary: string;
  generatedAt: string;
}

export interface InboundInterestItem {
  matchId: string;
  companyName: string;
  reason: string;
  score: number;
  jobId: string;
}

export interface SeekingReportData {
  scanSummary: ScanSummary;
  highMatches: HighMatchItem[];
  preChatActivity: PreChatItem[];
  inboundInterest: InboundInterestItem[];
  generatedAt: string;
}

export async function getLatestReportByTalentId(
  _talentId?: string
): Promise<SeekingReportData | null> {
  const response = await apiFetch<{ data: SeekingReportData | null }>('/api/v1/seeking');
  return response.data;
}

export async function getLatestReportByUserId(
  _userId?: string
): Promise<SeekingReportData | null> {
  const response = await apiFetch<{ data: SeekingReportData | null }>('/api/v1/seeking');
  return response.data;
}

export async function upsertReport(
  talentId: string,
  reportData: SeekingReportData
): Promise<void> {
  throw new Error(`Frontend seeking writes are no longer supported for ${talentId}:${reportData.generatedAt}`);
}
