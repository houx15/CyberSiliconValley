export type UserRole = 'talent' | 'enterprise';
export type Availability = 'open' | 'busy' | 'not_looking';
export type JobStatus = 'open' | 'reviewing' | 'filled' | 'closed';
export type OpportunityType = 'fulltime' | 'internship' | 'project' | 'consulting' | 'task';

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, { zh: string; en: string; color: string }> = {
  fulltime:   { zh: '全职岗位', en: 'Full-time', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  internship: { zh: '实习机会', en: 'Internship', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  project:    { zh: '项目合作', en: 'Project', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  consulting: { zh: '兼职/顾问', en: 'Consulting', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  task:       { zh: '短期任务', en: 'Task', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
};
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
