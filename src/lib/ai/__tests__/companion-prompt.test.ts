import { describe, it, expect } from 'vitest';
import {
  COMPANION_GENERAL_PROMPT,
  COMPANION_HOME_PROMPT,
  COMPANION_COACH_PROMPT,
} from '../prompts/companion';

describe('Companion Prompts', () => {
  it('general prompt is non-empty and mentions CSV', () => {
    expect(COMPANION_GENERAL_PROMPT.length).toBeGreaterThan(0);
    expect(COMPANION_GENERAL_PROMPT).toContain('CSV');
  });

  it('general prompt covers navigation and career help', () => {
    expect(COMPANION_GENERAL_PROMPT).toMatch(/navigate|platform/i);
    expect(COMPANION_GENERAL_PROMPT).toMatch(/career|advice/i);
  });

  it('home prompt mentions capability portrait', () => {
    expect(COMPANION_HOME_PROMPT).toMatch(/capability portrait|skill/i);
  });

  it('home prompt is context-aware for the home page', () => {
    expect(COMPANION_HOME_PROMPT).toMatch(/home/i);
  });

  it('coach prompt covers career coaching', () => {
    expect(COMPANION_COACH_PROMPT).toMatch(/career coach/i);
    expect(COMPANION_COACH_PROMPT).toMatch(/interview/i);
  });

  it('all prompts ask for short/actionable responses', () => {
    expect(COMPANION_GENERAL_PROMPT).toMatch(/short|concise|actionable/i);
    expect(COMPANION_HOME_PROMPT).toMatch(/short|concise|actionable/i);
    expect(COMPANION_COACH_PROMPT).toMatch(/specific|actionable/i);
  });
});
