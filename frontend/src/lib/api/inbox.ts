import { apiFetch } from '@/lib/api/client';
export {
  INBOX_FILTER_TABS,
  INBOX_FILTER_TO_TYPES,
  INBOX_ITEM_TYPES,
  type InboxFilter,
  type InboxItemRow,
  type InboxItemType,
} from '@/lib/inbox-shared';
import {
  type InboxFilter,
  type InboxItemRow,
} from '@/lib/inbox-shared';

interface InboxListResponse {
  data: {
    items: InboxItemRow[];
    unreadCount: number;
  };
}

interface InboxMarkReadResponse {
  success: boolean;
}

export async function listInboxItemsByUserId(
  _userId?: string,
  filter: InboxFilter = 'all'
): Promise<InboxItemRow[]> {
  const response = await apiFetch<InboxListResponse>(`/api/v1/inbox?filter=${filter}`);
  return response.data.items;
}

export async function markInboxItemRead(
  id: string,
  _userId?: string
): Promise<boolean> {
  const response = await apiFetch<InboxMarkReadResponse>(`/api/v1/inbox/${id}`, {
    method: 'PATCH',
  });
  return response.success;
}

export async function getUnreadInboxCount(_userId?: string): Promise<number> {
  const response = await apiFetch<InboxListResponse>('/api/v1/inbox?filter=all');
  return response.data.unreadCount;
}

export async function createInboxItem(input: {
  userId: string;
  itemType: string;
  title: string;
  content: Record<string, unknown>;
  read?: boolean;
}): Promise<string> {
  throw new Error(
    `Frontend inbox writes are no longer supported: attempted to create ${input.itemType} for ${input.userId}`
  );
}
