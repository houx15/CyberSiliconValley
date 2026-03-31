'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { InboundInterestItem } from '@/lib/api/seeking';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface InboundInterestProps {
  items: InboundInterestItem[];
}

export function InboundInterest({ items }: InboundInterestProps) {
  const t = useTranslations('seeking');

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('inboundInterest')}</h2>
        <p className="text-sm text-muted-foreground">{t('inboundDescription')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <motion.div
            key={item.matchId}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
          >
            <Card className="h-full">
              <CardContent className="flex h-full flex-col justify-between gap-4 pt-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground">{item.companyName}</h3>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {item.score}%
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>
                </div>
                <Button size="sm" variant="outline" className="self-start">
                  {t('view')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
