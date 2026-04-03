'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InboxItemRow } from '@/lib/inbox-shared';
import { useTranslations } from 'next-intl';

function renderSimpleMarkdown(text: string) {
  return text
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<p></p>')
    .replace(/\n/g, '<br />');
}

interface InboxDetailProps {
  item: InboxItemRow;
}

export function InboxDetail({ item }: InboxDetailProps) {
  const t = useTranslations('inbox');
  const content = item.content;

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{item.title}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{t(`type.${item.itemType}`)}</Badge>
          <span>{new Date(item.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {content.companyName
              ? `${t('company')}: ${String(content.companyName)}`
              : item.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeof content.jobTitle === 'string' && (
            <p className="text-sm">
              <span className="font-medium">{t('position')}:</span>{' '}
              {content.jobTitle}
            </p>
          )}

          {typeof content.matchScore === 'number' && (
            <p className="text-sm">
              <span className="font-medium">{t('matchScore')}:</span>{' '}
              <span className="font-semibold text-emerald-700">
                {content.matchScore}%
              </span>
            </p>
          )}

          {typeof content.message === 'string' && (
            <p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              {content.message}
            </p>
          )}

          {typeof content.aiReasoning === 'string' && (
            <p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              {content.aiReasoning}
            </p>
          )}

          {typeof content.summary === 'string' && (
            <div
              className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc"
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(content.summary) }}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {typeof content.conversationId === 'string' && (
              <Link href={`/enterprise/conversations?id=${content.conversationId}`}>
                <Button size="sm" variant="default" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  查看对话
                </Button>
              </Link>
            )}
            <Button size="sm" variant="outline">
              {content.jobId ? t('viewJob') : t('viewDetails')}
            </Button>
            <Button size="sm" variant="ghost">
              {t('markRead')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
