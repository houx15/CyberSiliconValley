import { generateText } from 'ai';
import { asc, eq, notLike, sql } from 'drizzle-orm';

import { hashPassword } from '../../src/lib/auth';
import { getModel } from '../../src/lib/ai/providers';
import { db } from '../../src/lib/db';
import {
  enterpriseProfiles,
  talentProfiles,
  users,
} from '../../src/lib/db/schema';
import {
  buildEnterpriseProfilePrompt,
  buildTalentProfilePrompt,
} from './prompts';
import {
  CHINESE_FAMILY_NAMES,
  CHINESE_GIVEN_NAMES,
  COMPANY_NAMES,
  type SkillCategory,
  SKILL_VOCABULARY,
  isValidSkillName,
} from './vocabulary';

type GeneratedSkill = {
  name: string;
  level?: string;
  category?: string;
};

type GeneratedTalentProfile = {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills?: GeneratedSkill[];
  experience?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  goals?: Record<string, unknown>;
  availability?: string;
  salaryRange?: Record<string, unknown> | null;
  seniority?: string;
  background?: string;
  yearsOfExperience?: number;
};

type GeneratedEnterpriseProfile = {
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  description?: string;
  aiMaturity?: string;
  preferences?: Record<string, unknown>;
};

const TALENT_BATCHES: Array<{
  specialization: SkillCategory;
  count: number;
  seniorityMix: string;
  backgroundMix: string;
  availabilityMix: string;
}> = [
  {
    specialization: 'NLP/RAG',
    count: 12,
    seniorityMix: '3 senior, 5 mid, 3 junior, 1 student',
    backgroundMix:
      '5 industry_engineer, 2 researcher_phd, 2 freelancer, 1 career_changer, 1 student, 1 startup_founder',
    availabilityMix: '7 open, 3 busy, 2 not_looking',
  },
  {
    specialization: 'AI Agent/Framework',
    count: 10,
    seniorityMix: '3 senior, 4 mid, 2 junior, 1 student',
    backgroundMix:
      '4 industry_engineer, 2 researcher_phd, 2 freelancer, 1 career_changer, 1 startup_founder',
    availabilityMix: '6 open, 2 busy, 2 not_looking',
  },
  {
    specialization: 'Data Analysis/ML',
    count: 8,
    seniorityMix: '2 senior, 3 mid, 2 junior, 1 student',
    backgroundMix:
      '3 industry_engineer, 2 researcher_phd, 1 freelancer, 1 career_changer, 1 student',
    availabilityMix: '5 open, 2 busy, 1 not_looking',
  },
  {
    specialization: 'Computer Vision',
    count: 6,
    seniorityMix: '2 senior, 2 mid, 1 junior, 1 student',
    backgroundMix: '2 industry_engineer, 2 researcher_phd, 1 freelancer, 1 student',
    availabilityMix: '4 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Prompt Engineering',
    count: 5,
    seniorityMix: '1 senior, 2 mid, 1 junior, 1 student',
    backgroundMix: '2 industry_engineer, 1 career_changer, 1 freelancer, 1 student',
    availabilityMix: '3 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Fine-tuning/Training',
    count: 5,
    seniorityMix: '2 senior, 2 mid, 1 junior',
    backgroundMix: '2 industry_engineer, 2 researcher_phd, 1 startup_founder',
    availabilityMix: '3 open, 1 busy, 1 not_looking',
  },
  {
    specialization: 'Full-stack+AI',
    count: 4,
    seniorityMix: '1 senior, 2 mid, 1 junior',
    backgroundMix: '2 industry_engineer, 1 freelancer, 1 career_changer',
    availabilityMix: '2 open, 2 busy',
  },
];

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonArray<T>(text: string): T[] {
  const parsed = JSON.parse(stripJsonFences(text)) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function normalizeLevel(value: unknown): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'expert') {
    return value;
  }
  return 'intermediate';
}

