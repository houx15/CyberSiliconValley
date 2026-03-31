'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

type StepProps = {
  number: number;
  title: string;
  description: string;
};

function Step({ number, title, description }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.24, ease: 'easeOut', delay: number * 0.06 }}
      className="relative rounded-3xl border border-border/60 bg-background p-6 shadow-sm"
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 font-serif text-lg text-foreground">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </motion.div>
  );
}

export function HowItWorks() {
  const t = useTranslations('landing');

  return (
    <section className="px-6 py-18 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="mb-12 max-w-2xl"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {t('howItWorksEyebrow')}
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
            {t('howItWorks')}
          </h2>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-border/60 bg-muted/20 p-6">
            <p className="mb-5 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {t('ctaTalent')}
            </p>
            <div className="grid gap-4">
              <Step number={1} title={t('talentStep1Title')} description={t('talentStep1Desc')} />
              <Step number={2} title={t('talentStep2Title')} description={t('talentStep2Desc')} />
              <Step number={3} title={t('talentStep3Title')} description={t('talentStep3Desc')} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/60 bg-background p-6">
            <p className="mb-5 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {t('ctaEnterprise')}
            </p>
            <div className="grid gap-4">
              <Step number={1} title={t('enterpriseStep1Title')} description={t('enterpriseStep1Desc')} />
              <Step number={2} title={t('enterpriseStep2Title')} description={t('enterpriseStep2Desc')} />
              <Step number={3} title={t('enterpriseStep3Title')} description={t('enterpriseStep3Desc')} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
