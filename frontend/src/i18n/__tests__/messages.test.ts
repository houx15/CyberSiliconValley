import { describe, it, expect } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

type NestedObject = { [key: string]: string | NestedObject };

function collectKeys(obj: NestedObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      keys.push(...collectKeys(value as NestedObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n messages', () => {
  describe('locale files exist and are valid JSON', () => {
    it('en.json is a non-empty object', () => {
      expect(typeof en).toBe('object');
      expect(en).not.toBeNull();
      expect(Object.keys(en).length).toBeGreaterThan(0);
    });

    it('zh.json is a non-empty object', () => {
      expect(typeof zh).toBe('object');
      expect(zh).not.toBeNull();
      expect(Object.keys(zh).length).toBeGreaterThan(0);
    });
  });

  describe('both locales have the same keys', () => {
    it('en and zh have exactly the same keys (no missing translations)', () => {
      const enKeys = collectKeys(en as unknown as NestedObject).sort();
      const zhKeys = collectKeys(zh as unknown as NestedObject).sort();
      expect(enKeys).toEqual(zhKeys);
    });
  });

  describe('no empty string values', () => {
    it('en.json has no empty string values', () => {
      const enKeys = collectKeys(en as unknown as NestedObject);
      const enObj = en as unknown as NestedObject;
      for (const key of enKeys) {
        const parts = key.split('.');
        let value: string | NestedObject = enObj;
        for (const part of parts) {
          value = ((value as NestedObject)[part] as string | NestedObject);
        }
        expect(value, `en.${key} should not be empty`).not.toBe('');
      }
    });

    it('zh.json has no empty string values', () => {
      const zhKeys = collectKeys(zh as unknown as NestedObject);
      const zhObj = zh as unknown as NestedObject;
      for (const key of zhKeys) {
        const parts = key.split('.');
        let value: string | NestedObject = zhObj;
        for (const part of parts) {
          value = ((value as NestedObject)[part] as string | NestedObject);
        }
        expect(value, `zh.${key} should not be empty`).not.toBe('');
      }
    });
  });

  describe('expected top-level sections exist', () => {
    const expectedSections = ['common', 'landing', 'nav', 'auth', 'companion'];

    for (const section of expectedSections) {
      it(`en.json has section: ${section}`, () => {
        expect(en).toHaveProperty(section);
        expect(typeof (en as Record<string, unknown>)[section]).toBe('object');
      });

      it(`zh.json has section: ${section}`, () => {
        expect(zh).toHaveProperty(section);
        expect(typeof (zh as Record<string, unknown>)[section]).toBe('object');
      });
    }
  });
});