function uniqueChineseName(index: number, usedNames: Set<string>): string {
  for (let offset = 0; offset < CHINESE_FAMILY_NAMES.length * CHINESE_GIVEN_NAMES.length; offset += 1) {
    const family = CHINESE_FAMILY_NAMES[(index + offset) % CHINESE_FAMILY_NAMES.length];
    const given = CHINESE_GIVEN_NAMES[(index * 3 + offset) % CHINESE_GIVEN_NAMES.length];
    const candidate = `${family}${given}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `张${index}`;
}

function uniqueCompanyName(index: number, usedNames: Set<string>): string {
  for (let offset = 0; offset < COMPANY_NAMES.length; offset += 1) {
    const candidate = COMPANY_NAMES[(index + offset) % COMPANY_NAMES.length];
    if (!candidate) {
      continue;
    }
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `云象智能${index + 1}`;
}

function normalizeTalentSkills(
  skills: GeneratedSkill[] | undefined,
  specialization: SkillCategory
): Array<{ name: string; level: 'beginner' | 'intermediate' | 'advanced' | 'expert'; category: string }> {
  const unique = new Map<
    string,
    { name: string; level: 'beginner' | 'intermediate' | 'advanced' | 'expert'; category: string }
  >();

  for (const skill of skills ?? []) {
    if (!skill?.name || !isValidSkillName(skill.name)) {
      continue;
    }

    unique.set(skill.name, {
      name: skill.name,
      level: normalizeLevel(skill.level),
      category:
        typeof skill.category === 'string' && skill.category.length > 0
          ? skill.category
          : specialization,
    });
  }

  if (unique.size < 5) {
    for (const skillName of SKILL_VOCABULARY[specialization]) {
      if (unique.size >= 5) {
        break;
      }

      if (!unique.has(skillName)) {
        unique.set(skillName, {
          name: skillName,
          level: 'intermediate',
          category: specialization,
        });
      }
    }
  }

  return [...unique.values()].slice(0, 10);
}

function normalizeWebsite(companyName: string, website: string | undefined): string {
  if (website && /^https?:\/\//.test(website)) {
    return website;
  }

  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `https://${slug || 'csv-enterprise'}.example.com`;
}

export async function seedTalentProfiles(): Promise<void> {
  console.log('👤 Generating talent profiles via LLM...');

  const existingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(talentProfiles);
  const existingCount = existingRows[0]?.count ?? 0;

  if (existingCount >= 50) {
    console.log('  ✓ 50+ talent profiles already exist, skipping.\n');
    return;
  }

  const demoTalentUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'talent'))
    .orderBy(asc(users.createdAt));
  const existingProfileRows = await db
    .select({ displayName: talentProfiles.displayName })
    .from(talentProfiles);
  const usedNames = new Set(
    existingProfileRows
      .map((row) => row.displayName?.trim())
      .filter((name): name is string => Boolean(name))
  );

  const defaultPasswordHash = await hashPassword('csv2026');
  const model = getModel();
  let profileIndex = 0;

  for (const batch of TALENT_BATCHES) {
    console.log(`  Generating ${batch.count} ${batch.specialization} profiles...`);

    const { text } = await generateText({
      model,
      prompt: buildTalentProfilePrompt({
        batchIndex: TALENT_BATCHES.indexOf(batch),
        count: batch.count,
        specialization: batch.specialization,
        seniorityMix: batch.seniorityMix,
        backgroundMix: batch.backgroundMix,
        availabilityMix: batch.availabilityMix,
        existingNames: [...usedNames],
      }),
      maxOutputTokens: 8000,
      temperature: 0.9,
    });

    let profiles: GeneratedTalentProfile[] = [];
    try {
      profiles = parseJsonArray<GeneratedTalentProfile>(text);
    } catch (error) {
      console.error(
        `  ✗ Failed to parse LLM response for ${batch.specialization}:`,
        error
      );
      continue;
    }

    for (const profile of profiles.slice(0, batch.count)) {
      const normalizedSkills = normalizeTalentSkills(
        profile.skills,
        batch.specialization
      );
      const displayName = profile.displayName?.trim()
        ? usedNames.has(profile.displayName.trim())
          ? uniqueChineseName(profileIndex, usedNames)
          : profile.displayName.trim()
        : uniqueChineseName(profileIndex, usedNames);
      usedNames.add(displayName);

      let userId = demoTalentUsers[profileIndex]?.id;

      if (!userId) {
        const email = `talent-seed-${profileIndex + 1}@csv.dev`;
        const [createdUser] = await db
          .insert(users)
          .values({
            email,
            passwordHash: defaultPasswordHash,
            role: 'talent',
          })
          .onConflictDoNothing()
          .returning({ id: users.id });

        if (createdUser) {
          userId = createdUser.id;
        } else {
          const [existingUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          userId = existingUser?.id;
        }
      }

      if (!userId) {
        continue;
      }

      await db
        .insert(talentProfiles)
        .values({
          userId,
          displayName,
          headline: profile.headline?.trim() || `${batch.specialization} Specialist`,
          bio: profile.bio?.trim() || `${displayName} focuses on ${batch.specialization} delivery and applied AI systems in production.`,
          skills: normalizedSkills,
          experience: (profile.experience ?? []) as object[],
          education: (profile.education ?? []) as object[],
          goals: (profile.goals ?? {}) as object,
          availability: profile.availability ?? 'open',
          salaryRange: (profile.salaryRange ?? null) as object | null,
          profileData: {
            seniority: profile.seniority ?? 'mid',
            background: profile.background ?? 'industry_engineer',
            yearsOfExperience: profile.yearsOfExperience ?? 3,
            specialization: batch.specialization,
          },
          onboardingDone: true,
        })
        .onConflictDoUpdate({
          target: talentProfiles.userId,
          set: {
            displayName,
            headline:
              profile.headline?.trim() || `${batch.specialization} Specialist`,
            bio:
              profile.bio?.trim() ||
              `${displayName} focuses on ${batch.specialization} delivery and applied AI systems in production.`,
            skills: normalizedSkills,
            experience: (profile.experience ?? []) as object[],
            education: (profile.education ?? []) as object[],
            goals: (profile.goals ?? {}) as object,
            availability: profile.availability ?? 'open',
            salaryRange: (profile.salaryRange ?? null) as object | null,
            profileData: {
              seniority: profile.seniority ?? 'mid',
              background: profile.background ?? 'industry_engineer',
              yearsOfExperience: profile.yearsOfExperience ?? 3,
              specialization: batch.specialization,
            },
            onboardingDone: true,
            updatedAt: new Date(),
          },
        });

      profileIndex += 1;
    }

    console.log(`  ✓ ${Math.min(profiles.length, batch.count)} ${batch.specialization} profiles inserted.`);
  }

  console.log(`✅ ${profileIndex} talent profiles generated.\n`);
}

