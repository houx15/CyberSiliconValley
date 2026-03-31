import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

describe('i18n messages — Spec 5 keys', () => {
  it('en has seeking section', () => {
    expect(en.seeking).toBeDefined();
    expect(en.seeking.title).toBeTruthy();
    expect(en.seeking.highMatches).toBeTruthy();
    expect(en.seeking.generateResume).toBeTruthy();
    expect(en.seeking.emptyTitle).toBeTruthy();
  });

  it('en has inbox section', () => {
    expect(en.inbox).toBeDefined();
    expect(en.inbox.title).toBeTruthy();
    expect(en.inbox.filters.all).toBeTruthy();
    expect(en.inbox.emptyTitle).toBeTruthy();
    expect(en.inbox.selectMessage).toBeTruthy();
  });

  it('zh has matching spec 5 sections', () => {
    expect(zh.seeking.title).toBeTruthy();
    expect(zh.seeking.generateResume).toBeTruthy();
    expect(zh.inbox.title).toBeTruthy();
    expect(zh.inbox.filters.prechats).toBeTruthy();
  });
});
