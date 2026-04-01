import { apiFetch } from './client';

export interface TalentHomeStats {
  companiesExplored: number;
  preChatsActive: number;
  invitesReceived: number;
  matchesFound: number;
  seekingReportReady: boolean;
}

export async function getTalentHomeStats(): Promise<TalentHomeStats> {
  return apiFetch<TalentHomeStats>('/api/v1/talent/home-stats');
}