export async function seedEnterpriseProfiles(): Promise<void> {
  console.log('🏢 Generating enterprise profiles via LLM...');

  const existingCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enterpriseProfiles);
  const existingCount = existingCountRows[0]?.count ?? 0;

  if (existingCount >= 15) {
    console.log('  ✓ 15+ enterprise profiles already exist, skipping.\n');
    return;
  }

  const demoEnterpriseUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'enterprise'))
    .orderBy(asc(users.createdAt));
  const existingCompanyRows = await db
    .select({ companyName: enterpriseProfiles.companyName })
    .from(enterpriseProfiles);
  const usedCompanyNames = new Set(
    existingCompanyRows
      .map((row) => row.companyName?.trim())
      .filter((name): name is string => Boolean(name))
  );
  const defaultPasswordHash = await hashPassword('csv2026');
  const model = getModel();

  const { text } = await generateText({
    model,
    prompt: buildEnterpriseProfilePrompt(15),
    maxOutputTokens: 6000,
    temperature: 0.8,
  });

  let profiles: GeneratedEnterpriseProfile[] = [];
  try {
    profiles = parseJsonArray<GeneratedEnterpriseProfile>(text);
  } catch (error) {
    console.error(
      '  ✗ Failed to parse LLM response for enterprise profiles:',
      error
    );
    return;
  }

  let profileIndex = 0;
  for (const profile of profiles.slice(0, 15)) {
    const companyName = profile.companyName?.trim()
      ? usedCompanyNames.has(profile.companyName.trim())
        ? uniqueCompanyName(profileIndex, usedCompanyNames)
        : profile.companyName.trim()
      : uniqueCompanyName(profileIndex, usedCompanyNames);
    usedCompanyNames.add(companyName);

    let userId = demoEnterpriseUsers[profileIndex]?.id;
    if (!userId) {
      const email = `enterprise-seed-${profileIndex + 1}@csv.dev`;
      const [createdUser] = await db
        .insert(users)
        .values({
          email,
          passwordHash: defaultPasswordHash,
          role: 'enterprise',
        })
        .onConflictDoNothing()
        .returning({ id: users.id });

      if (createdUser) {
        userId = createdUser.id;
      } else {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        userId = existingUser?.id;
      }
    }

    if (!userId) {
      continue;
    }

    await db
      .insert(enterpriseProfiles)
      .values({
        userId,
        companyName,
        industry: profile.industry?.trim() || 'AI/ML Platform',
        companySize: profile.companySize?.trim() || '50-200',
        website: normalizeWebsite(companyName, profile.website),
        description:
          profile.description?.trim() ||
          `${companyName} builds applied AI systems for enterprise customers across China.`,
        aiMaturity: profile.aiMaturity?.trim() || 'adopting',
        preferences: (profile.preferences ?? {}) as object,
        profileData: {},
        onboardingDone: true,
      })
      .onConflictDoUpdate({
        target: enterpriseProfiles.userId,
        set: {
          companyName,
          industry: profile.industry?.trim() || 'AI/ML Platform',
          companySize: profile.companySize?.trim() || '50-200',
          website: normalizeWebsite(companyName, profile.website),
          description:
            profile.description?.trim() ||
            `${companyName} builds applied AI systems for enterprise customers across China.`,
          aiMaturity: profile.aiMaturity?.trim() || 'adopting',
          preferences: (profile.preferences ?? {}) as object,
          onboardingDone: true,
          updatedAt: new Date(),
        },
      });

    profileIndex += 1;
  }

  console.log(`✅ ${profileIndex} enterprise profiles generated.\n`);
}
