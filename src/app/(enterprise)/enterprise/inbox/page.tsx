import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PageTransition } from '@/components/animations/page-transition';
import { EmptyInbox } from '@/components/empty-states/empty-inbox';
import { InboxList } from '@/components/inbox/inbox-list';
import { listInboxItemsByUserId } from '@/lib/api/inbox';
import { MOCK_ENTERPRISE_INBOX_ITEMS } from '@/lib/mock-data';

export default async function EnterpriseInboxPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || 'test-enterprise-1';
  const t = await getTranslations('inbox');

  let items = [];
  try {
    items = await listInboxItemsByUserId(userId);
  } catch {
    items = [...MOCK_ENTERPRISE_INBOX_ITEMS];
  }

  if (items.length === 0 && userId === 'test-enterprise-1') {
    items = [...MOCK_ENTERPRISE_INBOX_ITEMS];
  }

  if (items.length === 0) {
    return <EmptyInbox />;
  }

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
      </div>
      <InboxList initialItems={items} />
    </PageTransition>
  );
}
