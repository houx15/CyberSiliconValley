export type UserRole = 'talent' | 'enterprise';
export type Availability = 'open' | 'busy' | 'not_looking';
export type JobStatus = 'open' | 'reviewing' | 'filled' | 'closed';
export type MatchStatus = 'new' | 'viewed' | 'shortlisted' | 'invited' | 'applied' | 'rejected';
export type SessionType = 'onboarding' | 'coach' | 'seeking' | 'screening' | 'general' | 'enterprise_onboarding' | 'jd_parse';
export type InboxItemType = 'match_notification' | 'invite' | 'prechat_summary' | 'system';

export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: string;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface StructuredJob {
  skills: Array<{ name: string; level: string; required: boolean }>;
  seniority: string;
  timeline: string;
  deliverables: string[];
  budget: { min?: number; max?: number; currency: string };
  workMode: 'remote' | 'onsite' | 'hybrid';
}

export interface MatchBreakdown {
  semantic: number;
  feature: number;
  dimensions: Record<string, number>;
}

export interface JWTPayload {
  userId: string;
  role: UserRole;
  email: string;
}
