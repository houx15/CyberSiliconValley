import { describe, it, expect } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

describe('i18n messages — Specs 1-3 keys', () => {
  describe('onboarding keys (Spec 1)', () => {
    it('en has onboarding section', () => {
      expect(en.onboarding).toBeDefined();
      expect(en.onboarding.greeting).toBeTruthy();
      expect(en.onboarding.entry.resume.title).toBeTruthy();
      expect(en.onboarding.entry.link.title).toBeTruthy();
      expect(en.onboarding.entry.conversation.title).toBeTruthy();
      expect(en.onboarding.entry.voice.title).toBeTruthy();
      expect(en.onboarding.chips.skills).toBeTruthy();
      expect(en.onboarding.profile.identity).toBeTruthy();
      expect(en.onboarding.tour.home.title).toBeTruthy();
    });

    it('zh has matching onboarding keys', () => {
      expect(zh.onboarding).toBeDefined();
      expect(zh.onboarding.greeting).toBeTruthy();
      expect(zh.onboarding.entry.resume.title).toBeTruthy();
      expect(zh.onboarding.tour.home.title).toBeTruthy();
    });
  });

  describe('talentHome keys (Spec 2)', () => {
    it('en has talentHome section', () => {
      expect(en.talentHome).toBeDefined();
      expect(en.talentHome.availabilityOpen).toBeTruthy();
      expect(en.talentHome.skillsTitle).toBeTruthy();
      expect(en.talentHome.experienceTitle).toBeTruthy();
      expect(en.talentHome.editProfile).toBeTruthy();
    });

    it('zh has matching talentHome keys', () => {
      expect(zh.talentHome).toBeDefined();
      expect(zh.talentHome.availabilityOpen).toBeTruthy();
      expect(zh.talentHome.skillsTitle).toBeTruthy();
    });
  });

  describe('profileEditor keys (Spec 2)', () => {
    it('en has profileEditor section', () => {
      expect(en.profileEditor).toBeDefined();
      expect(en.profileEditor.displayName).toBeTruthy();
      expect(en.profileEditor.skills).toBeTruthy();
      expect(en.profileEditor.experience).toBeTruthy();
      expect(en.profileEditor.save).toBeTruthy();
    });

    it('zh has matching profileEditor keys', () => {
      expect(zh.profileEditor).toBeDefined();
      expect(zh.profileEditor.displayName).toBeTruthy();
    });
  });

  describe('companion keys (Spec 2)', () => {
    it('en has upgraded companion section', () => {
      expect(en.companion.statusTemplate).toBeTruthy();
      expect(en.companion.emptyChat).toBeTruthy();
      expect(en.companion.tab_general).toBeTruthy();
      expect(en.companion.tab_home).toBeTruthy();
      expect(en.companion.tab_coach).toBeTruthy();
    });

    it('zh has matching companion keys', () => {
      expect(zh.companion.statusTemplate).toBeTruthy();
      expect(zh.companion.tab_general).toBeTruthy();
    });
  });

  describe('enterprise keys (Spec 3)', () => {
    it('en has enterprise onboarding section', () => {
      expect(en.enterprise).toBeDefined();
      expect(en.enterprise.onboarding.title).toBeTruthy();
      expect(en.enterprise.onboarding.welcome).toBeTruthy();
      expect(en.enterprise.onboarding.companyProfile).toBeTruthy();
    });

    it('en has enterprise dashboard section', () => {
      expect(en.enterprise.dashboard.title).toBeTruthy();
      expect(en.enterprise.dashboard.activeOpportunities).toBeTruthy();
      expect(en.enterprise.dashboard.postNewOpportunity).toBeTruthy();
    });

    it('en has enterprise jobs section', () => {
      expect(en.enterprise.jobs.new).toBeTruthy();
      expect(en.enterprise.jobs.pasteJd).toBeTruthy();
      expect(en.enterprise.jobs.publish).toBeTruthy();
      expect(en.enterprise.jobs.mustHave).toBeTruthy();
      expect(en.enterprise.jobs.niceToHave).toBeTruthy();
    });

    it('zh has matching enterprise keys', () => {
      expect(zh.enterprise).toBeDefined();
      expect(zh.enterprise.onboarding.title).toBeTruthy();
      expect(zh.enterprise.dashboard.title).toBeTruthy();
      expect(zh.enterprise.jobs.new).toBeTruthy();
    });
  });

  describe('en/zh key parity', () => {
    function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys.push(...getLeafKeys(v as Record<string, unknown>, path));
        } else {
          keys.push(path);
        }
      }
      return keys;
    }

    it('en and zh have the same set of leaf keys', () => {
      const enKeys = getLeafKeys(en).sort();
      const zhKeys = getLeafKeys(zh).sort();
      expect(enKeys).toEqual(zhKeys);
    });
  });
});
