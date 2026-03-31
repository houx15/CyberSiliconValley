'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Network, Orbit, Radar, ScanSearch } from 'lucide-react';

const ICONS = [Orbit, Network, ScanSearch, Radar] as const;

export function FeatureHighlights() {
  const t = useTranslations('landing');
  const features = [
    { title: t('feature1Title'), description: t('feature1Desc') },
    { title: t('feature2Title'), description: t('feature2Desc') },
    { title: t('feature3Title'), description: t('feature3Desc') },
    { title: t('feature4Title'), description: t('feature4Desc') },
  ];

  return (
    <section className="px-6 py-18 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="mb-10 max-w-2xl"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {t('featureEyebrow')}
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
            {t('featureTitle')}
          </h2>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = ICONS[index] ?? Orbit;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.24, ease: 'easeOut', delay: index * 0.06 }}
                className="group rounded-[2rem] border border-border/60 bg-background p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
