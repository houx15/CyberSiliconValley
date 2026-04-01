export const INBOX_ITEM_TYPES = [
  'match_notification',
  'invite',
  'prechat_summary',
  'system',
] as const;

export type InboxItemType = (typeof INBOX_ITEM_TYPES)[number];
export type InboxFilter = 'all' | 'invites' | 'prechats' | 'matches' | 'system';

export const INBOX_FILTER_TO_TYPES: Record<
  InboxFilter,
  InboxItemType[] | null
> = {
  all: null,
  invites: ['invite'],
  prechats: ['prechat_summary'],
  matches: ['match_notification'],
  system: ['system'],
};

export const INBOX_FILTER_TABS: Array<{ value: InboxFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'filters.all' },
  { value: 'invites', labelKey: 'filters.invites' },
  { value: 'prechats', labelKey: 'filters.prechats' },
  { value: 'matches', labelKey: 'filters.matches' },
  { value: 'system', labelKey: 'filters.system' },
];

export interface InboxItemRow {
  id: string;
  itemType: InboxItemType;
  title: string;
  content: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
