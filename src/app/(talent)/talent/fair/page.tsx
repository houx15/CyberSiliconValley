import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import FairClient from './fair-client';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { verifyJWT } from '@/lib/auth';
import { MOCK_TALENT_PROFILE } from '@/lib/mock-data';

export default async function FairPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  let userId = MOCK_TALENT_PROFILE.userId;

  if (token) {
    try {
      const auth = await verifyJWT(token);
      if (auth.role === 'talent') {
        userId = auth.userId;
      }
    } catch {
      userId = MOCK_TALENT_PROFILE.userId;
    }
  }

  let userSkills = MOCK_TALENT_PROFILE.skills.map((skill) => skill.name);

  try {
    const rows = await db
      .select({ skills: talentProfiles.skills })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1);

    const profileSkills = rows[0]?.skills as Array<{ name?: string }> | undefined;
    if (profileSkills && profileSkills.length > 0) {
      userSkills = profileSkills.map((skill) => skill.name).filter((name): name is string => Boolean(name));
    }
  } catch {
    userSkills = MOCK_TALENT_PROFILE.skills.map((skill) => skill.name);
  }

  return <FairClient userSkills={userSkills} />;
}
