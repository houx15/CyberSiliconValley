import { PageTransition } from '@/components/animations/page-transition';
import { ProfileHeader } from '@/components/talent/profile-header';
import { CapabilityPortrait } from '@/components/talent/capability-portrait';
import { ExperienceList } from '@/components/talent/experience-list';
import { getTranslations } from 'next-intl/server';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';
import { getCurrentTalentProfile } from '@/lib/api/profile';
import type { Skill, Experience, Availability } from '@/types';

export default async function TalentHomePage() {
  const t = await getTranslations('talentHome');
  let profile = null;

  try {
    profile = await getCurrentTalentProfile();
  } catch {
    profile = MOCK_TALENT_PROFILE;
  }

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
    <PageTransition className="mx-auto max-w-4xl space-y-8">
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
    </PageTransition>
  );
}
