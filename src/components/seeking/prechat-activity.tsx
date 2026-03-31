'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PreChatItem } from '@/lib/api/seeking';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface PreChatActivityProps {
  items: PreChatItem[];
}

export function PreChatActivity({ items }: PreChatActivityProps) {
  const t = useTranslations('seeking');

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('prechatActivity')}</h2>
        <p className="text-sm text-muted-foreground">{t('prechatDescription')}</p>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.inboxItemId}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {item.companyName} · {item.jobTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                  {item.summary}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.generatedAt).toLocaleString()}
                  </span>
                  <Button size="sm" variant="outline">
                    {t('viewSummary')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
