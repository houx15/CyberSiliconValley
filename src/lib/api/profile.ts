import { ApiError, apiFetch } from '@/lib/api/client';
import type { Availability, Experience, Skill } from '@/types';

type ProfileRecord = Record<string, unknown>;

interface ProfileResponse {
  profile: ProfileRecord;
}

interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

interface Goals {
  targetRoles?: string[];
  workPreferences?: string[];
}

interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface TalentProfileData {
  id: string;
  userId: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  goals: Goals;
  availability: Availability;
  salaryRange: SalaryRange;
  resumeUrl: string | null;
  profileData: Record<string, unknown>;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnterpriseProfileData {
  id: string;
  userId: string;
  companyName: string;
  industry: string;
  companySize: string;
  website: string;
  description: string;
  aiMaturity: string;
  profileData: Record<string, unknown>;
  preferences: Record<string, unknown>;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function readString(record: ProfileRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

function readObject(record: ProfileRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function readArray(record: ProfileRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function readBoolean(record: ProfileRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return false;
}

function readDate(record: ProfileRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return new Date();
}

function isTalentProfile(record: ProfileRecord) {
  return 'display_name' in record || 'displayName' in record;
}

function isEnterpriseProfile(record: ProfileRecord) {
  return 'company_name' in record || 'companyName' in record;
}

function normalizeTalentProfile(record: ProfileRecord): TalentProfileData {
  return {
    id: readString(record, 'id') || '',
    userId: readString(record, 'user_id', 'userId') || '',
    displayName: readString(record, 'display_name', 'displayName'),
    headline: readString(record, 'headline'),
    bio: readString(record, 'bio'),
    skills: readArray(record, 'skills') as Skill[],
    experience: readArray(record, 'experience') as Experience[],
    education: readArray(record, 'education') as Education[],
    goals: readObject(record, 'goals') as Goals,
    availability: (readString(record, 'availability') as Availability | null) || 'open',
    salaryRange: readObject(record, 'salary_range', 'salaryRange') as SalaryRange,
    resumeUrl: readString(record, 'resume_url', 'resumeUrl'),
    profileData: readObject(record, 'profile_data', 'profileData'),
    onboardingDone: readBoolean(record, 'onboarding_done', 'onboardingDone'),
    createdAt: readDate(record, 'created_at', 'createdAt'),
    updatedAt: readDate(record, 'updated_at', 'updatedAt'),
  };
}

function normalizeEnterpriseProfile(record: ProfileRecord): EnterpriseProfileData {
  return {
    id: readString(record, 'id') || '',
    userId: readString(record, 'user_id', 'userId') || '',
    companyName: readString(record, 'company_name', 'companyName') || '',
    industry: readString(record, 'industry') || '',
    companySize: readString(record, 'company_size', 'companySize') || '',
    website: readString(record, 'website') || '',
    description: readString(record, 'description') || '',
    aiMaturity: readString(record, 'ai_maturity', 'aiMaturity') || '',
    profileData: readObject(record, 'profile_data', 'profileData'),
    preferences: readObject(record, 'preferences'),
    onboardingDone: readBoolean(record, 'onboarding_done', 'onboardingDone'),
    createdAt: readDate(record, 'created_at', 'createdAt'),
    updatedAt: readDate(record, 'updated_at', 'updatedAt'),
  };
}

async function readCurrentProfile() {
  try {
    const response = await apiFetch<ProfileResponse>('/api/v1/profile');
    return response.profile;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

export async function getCurrentTalentProfile(): Promise<TalentProfileData | null> {
  const profile = await readCurrentProfile();
  if (!profile || !isTalentProfile(profile)) {
    return null;
  }
  return normalizeTalentProfile(profile);
}

export async function getCurrentEnterpriseProfile(): Promise<EnterpriseProfileData | null> {
  const profile = await readCurrentProfile();
  if (!profile || !isEnterpriseProfile(profile)) {
    return null;
  }
  return normalizeEnterpriseProfile(profile);
}
