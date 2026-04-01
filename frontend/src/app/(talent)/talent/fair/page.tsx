import { PageTransition } from '@/components/animations/page-transition';
import { NoMatches } from '@/components/empty-states/no-matches';
import FairClient from './fair-client';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';
import { getCurrentTalentProfile } from '@/lib/api/profile';

export default async function FairPage() {
  let userSkills = MOCK_TALENT_PROFILE.skills.map((skill) => skill.name);

  try {
    const profile = await getCurrentTalentProfile();
    if (profile?.skills.length) {
      userSkills = profile.skills
        .map((skill) => skill.name)
        .filter((name): name is string => Boolean(name));
    }
  } catch {
    userSkills = MOCK_TALENT_PROFILE.skills.map((skill) => skill.name);
  }

  if (userSkills.length === 0) {
    return <NoMatches />;
  }

  return (
    <PageTransition>
      <FairClient userSkills={userSkills} />
    </PageTransition>
  );
}
