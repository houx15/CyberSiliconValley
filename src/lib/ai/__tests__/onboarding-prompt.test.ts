import { describe, it, expect } from 'vitest';
import { buildOnboardingPrompt } from '../prompts/onboarding';
import { BASE_PERSONA } from '../prompts/_base';

describe('buildOnboardingPrompt', () => {
  it('includes BASE_PERSONA', () => {
    const result = buildOnboardingPrompt();
    expect(result).toContain(BASE_PERSONA);
  });

  it('includes onboarding phase instructions', () => {
    const result = buildOnboardingPrompt();
    expect(result).toContain('Greeting');
    expect(result).toContain('Identity');
    expect(result).toContain('Skills');
    expect(result).toContain('Experience');
    expect(result).toContain('Goals');
    expect(result).toContain('Completion');
  });

  it('reports all fields missing when context is empty', () => {
    const result = buildOnboardingPrompt({});
    expect(result).toContain('name');
    expect(result).toContain('role/title/headline');
    expect(result).toContain('skills');
    expect(result).toContain('experience');
    expect(result).toContain('goals/preferences');
    expect(result).toContain('Nothing yet');
  });

  it('shows collected fields when context has data', () => {
    const result = buildOnboardingPrompt({
      displayName: 'Alice',
      headline: 'AI Engineer',
      skills: [{ name: 'Python', level: 'expert', category: 'Languages' }],
    });
    expect(result).toContain('Name: Alice');
    expect(result).toContain('Title/Role: AI Engineer');
    expect(result).toContain('Python (expert)');
    expect(result).not.toContain('Nothing yet');
  });

  it('shows experience when provided', () => {
    const result = buildOnboardingPrompt({
      experience: [
        { company: 'Acme', role: 'Engineer', duration: '2020-2023', description: 'Built stuff' },
      ],
    });
    expect(result).toContain('Engineer at Acme');
  });

  it('shows goals when provided', () => {
    const result = buildOnboardingPrompt({
      goals: { targetRoles: ['AI Lead'], workPreferences: ['Remote'] },
    });
    expect(result).toContain('Goals:');
    expect(result).toContain('targetRoles');
  });

  it('reports profile complete when all fields present', () => {
    const result = buildOnboardingPrompt({
      displayName: 'Bob',
      headline: 'ML Engineer',
      skills: [{ name: 'PyTorch', level: 'advanced', category: 'ML' }],
      experience: [{ company: 'X', role: 'Dev', duration: '2y', description: 'stuff' }],
      goals: { targetRoles: ['Lead'] },
    });
    expect(result).toContain('Profile is complete');
    expect(result).toContain('completeOnboarding');
  });

  it('includes tool call instructions', () => {
    const result = buildOnboardingPrompt();
    expect(result).toContain('revealProfileField');
    expect(result).toContain('addSkillTag');
    expect(result).toContain('completeOnboarding');
  });
});
