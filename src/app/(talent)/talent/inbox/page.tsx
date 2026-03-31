import { headers } from 'next/headers';
import { InboxList } from '@/components/inbox/inbox-list';
import { listInboxItemsByUserId } from '@/lib/api/inbox';
import { MOCK_TALENT_INBOX_ITEMS, MOCK_TALENT_PROFILE } from '@/lib/mock-data';
import { getTranslations } from 'next-intl/server';

export default async function TalentInboxPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || MOCK_TALENT_PROFILE.userId;
  const t = await getTranslations('inbox');

  let items = [];
  try {
    items = await listInboxItemsByUserId(userId);
  } catch {
    items = [...MOCK_TALENT_INBOX_ITEMS];
  }

  if (items.length === 0 && userId === MOCK_TALENT_PROFILE.userId) {
    items = [...MOCK_TALENT_INBOX_ITEMS];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
      </div>
      <InboxList initialItems={items} />
    </div>
  );
}
