'use client';

import { useTranslations } from 'next-intl';
import type { Availability } from '@/types';

interface ProfileHeaderProps {
  displayName: string | null;
  headline: string | null;
  availability: Availability;
  updatedAt: Date;
}

const AVAILABILITY_CONFIG: Record<Availability, { labelKey: string; className: string }> = {
  open: {
    labelKey: 'availabilityOpen',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  busy: {
    labelKey: 'availabilityBusy',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  not_looking: {
    labelKey: 'availabilityNotLooking',
    className: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  },
};

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export function ProfileHeader({
  displayName,
  headline,
  availability,
  updatedAt,
}: ProfileHeaderProps) {
  const t = useTranslations('talentHome');

  const avail = AVAILABILITY_CONFIG[availability] || AVAILABILITY_CONFIG.open;

  return (
    <div className="flex items-start gap-5">
      {/* Avatar */}
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-2xl font-bold text-white">
        {getInitial(displayName)}
      </div>

      {/* Info */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {displayName || t('unnamed')}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${avail.className}`}
          >
            {t(avail.labelKey)}
          </span>
        </div>

        {headline && (
          <p className="text-sm text-muted-foreground">{headline}</p>
        )}

        <p className="text-xs text-muted-foreground/70">
          {t('lastUpdated', {
            date: new Intl.DateTimeFormat(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(new Date(updatedAt)),
          })}
        </p>
      </div>

    </div>
  );
}
