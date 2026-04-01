'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CountUp } from '@/components/animations/count-up';
import { PulseDot } from '@/components/animations/pulse-dot';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-10 md:px-10 md:pb-20 md:pt-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(31,41,55,0.08),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '52px 52px' }} />

      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted-foreground shadow-sm backdrop-blur"
          >
            <PulseDot size={8} />
            <span>{t('eyebrow')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut', delay: 0.04 }}
            className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            {t('headline')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut', delay: 0.1 }}
            className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
          >
            {t('subheadline')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut', delay: 0.16 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link href="/login">
              <Button size="lg" className="group rounded-full px-7">
                {t('ctaTalent')}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="rounded-full px-7">
                {t('ctaEnterprise')}
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.36, ease: 'easeOut', delay: 0.12 }}
          className="relative"
        >
          <div className="rounded-[2rem] border border-border/70 bg-background/90 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {t('heroCardLabel')}
                </p>
                <p className="mt-2 font-serif text-2xl text-foreground">{t('heroCardTitle')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: t('statProfiles'), value: 50, suffix: '+' },
                { label: t('statRoles'), value: 30, suffix: '+' },
                { label: t('statSignals'), value: 24, suffix: '/7' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="font-serif text-3xl text-foreground">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {[t('heroSignal1'), t('heroSignal2'), t('heroSignal3')].map((signal, index) => (
                <div
                  key={signal}
                  className={`rounded-2xl border px-4 py-3 ${index === 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border/60 bg-muted/20'}`}
                >
                  <p className="text-sm text-foreground">{signal}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
