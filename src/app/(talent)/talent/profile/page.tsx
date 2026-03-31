import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ProfileEditor } from '@/components/talent/profile-editor';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';
import Link from 'next/link';
import type { Skill, Experience, Availability } from '@/types';

interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

interface Goals {
  targetRoles?: string[];
  workPreferences?: string[];
}

interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
}

async function getProfile(userId: string) {
  try {
    const { db } = await import('@/lib/db');
    const { talentProfiles } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const [profile] = await db
      .select()
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);
    return profile;
  } catch {
    return MOCK_TALENT_PROFILE;
  }
}

export default async function ProfileEditorPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || 'test-user-1';
  const t = await getTranslations('profileEditor');

  const profile = await getProfile(userId);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t('noProfile')}</p>
      </div>
    );
  }

  const initial = {
    displayName: profile.displayName || '',
    headline: profile.headline || '',
    bio: profile.bio || '',
    skills: (profile.skills as Skill[]) || [],
    experience: (profile.experience as Experience[]) || [],
    education: (profile.education as Education[]) || [],
    goals: (profile.goals as Goals) || {},
    availability: (profile.availability as Availability) || 'open',
    salaryRange: (profile.salaryRange as SalaryRange) || {},
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <Link href="/talent/home" className="text-sm text-muted-foreground hover:text-foreground">
          {t('backToHome')}
        </Link>
      </div>
      <ProfileEditor initial={initial} />
    </div>
  );
}
