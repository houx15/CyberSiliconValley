import { describe, it, expect } from 'vitest';
import { ENTERPRISE_ONBOARDING_PROMPT } from '../prompts/enterprise-onboarding';
import { JD_PARSE_PROMPT } from '../prompts/jd-parse';

describe('Enterprise Onboarding Prompt', () => {
  it('is non-empty', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains all 4 onboarding steps', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('Step 1');
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('Step 2');
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('Step 3');
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('Step 4');
  });

  it('mentions company recognition', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toMatch(/company name|company recognition/i);
  });

  it('mentions intent clarification', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toMatch(/intent|what brings/i);
  });

  it('mentions requirement input', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toMatch(/requirement|job description/i);
  });

  it('mentions matching setup', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toMatch(/auto-match|matching preferences/i);
  });

  it('references tool calls', () => {
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('setCompanyProfile');
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('createJob');
    expect(ENTERPRISE_ONBOARDING_PROMPT).toContain('completeOnboarding');
  });
});

describe('JD Parse Prompt', () => {
  it('is non-empty', () => {
    expect(JD_PARSE_PROMPT.length).toBeGreaterThan(0);
  });

  it('mentions extraction of structured fields', () => {
    expect(JD_PARSE_PROMPT).toMatch(/title/i);
    expect(JD_PARSE_PROMPT).toMatch(/skills/i);
    expect(JD_PARSE_PROMPT).toMatch(/seniority/i);
    expect(JD_PARSE_PROMPT).toMatch(/timeline/i);
    expect(JD_PARSE_PROMPT).toMatch(/budget/i);
    expect(JD_PARSE_PROMPT).toMatch(/work mode/i);
  });

  it('references structureJob tool', () => {
    expect(JD_PARSE_PROMPT).toContain('structureJob');
  });

  it('supports multiple input modes', () => {
    expect(JD_PARSE_PROMPT).toMatch(/paste/i);
    expect(JD_PARSE_PROMPT).toMatch(/url/i);
    expect(JD_PARSE_PROMPT).toMatch(/conversational|describe/i);
  });

  it('mentions bilingual support', () => {
    expect(JD_PARSE_PROMPT).toMatch(/language/i);
  });
});
