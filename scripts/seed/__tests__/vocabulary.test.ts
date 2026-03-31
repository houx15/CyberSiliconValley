import { describe, expect, it } from 'vitest';

import {
  getSkillsByCategory,
  isValidSkillName,
  SKILL_CATEGORIES,
  SKILL_VOCABULARY,
} from '../vocabulary';

describe('Controlled Skill Vocabulary', () => {
  it('has at least 60 skills across all categories', () => {
    const allSkills = Object.values(SKILL_VOCABULARY).flat();
    expect(allSkills.length).toBeGreaterThanOrEqual(60);
  });

  it('has 7 specialization categories', () => {
    expect(SKILL_CATEGORIES.length).toBe(7);
  });

  it('has no duplicate skill names across categories', () => {
    const allSkills = Object.values(SKILL_VOCABULARY).flat();
    const uniqueSkills = new Set(allSkills);
    expect(uniqueSkills.size).toBe(allSkills.length);
  });

  it('getSkillsByCategory returns correct skills', () => {
    const nlpSkills = getSkillsByCategory('NLP/RAG');
    expect(nlpSkills.length).toBeGreaterThan(0);
    expect(nlpSkills.every((skill) => typeof skill === 'string')).toBe(true);
  });

  it('isValidSkillName validates correctly', () => {
    const firstSkill = Object.values(SKILL_VOCABULARY).flat()[0];
    expect(firstSkill).toBeDefined();
    expect(isValidSkillName(firstSkill!)).toBe(true);
    expect(isValidSkillName('not-a-real-skill-xyz')).toBe(false);
  });
});
