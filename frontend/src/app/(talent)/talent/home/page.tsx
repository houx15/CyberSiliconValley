import { PageTransition } from '@/components/animations/page-transition';
import { BuddyReport } from '@/components/talent/buddy-report';
import { ResumeEditor } from '@/components/talent/resume-editor';
import { ProfileHeader } from '@/components/talent/profile-header';
import { getTranslations } from 'next-intl/server';
import { MOCK_TALENT_PROFILE, MOCK_TALENT_HOME_STATS } from '@/lib/mock-data';
import { getCurrentTalentProfile } from '@/lib/api/profile';
import { getTalentHomeStats } from '@/lib/api/talent-dashboard';
import type { Skill, Experience, Availability } from '@/types';
import type { TalentHomeStats } from '@/lib/api/talent-dashboard';

export default async function TalentHomePage() {
  const t = await getTranslations('talentHome');
  let profile = null;
  let homeStats: TalentHomeStats = MOCK_TALENT_HOME_STATS;

  try {
    const [profileData, statsData] = await Promise.all([
      getCurrentTalentProfile(),
      getTalentHomeStats(),
    ]);
    profile = profileData;
    homeStats = statsData;
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

  const editorProfile = {
    displayName: profile.displayName || '',
    headline: profile.headline || '',
    bio: (profile as Record<string, unknown>).bio as string || '',
    skills,
    experience,
    education: ((profile as Record<string, unknown>).education as Array<{ institution: string; degree: string; field: string; year: string }>) || [],
    goals: ((profile as Record<string, unknown>).goals as { targetRoles?: string[]; workPreferences?: string[] }) || {},
    availability: (profile.availability as Availability) || 'open',
    salaryRange: ((profile as Record<string, unknown>).salaryRange as { min?: number; max?: number; currency?: string }) || {},
  };

  return (
    <PageTransition className="mx-auto max-w-4xl space-y-6">
      <ProfileHeader
        displayName={profile.displayName}
        headline={profile.headline}
        availability={(profile.availability as Availability) || 'open'}
        updatedAt={profile.updatedAt}
      />

      <BuddyReport stats={homeStats} displayName={profile.displayName || '你'} />

      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          编辑简历
        </h2>
        <ResumeEditor profile={editorProfile} />
      </section>
    </PageTransition>
  );
}
