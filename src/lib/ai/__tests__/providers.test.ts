import { describe, it, expect } from 'vitest';
import { BASE_PERSONA, buildSystemPrompt } from '../prompts/_base';

describe('AI Prompts', () => {
  describe('BASE_PERSONA', () => {
    it('is a non-empty string', () => {
      expect(typeof BASE_PERSONA).toBe('string');
      expect(BASE_PERSONA.length).toBeGreaterThan(0);
    });

    it('contains bilingual behavior instructions', () => {
      // Should mention responding in the same language as the user
      const lower = BASE_PERSONA.toLowerCase();
      expect(lower).toMatch(/chinese|language|bilingual/i);
    });

    it('contains conversational tone instructions', () => {
      expect(BASE_PERSONA).toMatch(/conversational/i);
    });

    it('mentions the CSV product name', () => {
      expect(BASE_PERSONA).toContain('CSV');
    });
  });

  describe('buildSystemPrompt', () => {
    const featurePrompt = 'You are helping with onboarding.';

    it('combines BASE_PERSONA with feature prompt', () => {
      const result = buildSystemPrompt(featurePrompt);
      expect(result).toContain(BASE_PERSONA);
      expect(result).toContain(featurePrompt);
    });

    it('separates BASE_PERSONA and feature prompt with double newline', () => {
      const result = buildSystemPrompt(featurePrompt);
      expect(result).toContain(`${BASE_PERSONA}\n\n${featurePrompt}`);
    });

    it('includes context section when context is provided', () => {
      const context = { userId: 'user-1', role: 'talent' };
      const result = buildSystemPrompt(featurePrompt, context);
      expect(result).toContain('Current context:');
      expect(result).toContain(JSON.stringify(context, null, 2));
    });

    it('includes context after feature prompt', () => {
      const context = { stage: 'onboarding' };
      const result = buildSystemPrompt(featurePrompt, context);
      const featureIndex = result.indexOf(featurePrompt);
      const contextIndex = result.indexOf('Current context:');
      expect(contextIndex).toBeGreaterThan(featureIndex);
    });

    it('omits context section when context is not provided', () => {
      const result = buildSystemPrompt(featurePrompt);
      expect(result).not.toContain('Current context:');
    });

    it('omits context section when context is undefined', () => {
      const result = buildSystemPrompt(featurePrompt, undefined);
      expect(result).not.toContain('Current context:');
    });

    it('serializes complex context correctly', () => {
      const context = {
        user: { id: 'abc', skills: ['RAG', 'LLM'] },
        matchScore: 0.87,
      };
      const result = buildSystemPrompt(featurePrompt, context);
      expect(result).toContain('"matchScore": 0.87');
      expect(result).toContain('"skills"');
    });
  });
});
