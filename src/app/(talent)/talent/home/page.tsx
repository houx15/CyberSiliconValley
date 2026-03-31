import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileHeader } from '@/components/talent/profile-header';
import { CapabilityPortrait } from '@/components/talent/capability-portrait';
import { ExperienceList } from '@/components/talent/experience-list';
import { getTranslations } from 'next-intl/server';
import type { Skill, Experience, Availability } from '@/types';

export default async function TalentHomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id')!;
  const t = await getTranslations('talentHome');

  const [profile] = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.userId, userId))
    .limit(1);

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
      {/* Profile Header */}
      <ProfileHeader
        displayName={profile.displayName}
        headline={profile.headline}
        availability={(profile.availability as Availability) || 'open'}
        updatedAt={profile.updatedAt}
      />

      {/* Capability Portrait */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t('skillsTitle')}
        </h2>
        <CapabilityPortrait skills={skills} />
      </section>

      {/* Experience */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t('experienceTitle')}
        </h2>
        <ExperienceList experience={experience} />
      </section>
    </div>
  );
}
