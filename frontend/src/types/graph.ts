export interface GraphNode {
  id: string;
  keyword: string;
  jobCount: number;
  trending: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  isUserSkill?: boolean;
  radius?: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ClusterJobSkill {
  name: string;
  level: string;
  required: boolean;
}

export interface ClusterJob {
  id: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  matchScore: number | null;
  skills: ClusterJobSkill[];
}

export interface JobDetail extends ClusterJob {
  description: string;
  seniority: string;
  budgetRange: string;
  timeline: string;
  deliverables: string;
  matchBreakdown: Record<string, number> | null;
  aiReasoning: string | null;
}

export type CoachMode = 'chat' | 'resume-review' | 'mock-interview' | 'skill-gaps';
