import { describe, expect, it } from 'vitest';
import { buildCoachSystemPrompt, COACH_TOOLS } from '../prompts/coach';

const context = {
  profileJson: JSON.stringify({
    displayName: 'Zhang Wei',
    headline: 'ML Engineer',
    skills: [{ name: 'Python', level: 'expert' }],
  }),
  goals: 'Senior ML Engineer at a top AI company',
  recentMatchesSummary: '5 high matches (>80%), 12 medium matches (60-80%)',
};

describe('coach prompt builder', () => {
  it('includes the base persona, profile context, and chat guidance', () => {
    const prompt = buildCoachSystemPrompt('chat', context);

    expect(prompt).toContain('CSV (Cyber Silicon Valley)');
    expect(prompt).toContain('Zhang Wei');
    expect(prompt).toContain('career coach');
    expect(prompt).toContain('5 high matches');
    expect(prompt).toContain('updateProfileField');
    expect(prompt).toContain('suggestSkill');
  });

  it('adds resume review instructions in resume-review mode', () => {
    const prompt = buildCoachSystemPrompt('resume-review', context);

    expect(prompt).toContain('resume');
    expect(prompt).toContain('BEFORE');
    expect(prompt).toContain('AFTER');
    expect(prompt).toContain('updateProfileField');
  });

  it('adds mock interview instructions in mock-interview mode', () => {
    const prompt = buildCoachSystemPrompt('mock-interview', context);

    expect(prompt).toContain('mock interview');
    expect(prompt).toContain('technical questions');
    expect(prompt).toContain('behavioral question');
  });

  it('adds skill gap analysis instructions in skill-gaps mode', () => {
    const prompt = buildCoachSystemPrompt('skill-gaps', context);

    expect(prompt).toContain('gaps');
    expect(prompt).toContain('suggestSkill');
    expect(prompt).toContain('learning resources');
    expect(prompt).toContain('priority order');
  });
});

describe('COACH_TOOLS', () => {
  it('defines updateProfileField and suggestSkill tools', () => {
    const updateProfileField = COACH_TOOLS.find((tool) => tool.function.name === 'updateProfileField');
    const suggestSkill = COACH_TOOLS.find((tool) => tool.function.name === 'suggestSkill');

    expect(updateProfileField).toBeDefined();
    expect(suggestSkill).toBeDefined();
    expect(updateProfileField?.function.parameters).toHaveProperty('properties');
    expect(suggestSkill?.function.parameters).toHaveProperty('properties');
    expect(updateProfileField?.function.parameters).toMatchObject({
      properties: {
        value: {
          type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
        },
      },
    });
  });
});
