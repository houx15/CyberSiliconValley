import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('../client', () => ({
  apiFetch,
}));

describe('inbox data access types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('loads inbox items from backend api', async () => {
    apiFetch.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'item-1',
            itemType: 'invite',
            title: 'Invite',
            content: {},
            read: false,
            createdAt: '2026-03-31T00:00:00.000Z',
          },
        ],
        unreadCount: 1,
      },
    });

    const { listInboxItemsByUserId } = await import('../inbox');
    const items = await listInboxItemsByUserId('ignored-user');

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/inbox?filter=all');
    expect(items).toHaveLength(1);
  });

  it('marks inbox items read through backend api', async () => {
    apiFetch.mockResolvedValueOnce({ success: true });

    const { markInboxItemRead } = await import('../inbox');
    const result = await markInboxItemRead('item-1', 'ignored-user');

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/inbox/item-1', { method: 'PATCH' });
    expect(result).toBe(true);
  });
});
