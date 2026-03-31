import { headers } from 'next/headers';
import { ProfileHeader } from '@/components/talent/profile-header';
import { CapabilityPortrait } from '@/components/talent/capability-portrait';
import { ExperienceList } from '@/components/talent/experience-list';
import { getTranslations } from 'next-intl/server';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';
import type { Skill, Experience, Availability } from '@/types';

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

export default async function TalentHomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || 'test-user-1';
  const t = await getTranslations('talentHome');

  const profile = await getProfile(userId);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t('noProfile')}</p>
      </div>
    );
  }

  const skills = (profile.skills as Skill[]) || [];
  const experience = (profile.experience as Experience[]) || [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ProfileHeader
        displayName={profile.displayName}
        headline={profile.headline}
        availability={(profile.availability as Availability) || 'open'}
        updatedAt={profile.updatedAt}
      />
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t('skillsTitle')}
        </h2>
        <CapabilityPortrait skills={skills} />
      </section>
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t('experienceTitle')}
        </h2>
        <ExperienceList experience={experience} />
      </section>
    </div>
  );
}
