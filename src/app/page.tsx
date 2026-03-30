import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <div className="min-h-screen bg-background">
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 h-16 w-16 rounded-full bg-gradient-to-br from-primary to-purple-500 opacity-80" />
        <h1 className="max-w-3xl font-serif text-5xl font-bold leading-tight tracking-tight">
          {t('headline')}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {t('subheadline')}
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('ctaTalent')}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('ctaEnterprise')}
          </Link>
        </div>
      </section>
    </div>
  );
}
