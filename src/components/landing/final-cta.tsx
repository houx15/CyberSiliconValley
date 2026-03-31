'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  const t = useTranslations('landing');

  return (
    <section className="px-6 pb-20 pt-10 md:px-10 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-8 py-12 shadow-[0_28px_100px_rgba(15,23,42,0.1)]"
      >
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {t('finalEyebrow')}
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
            {t('finalCtaTitle')}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {t('finalCtaDesc')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="rounded-full px-7">
                {t('ctaTalent')}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="rounded-full px-7">
                {t('ctaEnterprise')}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
