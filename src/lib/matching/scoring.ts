import type { Skill, StructuredJob } from '@/types';

/**
 * Proficiency levels ordered from lowest to highest.
 * Index is used for comparison arithmetic.
 */
const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

/**
 * Seniority levels ordered from lowest to highest.
 */
const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const;

/**
 * Normalize a skill name for fuzzy comparison.
 * Lowercases, replaces hyphens/underscores with spaces, trims.
 */
function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if two skill names match (fuzzy, case-insensitive, separator-insensitive).
 */
export function matchSkillName(a: string, b: string): boolean {
  return normalizeSkillName(a) === normalizeSkillName(b);
}

/**
 * Compare proficiency levels.
 * Returns a score 0-1 based on how well the talent's level meets the required level.
 * If talent exceeds requirement, returns 1.0 (no penalty for being overqualified).
 */
export function compareProficiency(
  talentLevel: string,
  requiredLevel: string
): number {
  const talentIdx = PROFICIENCY_LEVELS.indexOf(
    talentLevel as (typeof PROFICIENCY_LEVELS)[number]
  );
  const requiredIdx = PROFICIENCY_LEVELS.indexOf(
    requiredLevel as (typeof PROFICIENCY_LEVELS)[number]
  );

  if (talentIdx === -1 || requiredIdx === -1) return 0.5;
  if (talentIdx >= requiredIdx) return 1.0;

  const gap = requiredIdx - talentIdx;
  const penalties: Record<number, number> = { 1: 0.8, 2: 0.5, 3: 0.2 };
  return penalties[gap] ?? 0.1;
}

/**
 * Score availability: open = 1.0, busy = 0.5, not_looking = 0.1
 */
export function computeAvailabilityScore(availability: string): number {
  const scores: Record<string, number> = {
    open: 1.0,
    busy: 0.5,
    not_looking: 0.1,
  };
  return scores[availability] ?? 0.5;
}

/**
 * Score seniority match.
 * Returns 1.0 if talent meets or exceeds. Penalty for gap.
 */
export function computeSeniorityScore(
  talentSeniority: string,
  requiredSeniority: string
): number {
  const talentIdx = SENIORITY_LEVELS.indexOf(
    talentSeniority as (typeof SENIORITY_LEVELS)[number]
  );
  const requiredIdx = SENIORITY_LEVELS.indexOf(
    requiredSeniority as (typeof SENIORITY_LEVELS)[number]
  );

  if (talentIdx === -1 || requiredIdx === -1) return 0.5;
  if (talentIdx >= requiredIdx) return 1.0;

  const gap = requiredIdx - talentIdx;
  const penalties: Record<number, number> = { 1: 0.7, 2: 0.4, 3: 0.2 };
  return penalties[gap] ?? 0.1;
}

/**
 * Infer talent seniority from skill levels as a heuristic.
 */
function inferSeniority(skills: Skill[]): string {
  const expertCount = skills.filter((s) => s.level === 'expert').length;
  const advancedCount = skills.filter((s) => s.level === 'advanced').length;

  if (expertCount >= 3) return 'lead';
  if (expertCount >= 1 || advancedCount >= 3) return 'senior';
  if (advancedCount >= 1) return 'mid';
  return 'junior';
}

export interface FeatureScoreResult {
  /** Overall feature score on 0-100 scale */
  score: number;
  /** Per-dimension scores (skill names, availability, seniority) on 0-1 scale */
  dimensions: Record<string, number>;
}

/**
 * Compute the feature-based match score for a talent against a job.
 *
 * Scoring breakdown:
 * - Skills: 70% weight (must-have skills weighted 2x vs nice-to-have)
 * - Availability: 15% weight
 * - Seniority: 15% weight
 */
export function computeFeatureScore(
  talentSkills: Skill[],
  job: StructuredJob,
  availability: string
): FeatureScoreResult {
  const dimensions: Record<string, number> = {};

  const jobSkills = job.skills || [];
  let skillWeightedSum = 0;
  let skillTotalWeight = 0;

  for (const jobSkill of jobSkills) {
    const weight = jobSkill.required ? 2 : 1;
    skillTotalWeight += weight;

    const talentSkill = talentSkills.find((ts) =>
      matchSkillName(ts.name, jobSkill.name)
    );

    if (talentSkill) {
      const profScore = compareProficiency(talentSkill.level, jobSkill.level);
      dimensions[jobSkill.name] = profScore;
      skillWeightedSum += profScore * weight;
    } else {
      dimensions[jobSkill.name] = 0;
    }
  }

  const skillScore =
    skillTotalWeight > 0 ? skillWeightedSum / skillTotalWeight : 1.0;

  const availabilityScore = computeAvailabilityScore(availability);
  dimensions['availability'] = availabilityScore;

  const talentSeniority = inferSeniority(talentSkills);
  const requiredSeniority = job.seniority || 'mid';
  const seniorityScore = computeSeniorityScore(
    talentSeniority,
    requiredSeniority.toLowerCase()
  );
  dimensions['seniority'] = seniorityScore;

  const SKILL_WEIGHT = 0.7;
  const AVAILABILITY_WEIGHT = 0.15;
  const SENIORITY_WEIGHT = 0.15;

  const finalScore =
    (skillScore * SKILL_WEIGHT +
      availabilityScore * AVAILABILITY_WEIGHT +
      seniorityScore * SENIORITY_WEIGHT) *
    100;

  return {
    score: Math.round(Math.max(0, Math.min(100, finalScore))),
    dimensions,
  };
}
