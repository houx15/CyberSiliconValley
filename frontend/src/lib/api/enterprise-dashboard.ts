import { apiFetch } from './client';

export interface WorkbenchStats {
  resumesScanned: number;
  preliminaryMatches: number;
  preChatCompleted: number;
  invitesSent: number;
  invitesAccepted: number;
  interviewsScheduled: number;
  activeOpportunities: number;
  talentPoolSize: number;
}

export async function getWorkbenchStats(): Promise<WorkbenchStats> {
  return apiFetch<WorkbenchStats>('/api/v1/enterprise/workbench-stats');
}
