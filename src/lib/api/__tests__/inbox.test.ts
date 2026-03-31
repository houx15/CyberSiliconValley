import { describe, expect, it } from 'vitest';

describe('inbox data access types', () => {
  it('supports the shared inbox item types', async () => {
    const { INBOX_ITEM_TYPES } = await import('../inbox');

    expect(INBOX_ITEM_TYPES).toEqual([
      'match_notification',
      'invite',
      'prechat_summary',
      'system',
    ]);
  });

  it('maps inbox filters to item types', async () => {
    const { INBOX_FILTER_TO_TYPES } = await import('../inbox');

    expect(INBOX_FILTER_TO_TYPES).toEqual({
      all: null,
      invites: ['invite'],
      prechats: ['prechat_summary'],
      matches: ['match_notification'],
      system: ['system'],
    });
  });

  it('exposes filter tabs in UI order', async () => {
    const { INBOX_FILTER_TABS } = await import('../inbox');

    expect(INBOX_FILTER_TABS.map((tab) => tab.value)).toEqual([
      'all',
      'invites',
      'prechats',
      'matches',
      'system',
    ]);
  });
});
