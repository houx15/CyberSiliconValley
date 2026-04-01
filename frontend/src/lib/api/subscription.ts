import { apiFetch, apiPost } from './client';

export interface SubscriptionTier {
  id: string;
  name: string;
  role: 'talent' | 'enterprise';
  priceCents: number;
  currency: string;
  limits: {
    matchesPerDay?: number;
    preChatsPerDay?: number;
    coachSessionsPerDay?: number;
    jobPostings?: number;
    resumeScansPerDay?: number;
  };
  isActive: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tierId: string;
  tierName: string;
  status: 'active' | 'expired' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface UsageData {
  matchesToday: number;
  matchesLimit: number;
  preChatsToday: number;
  preChatsLimit: number;
  coachToday: number;
  coachLimit: number;
}

export async function listTiers(role: 'talent' | 'enterprise'): Promise<SubscriptionTier[]> {
  return apiFetch<SubscriptionTier[]>(`/api/v1/subscription/tiers?role=${role}`);
}

export async function getCurrentSubscription(): Promise<UserSubscription | null> {
  return apiFetch<UserSubscription | null>('/api/v1/subscription/current');
}

export async function getUsage(): Promise<UsageData> {
  return apiFetch<UsageData>('/api/v1/subscription/usage');
}

export async function upgradeTier(tierId: string): Promise<UserSubscription> {
  return apiPost<UserSubscription>('/api/v1/subscription/upgrade', { tierId });
}
