import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

describe('i18n messages - Spec 6 keys', () => {
  it('en has fair feature section with coach section at the top level', () => {
    expect(en.fair).toBeDefined();
    expect(en.fair.title).toBeTruthy();
    expect(en.fair.searchPlaceholder).toBeTruthy();
    expect(en.fair.emptyState).toBeTruthy();
    expect(en.fair.aiAnalysis).toBeTruthy();
    expect(en.coach).toBeDefined();
    expect(en.coach.title).toBeTruthy();
    expect(en.coach.modeChat).toBeTruthy();
    expect(en.coach.placeholderChat).toBeTruthy();
    expect(en.coach.profileUpdated).toBeTruthy();
  });

  it('zh has matching fair and coach feature sections', () => {
    expect(zh.fair).toBeDefined();
    expect(zh.fair.title).toBeTruthy();
    expect(zh.fair.searchPlaceholder).toBeTruthy();
    expect(zh.fair.noJobs).toBeTruthy();
    expect(zh.coach).toBeDefined();
    expect(zh.coach.title).toBeTruthy();
    expect(zh.coach.modeSkillGaps).toBeTruthy();
    expect(zh.coach.placeholderSkills).toBeTruthy();
    expect(zh.coach.profileUpdated).toBeTruthy();
  });
});
