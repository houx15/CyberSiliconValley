import { PageTransition } from '@/components/animations/page-transition';
import { EmptyInbox } from '@/components/empty-states/empty-inbox';
import { InboxList } from '@/components/inbox/inbox-list';
import { listInboxItemsByUserId } from '@/lib/api/inbox';
import { MOCK_TALENT_INBOX_ITEMS } from '@/lib/mock-data';
import { getTranslations } from 'next-intl/server';

export default async function TalentInboxPage() {
  const t = await getTranslations('inbox');

  let items = [];
  try {
    items = await listInboxItemsByUserId();
  } catch {
    items = [...MOCK_TALENT_INBOX_ITEMS];
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
