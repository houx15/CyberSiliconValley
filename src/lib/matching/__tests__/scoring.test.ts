import { describe, it, expect } from 'vitest';
import {
  computeFeatureScore,
  compareProficiency,
  matchSkillName,
  computeAvailabilityScore,
  computeSeniorityScore,
} from '../scoring';
import type { Skill, StructuredJob } from '@/types';

describe('matchSkillName', () => {
  it('matches exact names case-insensitively', () => {
    expect(matchSkillName('Python', 'python')).toBe(true);
    expect(matchSkillName('React', 'react')).toBe(true);
  });

  it('matches with normalized whitespace and separators', () => {
    expect(matchSkillName('Machine Learning', 'machine-learning')).toBe(true);
    expect(matchSkillName('machine_learning', 'Machine Learning')).toBe(true);
    expect(matchSkillName('Natural Language Processing', 'natural-language-processing')).toBe(true);
  });

  it('does not match unrelated skills', () => {
    expect(matchSkillName('Python', 'JavaScript')).toBe(false);
    expect(matchSkillName('React', 'Vue')).toBe(false);
  });
});

describe('compareProficiency', () => {
  it('returns 1.0 for exact match', () => {
    expect(compareProficiency('expert', 'expert')).toBe(1.0);
    expect(compareProficiency('beginner', 'beginner')).toBe(1.0);
  });

  it('returns 0.8 for one level difference', () => {
    expect(compareProficiency('advanced', 'expert')).toBe(0.8);
    expect(compareProficiency('intermediate', 'advanced')).toBe(0.8);
  });

  it('returns 0.5 for two level difference', () => {
    expect(compareProficiency('intermediate', 'expert')).toBe(0.5);
    expect(compareProficiency('beginner', 'advanced')).toBe(0.5);
  });

  it('returns 0.2 for three level difference', () => {
    expect(compareProficiency('beginner', 'expert')).toBe(0.2);
  });

  it('returns 1.0 when talent exceeds requirement', () => {
    expect(compareProficiency('expert', 'intermediate')).toBe(1.0);
    expect(compareProficiency('advanced', 'beginner')).toBe(1.0);
  });
});

describe('computeAvailabilityScore', () => {
  it('returns 1.0 for open availability', () => {
    expect(computeAvailabilityScore('open')).toBe(1.0);
  });

  it('returns 0.5 for busy availability', () => {
    expect(computeAvailabilityScore('busy')).toBe(0.5);
  });

  it('returns 0.1 for not_looking availability', () => {
    expect(computeAvailabilityScore('not_looking')).toBe(0.1);
  });
});

describe('computeSeniorityScore', () => {
  it('returns 1.0 for exact match', () => {
    expect(computeSeniorityScore('senior', 'senior')).toBe(1.0);
  });

  it('returns 0.7 for one level difference', () => {
    expect(computeSeniorityScore('mid', 'senior')).toBe(0.7);
    expect(computeSeniorityScore('senior', 'lead')).toBe(0.7);
  });

  it('returns 0.4 for two level difference', () => {
    expect(computeSeniorityScore('junior', 'senior')).toBe(0.4);
  });

  it('returns 1.0 when talent exceeds requirement', () => {
    expect(computeSeniorityScore('lead', 'mid')).toBe(1.0);
  });
});

describe('computeFeatureScore', () => {
  const talentSkills: Skill[] = [
    { name: 'Python', level: 'expert', category: 'Programming' },
    { name: 'Machine Learning', level: 'advanced', category: 'AI' },
    { name: 'React', level: 'intermediate', category: 'Frontend' },
    { name: 'Docker', level: 'beginner', category: 'DevOps' },
  ];

  it('scores a perfect match highly', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Machine Learning', level: 'advanced', required: true },
      ],
      seniority: 'senior',
      timeline: '6 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.score).toBeGreaterThan(90);
    expect(result.dimensions['Python']).toBe(1.0);
    expect(result.dimensions['Machine Learning']).toBe(1.0);
  });

  it('penalizes missing must-have skills heavily', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Kubernetes', level: 'advanced', required: true },
      ],
      seniority: 'senior',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.dimensions['Kubernetes']).toBe(0);
    expect(result.score).toBeLessThan(70);
  });

  it('weights must-have skills 2x vs nice-to-have', () => {
    const jobWithMustHave: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'Go', level: 'intermediate', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const jobAllNiceToHave: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: false },
        { name: 'Go', level: 'intermediate', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const resultMustHave = computeFeatureScore(talentSkills, jobWithMustHave, 'open');
    const resultNiceToHave = computeFeatureScore(talentSkills, jobAllNiceToHave, 'open');

    expect(resultMustHave.score).toBeGreaterThan(resultNiceToHave.score);
  });

  it('includes availability in the score', () => {
    const jobStructured: StructuredJob = {
      skills: [{ name: 'Python', level: 'expert', required: true }],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const openScore = computeFeatureScore(talentSkills, jobStructured, 'open');
    const notLookingScore = computeFeatureScore(talentSkills, jobStructured, 'not_looking');
    expect(openScore.score).toBeGreaterThan(notLookingScore.score);
  });

  it('returns per-dimension scores in breakdown', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
        { name: 'React', level: 'advanced', required: false },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.dimensions).toHaveProperty('Python');
    expect(result.dimensions).toHaveProperty('React');
    expect(result.dimensions).toHaveProperty('availability');
    expect(result.dimensions).toHaveProperty('seniority');
    expect(result.dimensions['Python']).toBe(1.0);
    expect(result.dimensions['React']).toBe(0.8);
  });

  it('handles empty job skills gracefully', () => {
    const jobStructured: StructuredJob = {
      skills: [],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore(talentSkills, jobStructured, 'open');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('handles empty talent skills gracefully', () => {
    const jobStructured: StructuredJob = {
      skills: [
        { name: 'Python', level: 'expert', required: true },
      ],
      seniority: 'mid',
      timeline: '3 months',
      deliverables: [],
      budget: { currency: 'CNY' },
      workMode: 'remote',
    };

    const result = computeFeatureScore([], jobStructured, 'open');
    expect(result.dimensions['Python']).toBe(0);
    expect(result.score).toBeLessThan(30);
  });
});
