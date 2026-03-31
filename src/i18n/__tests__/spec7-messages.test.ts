import { describe, expect, it } from 'vitest';

import en from '../messages/en.json';
import zh from '../messages/zh.json';

const landingKeys = [
  'eyebrow',
  'heroCardLabel',
  'heroCardTitle',
  'statProfiles',
  'statRoles',
  'statSignals',
  'heroSignal1',
  'heroSignal2',
  'heroSignal3',
  'howItWorksEyebrow',
  'howItWorks',
  'talentStep1Title',
  'talentStep1Desc',
  'talentStep2Title',
  'talentStep2Desc',
  'talentStep3Title',
  'talentStep3Desc',
  'enterpriseStep1Title',
  'enterpriseStep1Desc',
  'enterpriseStep2Title',
  'enterpriseStep2Desc',
  'enterpriseStep3Title',
  'enterpriseStep3Desc',
  'featureEyebrow',
  'featureTitle',
  'feature1Title',
  'feature1Desc',
  'feature2Title',
  'feature2Desc',
  'feature3Title',
  'feature3Desc',
  'feature4Title',
  'feature4Desc',
  'finalEyebrow',
  'finalCtaTitle',
  'finalCtaDesc',
] as const;

describe('spec7 landing messages', () => {
  it('adds the expected landing keys to English and Chinese locales', () => {
    for (const key of landingKeys) {
      expect(en.landing).toHaveProperty(key);
      expect(zh.landing).toHaveProperty(key);
    }
  });
});
