# Spec 2: Talent Home + Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the talent user's daily landing page (capability portrait, profile header, experience list) and a form-based profile editor, with proactive AI companion messages and background embedding on save.

**Architecture:** Two routes under the `(talent)` group: `/talent/home` renders the capability portrait from `talent_profiles` JSONB data with skill clusters, profile header, and experience cards. `/talent/profile` provides a form-based editor using Server Actions to update the profile and queue an `embed-profile` background job. The AI companion panel (built in Spec 0) is enhanced with proactive status messages and session tab wiring.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, Drizzle ORM, Server Actions, BullMQ, Zod

---

## File Structure

```
csv/
├── src/
│   ├── app/
│   │   └── (talent)/
│   │       ├── home/
│   │       │   └── page.tsx                   # Capability portrait + profile header + experience
│   │       └── profile/
│   │           ├── page.tsx                    # Profile editor page
│   │           └── actions.ts                 # Server Actions for profile save
│   ├── components/
│   │   ├── talent/
│   │   │   ├── profile-header.tsx             # Avatar, name, headline, availability badge
│   │   │   ├── skill-clusters.tsx             # Grouped skill tags with opacity by level
│   │   │   ├── experience-list.tsx            # Work experience card list
│   │   │   ├── profile-form.tsx               # Profile editor form (client component)
│   │   │   ├── skill-editor.tsx               # Add/remove/reorder skills (client component)
│   │   │   └── experience-editor.tsx          # Add/edit/delete experience entries (client component)
│   │   ├── ai/
│   │   │   └── companion-chat.tsx             # MODIFY: add proactive status + session tabs
│   │   └── layout/
│   │       └── companion-bar.tsx              # MODIFY: template-driven status messages
│   ├── lib/
│   │   └── talent/
│   │       └── queries.ts                     # DB queries for talent profile + counts
│   ├── i18n/
│   │   └── messages/
│   │       ├── en.json                        # MODIFY: add talent home/profile strings
│   │       └── zh.json                        # MODIFY: add talent home/profile strings
│   └── types/
│       └── index.ts                           # MODIFY: add Education, Goals types if missing
└── tests/
    └── talent/
        ├── queries.test.ts                    # DB query tests
        └── profile-actions.test.ts            # Server Action tests
```

---

### Task 1: Talent DB Query Layer

**Files:**
- Create: `src/lib/talent/queries.ts`
- Create: `tests/talent/queries.test.ts`

- [ ] **Step 1: Write query tests**

Create `tests/talent/queries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      id: 'profile-1',
      userId: 'user-1',
      displayName: 'Zhang Wei',
      headline: 'Senior AI Engineer',
      bio: 'Building intelligent systems.',
      skills: [
        { name: 'Python', level: 'expert', category: 'Programming' },
        { name: 'PyTorch', level: 'advanced', category: 'ML Frameworks' },
        { name: 'RAG', level: 'intermediate', category: 'AI Techniques' },
      ],
      experience: [
        {
          company: 'TechCorp',
          role: 'Senior Engineer',
          duration: '2022-01 - Present',
          description: 'Led RAG pipeline development.',
        },
      ],
      education: [
        { school: 'Tsinghua University', degree: 'M.S. Computer Science', year: '2020' },
      ],
      goals: { targetRoles: ['AI Lead', 'Staff Engineer'], workPreferences: ['remote'] },
      availability: 'open',
      salaryRange: { min: 400000, max: 600000, currency: 'CNY' },
      onboardingDone: true,
      updatedAt: new Date('2026-03-28'),
    }]),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  talentProfiles: { userId: 'user_id' },
  inboxItems: { userId: 'user_id', read: 'read' },
  matches: { talentId: 'talent_id', status: 'status' },
}));

describe('talent queries', () => {
  it('getTalentProfile returns profile for user', async () => {
    const { getTalentProfile } = await import('@/lib/talent/queries');
    const profile = await getTalentProfile('user-1');
    expect(profile).toBeDefined();
    expect(profile?.displayName).toBe('Zhang Wei');
    expect(profile?.skills).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/talent/queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement query layer**

Create `src/lib/talent/queries.ts`:

```typescript
import { db } from '@/lib/db';
import { talentProfiles, inboxItems, matches } from '@/lib/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import type { Skill, Experience } from '@/types';

export interface TalentProfileData {
  id: string;
  userId: string | null;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  goals: Goals;
  availability: string | null;
  salaryRange: SalaryRange | null;
  resumeUrl: string | null;
  onboardingDone: boolean | null;
  updatedAt: Date | null;
}

export interface Education {
  school: string;
  degree: string;
  year: string;
}

export interface Goals {
  targetRoles?: string[];
  workPreferences?: string[];
}

export interface SalaryRange {
  min?: number;
  max?: number;
  currency: string;
}

export async function getTalentProfile(userId: string): Promise<TalentProfileData | null> {
  const [profile] = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.userId, userId))
    .limit(1);

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    skills: (profile.skills as Skill[]) || [],
    experience: (profile.experience as Experience[]) || [],
    education: (profile.education as Education[]) || [],
    goals: (profile.goals as Goals) || {},
    availability: profile.availability,
    salaryRange: profile.salaryRange as SalaryRange | null,
    resumeUrl: profile.resumeUrl,
    onboardingDone: profile.onboardingDone,
    updatedAt: profile.updatedAt,
  };
}

export async function getUnreadInboxCount(userId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.userId, userId),
        eq(inboxItems.read, false)
      )
    );
  return result[0]?.value ?? 0;
}

export async function getNewMatchCount(talentProfileId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(matches)
    .where(
      and(
        eq(matches.talentId, talentProfileId),
        eq(matches.status, 'new')
      )
    );
  return result[0]?.value ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/talent/queries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/talent/queries.ts tests/talent/queries.test.ts
git commit -m "feat(spec2): add talent profile query layer with inbox/match counts"
```

---

### Task 2: Profile Header Component

**Files:**
- Create: `src/components/talent/profile-header.tsx`
- Modify: `src/i18n/messages/en.json` (add talent strings)
- Modify: `src/i18n/messages/zh.json` (add talent strings)

- [ ] **Step 1: Add i18n strings for talent home/profile**

In `src/i18n/messages/en.json`, add the following key at the top level (merge with existing):

```json
{
  "talent": {
    "home": {
      "title": "My Profile",
      "editProfile": "Edit Profile",
      "lastUpdated": "Last updated {date}",
      "availability": {
        "open": "Open to opportunities",
        "busy": "Busy",
        "not_looking": "Not looking"
      },
      "skillClusters": "Skills",
      "experience": "Experience",
      "noSkills": "No skills added yet. Visit your profile to add some.",
      "noExperience": "No experience added yet."
    },
    "profile": {
      "title": "Edit Profile",
      "sections": {
        "basic": "Basic Information",
        "skills": "Skills",
        "experience": "Work Experience",
        "education": "Education",
        "goals": "Career Goals",
        "preferences": "Preferences"
      },
      "fields": {
        "displayName": "Display Name",
        "headline": "Headline",
        "bio": "Bio",
        "availability": "Availability",
        "salaryMin": "Minimum Salary",
        "salaryMax": "Maximum Salary",
        "currency": "Currency",
        "targetRoles": "Target Roles",
        "workPreferences": "Work Preferences",
        "school": "School",
        "degree": "Degree",
        "year": "Year",
        "company": "Company",
        "role": "Role",
        "duration": "Duration",
        "description": "Description",
        "skillName": "Skill Name",
        "skillLevel": "Proficiency Level",
        "skillCategory": "Category"
      },
      "actions": {
        "save": "Save Changes",
        "saving": "Saving...",
        "saved": "Profile saved successfully!",
        "addSkill": "Add Skill",
        "removeSkill": "Remove",
        "addExperience": "Add Experience",
        "removeExperience": "Remove",
        "addEducation": "Add Education",
        "removeEducation": "Remove",
        "addRole": "Add Role",
        "removeRole": "Remove"
      }
    }
  }
}
```

In `src/i18n/messages/zh.json`, add the corresponding Chinese translations:

```json
{
  "talent": {
    "home": {
      "title": "我的档案",
      "editProfile": "编辑档案",
      "lastUpdated": "最后更新于 {date}",
      "availability": {
        "open": "开放机会",
        "busy": "忙碌中",
        "not_looking": "暂不考虑"
      },
      "skillClusters": "技能",
      "experience": "工作经历",
      "noSkills": "还没有添加技能。前往档案页面添加。",
      "noExperience": "还没有添加工作经历。"
    },
    "profile": {
      "title": "编辑档案",
      "sections": {
        "basic": "基本信息",
        "skills": "技能",
        "experience": "工作经历",
        "education": "教育背景",
        "goals": "职业目标",
        "preferences": "偏好设置"
      },
      "fields": {
        "displayName": "显示名称",
        "headline": "一句话简介",
        "bio": "个人简介",
        "availability": "可用状态",
        "salaryMin": "最低薪资",
        "salaryMax": "最高薪资",
        "currency": "货币",
        "targetRoles": "目标职位",
        "workPreferences": "工作偏好",
        "school": "学校",
        "degree": "学位",
        "year": "毕业年份",
        "company": "公司",
        "role": "职位",
        "duration": "时间段",
        "description": "描述",
        "skillName": "技能名称",
        "skillLevel": "熟练程度",
        "skillCategory": "类别"
      },
      "actions": {
        "save": "保存更改",
        "saving": "保存中...",
        "saved": "档案保存成功！",
        "addSkill": "添加技能",
        "removeSkill": "移除",
        "addExperience": "添加经历",
        "removeExperience": "移除",
        "addEducation": "添加教育经历",
        "removeEducation": "移除",
        "addRole": "添加职位",
        "removeRole": "移除"
      }
    }
  }
}
```

- [ ] **Step 2: Create profile header component**

Create `src/components/talent/profile-header.tsx`:

```tsx
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ProfileHeaderProps {
  displayName: string | null;
  headline: string | null;
  availability: string | null;
  updatedAt: Date | null;
}

const availabilityColors: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400 border-green-500/30',
  busy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  not_looking: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function ProfileHeader({
  displayName,
  headline,
  availability,
  updatedAt,
}: ProfileHeaderProps) {
  const t = useTranslations('talent.home');
  const name = displayName || 'Anonymous';
  const initial = name.charAt(0).toUpperCase();
  const availKey = availability || 'open';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-start gap-5 p-6 rounded-xl bg-zinc-900/50 border border-zinc-800"
    >
      <Avatar className="h-16 w-16 text-2xl">
        <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-serif">
          {initial}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold text-zinc-100 truncate">
            {name}
          </h1>
          <Badge
            variant="outline"
            className={`text-xs px-2 py-0.5 border ${availabilityColors[availKey] || availabilityColors.open}`}
          >
            {t(`availability.${availKey}` as 'availability.open' | 'availability.busy' | 'availability.not_looking')}
          </Badge>
        </div>

        {headline && (
          <p className="text-sm text-zinc-400 mb-2 truncate">{headline}</p>
        )}

        {updatedAt && (
          <p className="text-xs text-zinc-500">
            {t('lastUpdated', {
              date: new Intl.DateTimeFormat(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }).format(updatedAt),
            })}
          </p>
        )}
      </div>

      <Link href="/talent/profile">
        <Button variant="outline" size="sm" className="shrink-0">
          {t('editProfile')}
        </Button>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/talent/profile-header.tsx src/i18n/messages/en.json src/i18n/messages/zh.json
git commit -m "feat(spec2): add profile header component with avatar, availability badge, i18n"
```

---

### Task 3: Skill Clusters Component

**Files:**
- Create: `src/components/talent/skill-clusters.tsx`

- [ ] **Step 1: Create skill clusters component**

Create `src/components/talent/skill-clusters.tsx`:

```tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { Skill } from '@/types';

interface SkillClustersProps {
  skills: Skill[];
}

const levelOpacity: Record<string, string> = {
  expert: 'opacity-100 bg-violet-500/25 text-violet-300 border-violet-500/40',
  advanced: 'opacity-90 bg-violet-500/20 text-violet-300/90 border-violet-500/30',
  intermediate: 'opacity-75 bg-violet-500/15 text-violet-300/75 border-violet-500/20',
  beginner: 'opacity-60 bg-violet-500/10 text-violet-300/60 border-violet-500/15',
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const clusterVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

const tagVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15 },
  },
};

function groupSkillsByCategory(skills: Skill[]): Map<string, Skill[]> {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const category = skill.category || 'Other';
    const existing = groups.get(category) || [];
    existing.push(skill);
    groups.set(category, existing);
  }
  // Sort groups by size (largest first)
  return new Map(
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  );
}

export function SkillClusters({ skills }: SkillClustersProps) {
  const t = useTranslations('talent.home');

  if (skills.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">{t('skillClusters')}</h2>
        <p className="text-sm text-zinc-500">{t('noSkills')}</p>
      </div>
    );
  }

  const grouped = groupSkillsByCategory(skills);

  return (
    <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-400 mb-4">{t('skillClusters')}</h2>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap gap-4"
      >
        {[...grouped.entries()].map(([category, categorySkills]) => (
          <motion.div
            key={category}
            variants={clusterVariants}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3"
          >
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">
              {category}
            </span>
            <motion.div
              variants={containerVariants}
              className="flex flex-wrap gap-1.5"
            >
              {categorySkills
                .sort((a, b) => {
                  const order = ['expert', 'advanced', 'intermediate', 'beginner'];
                  return order.indexOf(a.level) - order.indexOf(b.level);
                })
                .map((skill) => (
                  <motion.div key={skill.name} variants={tagVariants}>
                    <Badge
                      variant="outline"
                      className={`text-xs px-2 py-0.5 border ${levelOpacity[skill.level] || levelOpacity.intermediate}`}
                    >
                      {skill.name}
                    </Badge>
                  </motion.div>
                ))}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/talent/skill-clusters.tsx
git commit -m "feat(spec2): add skill clusters component with category grouping and opacity by level"
```

---

### Task 4: Experience List Component

**Files:**
- Create: `src/components/talent/experience-list.tsx`

- [ ] **Step 1: Create experience list component**

Create `src/components/talent/experience-list.tsx`:

```tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { Experience } from '@/types';

interface ExperienceListProps {
  experiences: Experience[];
}

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

function sortByDateDescending(experiences: Experience[]): Experience[] {
  return [...experiences].sort((a, b) => {
    // Extract end date or treat "Present" as latest
    const getEndYear = (duration: string): number => {
      if (duration.toLowerCase().includes('present')) return 9999;
      const parts = duration.split('-').map((s) => s.trim());
      const end = parts[parts.length - 1] || '';
      const yearMatch = end.match(/(\d{4})/);
      return yearMatch ? parseInt(yearMatch[1], 10) : 0;
    };
    return getEndYear(b.duration) - getEndYear(a.duration);
  });
}

export function ExperienceList({ experiences }: ExperienceListProps) {
  const t = useTranslations('talent.home');

  if (experiences.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">{t('experience')}</h2>
        <p className="text-sm text-zinc-500">{t('noExperience')}</p>
      </div>
    );
  }

  const sorted = sortByDateDescending(experiences);

  return (
    <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-400 mb-4">{t('experience')}</h2>
      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {sorted.map((exp, idx) => (
          <motion.div key={`${exp.company}-${exp.role}-${idx}`} variants={cardVariants}>
            <Card className="bg-zinc-800/40 border-zinc-700/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200">
                      {exp.role}
                    </h3>
                    <p className="text-sm text-zinc-400">{exp.company}</p>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 ml-4">
                    {exp.duration}
                  </span>
                </div>
                {exp.description && (
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                    {exp.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/talent/experience-list.tsx
git commit -m "feat(spec2): add experience list component with date-sorted cards"
```

---

### Task 5: Talent Home Page

**Files:**
- Modify: `src/app/(talent)/home/page.tsx`

- [ ] **Step 1: Implement the talent home page**

Replace `src/app/(talent)/home/page.tsx`:

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTalentProfile, getUnreadInboxCount, getNewMatchCount } from '@/lib/talent/queries';
import { ProfileHeader } from '@/components/talent/profile-header';
import { SkillClusters } from '@/components/talent/skill-clusters';
import { ExperienceList } from '@/components/talent/experience-list';
import { getTranslations } from 'next-intl/server';

export default async function TalentHomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    redirect('/login');
  }

  const t = await getTranslations('talent.home');
  const profile = await getTalentProfile(userId);

  if (!profile) {
    // No profile yet — redirect to onboarding
    redirect('/talent/onboarding');
  }

  if (!profile.onboardingDone) {
    redirect('/talent/onboarding');
  }

  // Fetch counts for companion bar proactive messages
  const [inboxCount, matchCount] = await Promise.all([
    getUnreadInboxCount(userId),
    getNewMatchCount(profile.id),
  ]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <h1 className="sr-only">{t('title')}</h1>

      <ProfileHeader
        displayName={profile.displayName}
        headline={profile.headline}
        availability={profile.availability}
        updatedAt={profile.updatedAt}
      />

      <SkillClusters skills={profile.skills} />

      <ExperienceList experiences={profile.experience} />

      {/* Hidden data for companion bar to read via data attributes */}
      <div
        id="talent-home-context"
        data-inbox-count={inboxCount}
        data-match-count={matchCount}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run typecheck
```

Expected: No type errors related to the new files.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(talent\)/home/page.tsx
git commit -m "feat(spec2): implement talent home page with profile header, skill clusters, experience"
```

---

### Task 6: Companion Bar Proactive Status Messages

**Files:**
- Modify: `src/components/layout/companion-bar.tsx`
- Modify: `src/components/ai/companion-chat.tsx`

- [ ] **Step 1: Enhance companion bar with template-driven messages**

Modify `src/components/layout/companion-bar.tsx` to read from the DOM context element and display proactive messages. The companion bar already exists from Spec 0 as a collapsed one-liner. Enhance it to show context-aware status:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface CompanionBarProps {
  onExpand: () => void;
}

export function CompanionBar({ onExpand }: CompanionBarProps) {
  const t = useTranslations('companion');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    // Read counts from talent home page context element (if present)
    const contextEl = document.getElementById('talent-home-context');
    if (contextEl) {
      const inboxCount = parseInt(contextEl.dataset.inboxCount || '0', 10);
      const matchCount = parseInt(contextEl.dataset.matchCount || '0', 10);

      const parts: string[] = [];
      if (matchCount > 0) {
        parts.push(
          t('newMatches', { count: matchCount })
        );
      }
      if (inboxCount > 0) {
        parts.push(
          t('unreadInbox', { count: inboxCount })
        );
      }

      if (parts.length > 0) {
        setStatusMessage(parts.join(' '));
      }
    }
  }, [t]);

  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-3 px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg hover:bg-zinc-800/80 transition-colors duration-200 cursor-pointer text-left"
    >
      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
      <span className="text-sm text-zinc-400 truncate flex-1">
        {statusMessage || t('collapsed')}
      </span>
      <span className="text-xs text-zinc-500">{t('collapsed')}</span>
    </button>
  );
}
```

- [ ] **Step 2: Add companion i18n strings**

Merge into `src/i18n/messages/en.json` under the `"companion"` key:

```json
{
  "companion": {
    "placeholder": "Ask your companion anything...",
    "collapsed": "Click to chat →",
    "newMatches": "You have {count} new matches.",
    "unreadInbox": "{count} unread messages.",
    "tabs": {
      "general": "General",
      "home": "Home",
      "coach": "Coach"
    }
  }
}
```

Merge into `src/i18n/messages/zh.json` under the `"companion"` key:

```json
{
  "companion": {
    "placeholder": "问你的 AI 伙伴任何问题...",
    "collapsed": "点击开始对话 →",
    "newMatches": "你有 {count} 个新匹配。",
    "unreadInbox": "{count} 条未读消息。",
    "tabs": {
      "general": "通用",
      "home": "首页",
      "coach": "教练"
    }
  }
}
```

- [ ] **Step 3: Add session tabs to companion chat**

Modify `src/components/ai/companion-chat.tsx` to add session tab support. The component already has the expanded chat UI from Spec 0. Add the tab bar at the top of the expanded state:

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { CompanionBar } from '@/components/layout/companion-bar';

type SessionTab = 'general' | 'home' | 'coach';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CompanionChatProps {
  pageContext?: string;
}

export function CompanionChat({ pageContext }: CompanionChatProps) {
  const t = useTranslations('companion');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SessionTab>('general');
  const [messages, setMessages] = useState<Record<SessionTab, ChatMessage[]>>({
    general: [],
    home: [],
    coach: [],
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMessages = messages[activeTab] || [];

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), userMessage],
    }));
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('/api/internal/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionType: activeTab,
          pageContext,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), assistantMessage],
      }));

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) => ({
            ...prev,
            [activeTab]: (prev[activeTab] || []).map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: assistantContent }
                : m
            ),
          }));
        }
      }
    } catch (error) {
      console.error('Companion chat error:', error);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, activeTab, pageContext]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages]);

  if (!isExpanded) {
    return <CompanionBar onExpand={() => setIsExpanded(true)} />;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 48 }}
        animate={{ height: 420 }}
        exit={{ height: 48 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-zinc-900/95 border border-zinc-800 rounded-xl overflow-hidden flex flex-col"
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as SessionTab)}
            className="w-auto"
          >
            <TabsList className="h-7 bg-zinc-800/50">
              <TabsTrigger value="general" className="text-xs px-2 h-5">
                {t('tabs.general')}
              </TabsTrigger>
              <TabsTrigger value="home" className="text-xs px-2 h-5">
                {t('tabs.home')}
              </TabsTrigger>
              <TabsTrigger value="coach" className="text-xs px-2 h-5">
                {t('tabs.coach')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
          >
            ×
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 px-3 py-2">
          {currentMessages.length === 0 && (
            <p className="text-xs text-zinc-500 text-center mt-8">
              {t('placeholder')}
            </p>
          )}
          {currentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 text-sm ${
                msg.role === 'user'
                  ? 'text-zinc-200 text-right'
                  : 'text-zinc-400 text-left'
              }`}
            >
              <span
                className={`inline-block px-3 py-1.5 rounded-lg max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-violet-600/30 text-violet-200'
                    : 'bg-zinc-800/50 text-zinc-300'
                }`}
              >
                {msg.content || (isStreaming ? '...' : '')}
              </span>
            </div>
          ))}
        </ScrollArea>

        {/* Input */}
        <div className="px-3 py-2 border-t border-zinc-800 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('placeholder')}
            disabled={isStreaming}
            className="text-sm h-8 bg-zinc-800/50 border-zinc-700"
          />
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            size="sm"
            className="h-8 px-3"
          >
            {t('collapsed').includes('→') ? '→' : '→'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/companion-bar.tsx src/components/ai/companion-chat.tsx src/i18n/messages/en.json src/i18n/messages/zh.json
git commit -m "feat(spec2): enhance companion with proactive status messages and session tabs"
```

---

### Task 7: Profile Editor — Server Actions

**Files:**
- Create: `src/app/(talent)/profile/actions.ts`
- Create: `tests/talent/profile-actions.test.ts`

- [ ] **Step 1: Write server action test**

Create `tests/talent/profile-actions.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const updateMock = vi.fn().mockReturnThis();
  const setMock = vi.fn().mockReturnThis();
  const whereMock = vi.fn().mockResolvedValue([{ id: 'profile-1' }]);

  return {
    db: {
      update: updateMock,
      set: setMock,
      where: whereMock,
    },
  };
});

vi.mock('@/lib/db/schema', () => ({
  talentProfiles: { userId: 'user_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@/lib/jobs/queue', () => ({
  profileQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('user-1'),
  }),
}));

describe('profile actions - validation', () => {
  it('validates display name is required', async () => {
    const { profileUpdateSchema } = await import(
      '@/app/(talent)/profile/actions'
    );
    const result = profileUpdateSchema.safeParse({
      displayName: '',
      headline: 'Test',
      bio: '',
      skills: [],
      experience: [],
      education: [],
      goals: {},
      availability: 'open',
      salaryRange: null,
    });
    expect(result.success).toBe(false);
  });

  it('validates valid profile data passes', async () => {
    const { profileUpdateSchema } = await import(
      '@/app/(talent)/profile/actions'
    );
    const result = profileUpdateSchema.safeParse({
      displayName: 'Zhang Wei',
      headline: 'Senior AI Engineer',
      bio: 'Building intelligent systems.',
      skills: [{ name: 'Python', level: 'expert', category: 'Programming' }],
      experience: [
        {
          company: 'TechCorp',
          role: 'Engineer',
          duration: '2022 - Present',
          description: 'Built stuff.',
        },
      ],
      education: [{ school: 'Tsinghua', degree: 'MS CS', year: '2020' }],
      goals: { targetRoles: ['AI Lead'], workPreferences: ['remote'] },
      availability: 'open',
      salaryRange: { min: 400000, max: 600000, currency: 'CNY' },
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/talent/profile-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement server actions**

Create `src/app/(talent)/profile/actions.ts`:

```typescript
'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const skillSchema = z.object({
  name: z.string().min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  category: z.string().min(1),
});

const experienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  duration: z.string().min(1),
  description: z.string(),
});

const educationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  year: z.string().min(1),
});

const goalsSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  workPreferences: z.array(z.string()).optional(),
});

const salaryRangeSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().default('CNY'),
  })
  .nullable();

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  headline: z.string().max(500).optional().default(''),
  bio: z.string().optional().default(''),
  skills: z.array(skillSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  goals: goalsSchema.default({}),
  availability: z.enum(['open', 'busy', 'not_looking']).default('open'),
  salaryRange: salaryRangeSchema.default(null),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function saveProfile(data: ProfileUpdateInput): Promise<ActionResult> {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const parsed = profileUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const values = parsed.data;

  try {
    await db
      .update(talentProfiles)
      .set({
        displayName: values.displayName,
        headline: values.headline,
        bio: values.bio,
        skills: values.skills,
        experience: values.experience,
        education: values.education,
        goals: values.goals,
        availability: values.availability,
        salaryRange: values.salaryRange,
        updatedAt: new Date(),
      })
      .where(eq(talentProfiles.userId, userId));

    // Queue embed-profile background job to regenerate embedding
    try {
      const { profileQueue } = await import('@/lib/jobs/queue');
      await profileQueue.add('embed-profile', { userId });
    } catch (queueError) {
      // Non-fatal: embedding will be stale until next trigger
      console.error('Failed to queue embed-profile job:', queueError);
    }

    revalidatePath('/talent/home');
    revalidatePath('/talent/profile');

    return { success: true };
  } catch (error) {
    console.error('Failed to save profile:', error);
    return { success: false, error: 'Failed to save profile. Please try again.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/talent/profile-actions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(talent\)/profile/actions.ts tests/talent/profile-actions.test.ts
git commit -m "feat(spec2): add profile save server action with validation and embed-profile job queue"
```

---

### Task 8: Skill Editor Component

**Files:**
- Create: `src/components/talent/skill-editor.tsx`

- [ ] **Step 1: Create skill editor component**

Create `src/components/talent/skill-editor.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import type { Skill } from '@/types';

interface SkillEditorProps {
  skills: Skill[];
  onChange: (skills: Skill[]) => void;
}

const levelColors: Record<string, string> = {
  expert: 'bg-violet-500/25 text-violet-300',
  advanced: 'bg-violet-500/20 text-violet-300/90',
  intermediate: 'bg-violet-500/15 text-violet-300/75',
  beginner: 'bg-violet-500/10 text-violet-300/60',
};

const defaultCategories = [
  'Programming',
  'ML Frameworks',
  'AI Techniques',
  'Cloud & DevOps',
  'Data Engineering',
  'Soft Skills',
  'Domain Knowledge',
  'Other',
];

export function SkillEditor({ skills, onChange }: SkillEditorProps) {
  const t = useTranslations('talent.profile');
  const [newSkill, setNewSkill] = useState({
    name: '',
    level: 'intermediate' as Skill['level'],
    category: 'Programming',
  });

  const addSkill = () => {
    if (!newSkill.name.trim()) return;

    // Prevent duplicates
    if (skills.some((s) => s.name.toLowerCase() === newSkill.name.trim().toLowerCase())) {
      return;
    }

    onChange([...skills, { ...newSkill, name: newSkill.name.trim() }]);
    setNewSkill({ name: '', level: 'intermediate', category: newSkill.category });
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  const moveSkill = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === skills.length - 1)
    ) {
      return;
    }
    const newSkills = [...skills];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSkills[index], newSkills[targetIndex]] = [
      newSkills[targetIndex]!,
      newSkills[index]!,
    ];
    onChange(newSkills);
  };

  // Group existing skills by category for display
  const categories = [...new Set(skills.map((s) => s.category))];

  return (
    <div className="space-y-4">
      {/* Existing skills grouped by category */}
      {categories.map((category) => (
        <div key={category} className="space-y-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {category}
          </span>
          <div className="flex flex-wrap gap-2">
            {skills
              .map((skill, originalIndex) => ({ skill, originalIndex }))
              .filter(({ skill }) => skill.category === category)
              .map(({ skill, originalIndex }) => (
                <div key={originalIndex} className="flex items-center gap-1 group">
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-1 border border-zinc-700/50 ${levelColors[skill.level] || ''}`}
                  >
                    {skill.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      {skill.level}
                    </span>
                  </Badge>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveSkill(originalIndex, 'up')}
                      className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-300"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveSkill(originalIndex, 'down')}
                      className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-300"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSkill(originalIndex)}
                      className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Add new skill */}
      <div className="flex items-end gap-2 pt-2 border-t border-zinc-800">
        <div className="flex-1">
          <label className="text-xs text-zinc-500 mb-1 block">
            {t('fields.skillName')}
          </label>
          <Input
            value={newSkill.name}
            onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            placeholder="e.g., PyTorch"
            className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
          />
        </div>
        <div className="w-32">
          <label className="text-xs text-zinc-500 mb-1 block">
            {t('fields.skillLevel')}
          </label>
          <Select
            value={newSkill.level}
            onValueChange={(v) =>
              setNewSkill({ ...newSkill, level: v as Skill['level'] })
            }
          >
            <SelectTrigger className="h-8 text-sm bg-zinc-800/50 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <label className="text-xs text-zinc-500 mb-1 block">
            {t('fields.skillCategory')}
          </label>
          <Select
            value={newSkill.category}
            onValueChange={(v) => setNewSkill({ ...newSkill, category: v })}
          >
            <SelectTrigger className="h-8 text-sm bg-zinc-800/50 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {defaultCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={addSkill}
          size="sm"
          variant="outline"
          className="h-8"
        >
          {t('actions.addSkill')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/talent/skill-editor.tsx
git commit -m "feat(spec2): add skill editor with add/remove/reorder and category grouping"
```

---

### Task 9: Experience Editor Component

**Files:**
- Create: `src/components/talent/experience-editor.tsx`

- [ ] **Step 1: Create experience editor component**

Create `src/components/talent/experience-editor.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import type { Experience } from '@/types';

interface ExperienceEditorProps {
  experiences: Experience[];
  onChange: (experiences: Experience[]) => void;
}

export function ExperienceEditor({
  experiences,
  onChange,
}: ExperienceEditorProps) {
  const t = useTranslations('talent.profile');

  const addExperience = () => {
    onChange([
      ...experiences,
      { company: '', role: '', duration: '', description: '' },
    ]);
  };

  const updateExperience = (
    index: number,
    field: keyof Experience,
    value: string
  ) => {
    const updated = experiences.map((exp, i) =>
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange(updated);
  };

  const removeExperience = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {experiences.map((exp, index) => (
        <Card
          key={index}
          className="bg-zinc-800/40 border-zinc-700/50"
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs text-zinc-500">#{index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeExperience(index)}
                className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
              >
                {t('actions.removeExperience')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">
                  {t('fields.role')}
                </label>
                <Input
                  value={exp.role}
                  onChange={(e) =>
                    updateExperience(index, 'role', e.target.value)
                  }
                  placeholder="Senior AI Engineer"
                  className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">
                  {t('fields.company')}
                </label>
                <Input
                  value={exp.company}
                  onChange={(e) =>
                    updateExperience(index, 'company', e.target.value)
                  }
                  placeholder="TechCorp"
                  className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {t('fields.duration')}
              </label>
              <Input
                value={exp.duration}
                onChange={(e) =>
                  updateExperience(index, 'duration', e.target.value)
                }
                placeholder="2022-01 - Present"
                className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {t('fields.description')}
              </label>
              <textarea
                value={exp.description}
                onChange={(e) =>
                  updateExperience(index, 'description', e.target.value)
                }
                placeholder="Led RAG pipeline development processing 10K legal documents with 95% retrieval accuracy."
                rows={3}
                className="w-full text-sm bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        onClick={addExperience}
        variant="outline"
        size="sm"
        className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-300"
      >
        + {t('actions.addExperience')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/talent/experience-editor.tsx
git commit -m "feat(spec2): add experience editor with add/edit/delete entries"
```

---

### Task 10: Profile Form Component

**Files:**
- Create: `src/components/talent/profile-form.tsx`

- [ ] **Step 1: Create the full profile form**

Create `src/components/talent/profile-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from 'next-intl';
import { SkillEditor } from './skill-editor';
import { ExperienceEditor } from './experience-editor';
import { saveProfile } from '@/app/(talent)/profile/actions';
import type { Skill, Experience } from '@/types';
import type { Education, Goals, SalaryRange } from '@/lib/talent/queries';

interface ProfileFormProps {
  initialData: {
    displayName: string;
    headline: string;
    bio: string;
    skills: Skill[];
    experience: Experience[];
    education: Education[];
    goals: Goals;
    availability: string;
    salaryRange: SalaryRange | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const t = useTranslations('talent.profile');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState(initialData.displayName);
  const [headline, setHeadline] = useState(initialData.headline);
  const [bio, setBio] = useState(initialData.bio);
  const [skills, setSkills] = useState<Skill[]>(initialData.skills);
  const [experience, setExperience] = useState<Experience[]>(
    initialData.experience
  );
  const [education, setEducation] = useState<Education[]>(
    initialData.education
  );
  const [targetRoles, setTargetRoles] = useState<string[]>(
    initialData.goals.targetRoles || []
  );
  const [workPreferences, setWorkPreferences] = useState<string[]>(
    initialData.goals.workPreferences || []
  );
  const [availability, setAvailability] = useState(initialData.availability);
  const [salaryRange, setSalaryRange] = useState<SalaryRange | null>(
    initialData.salaryRange
  );

  // Education management
  const [newRoleInput, setNewRoleInput] = useState('');

  const addEducation = () => {
    setEducation([...education, { school: '', degree: '', year: '' }]);
  };

  const updateEducation = (
    index: number,
    field: keyof Education,
    value: string
  ) => {
    setEducation(
      education.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu
      )
    );
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  // Target roles management
  const addTargetRole = () => {
    if (newRoleInput.trim() && !targetRoles.includes(newRoleInput.trim())) {
      setTargetRoles([...targetRoles, newRoleInput.trim()]);
      setNewRoleInput('');
    }
  };

  const removeTargetRole = (index: number) => {
    setTargetRoles(targetRoles.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await saveProfile({
        displayName,
        headline,
        bio,
        skills,
        experience,
        education,
        goals: { targetRoles, workPreferences },
        availability: availability as 'open' | 'busy' | 'not_looking',
        salaryRange,
      });

      if (result.success) {
        setMessage({ type: 'success', text: t('actions.saved') });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to save.',
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Status message */}
      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Basic Information */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.basic')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {t('fields.displayName')}
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700"
              required
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {t('fields.headline')}
            </label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Senior AI Engineer | RAG & Agent Systems"
              className="bg-zinc-800/50 border-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {t('fields.bio')}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none text-sm"
            />
          </div>
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Skills */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.skills')}
        </h2>
        <SkillEditor skills={skills} onChange={setSkills} />
      </section>

      <Separator className="bg-zinc-800" />

      {/* Experience */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.experience')}
        </h2>
        <ExperienceEditor experiences={experience} onChange={setExperience} />
      </section>

      <Separator className="bg-zinc-800" />

      {/* Education */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.education')}
        </h2>
        <div className="space-y-3">
          {education.map((edu, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50 space-y-3"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs text-zinc-500">#{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEducation(index)}
                  className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                >
                  {t('actions.removeEducation')}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    {t('fields.school')}
                  </label>
                  <Input
                    value={edu.school}
                    onChange={(e) =>
                      updateEducation(index, 'school', e.target.value)
                    }
                    className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    {t('fields.degree')}
                  </label>
                  <Input
                    value={edu.degree}
                    onChange={(e) =>
                      updateEducation(index, 'degree', e.target.value)
                    }
                    className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    {t('fields.year')}
                  </label>
                  <Input
                    value={edu.year}
                    onChange={(e) =>
                      updateEducation(index, 'year', e.target.value)
                    }
                    className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            onClick={addEducation}
            variant="outline"
            size="sm"
            className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-300"
          >
            + {t('actions.addEducation')}
          </Button>
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Goals */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.goals')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">
              {t('fields.targetRoles')}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {targetRoles.map((role, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs border-zinc-700 text-zinc-300 flex items-center gap-1"
                >
                  {role}
                  <button
                    type="button"
                    onClick={() => removeTargetRole(idx)}
                    className="text-zinc-500 hover:text-red-400 ml-1"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && (e.preventDefault(), addTargetRole())
                }
                placeholder="e.g., AI Lead"
                className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
              />
              <Button
                type="button"
                onClick={addTargetRole}
                variant="outline"
                size="sm"
                className="h-8"
              >
                {t('actions.addRole')}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">
              {t('fields.workPreferences')}
            </label>
            <div className="flex gap-2">
              {['remote', 'hybrid', 'onsite'].map((pref) => (
                <Button
                  key={pref}
                  type="button"
                  variant={
                    workPreferences.includes(pref) ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => {
                    setWorkPreferences((prev) =>
                      prev.includes(pref)
                        ? prev.filter((p) => p !== pref)
                        : [...prev, pref]
                    );
                  }}
                  className="h-8 text-xs capitalize"
                >
                  {pref}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Preferences */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-4">
          {t('sections.preferences')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {t('fields.availability')}
            </label>
            <Select
              value={availability}
              onValueChange={setAvailability}
            >
              <SelectTrigger className="w-48 bg-zinc-800/50 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open to opportunities</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="not_looking">Not looking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {t('fields.salaryMin')}
              </label>
              <Input
                type="number"
                value={salaryRange?.min || ''}
                onChange={(e) =>
                  setSalaryRange({
                    ...salaryRange,
                    min: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    currency: salaryRange?.currency || 'CNY',
                  })
                }
                className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {t('fields.salaryMax')}
              </label>
              <Input
                type="number"
                value={salaryRange?.max || ''}
                onChange={(e) =>
                  setSalaryRange({
                    ...salaryRange,
                    max: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    currency: salaryRange?.currency || 'CNY',
                  })
                }
                className="h-8 text-sm bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {t('fields.currency')}
              </label>
              <Select
                value={salaryRange?.currency || 'CNY'}
                onValueChange={(v) =>
                  setSalaryRange({ ...salaryRange, currency: v })
                }
              >
                <SelectTrigger className="h-8 text-sm bg-zinc-800/50 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending}
          className="min-w-32"
        >
          {isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/talent/profile-form.tsx
git commit -m "feat(spec2): add profile form with all editable sections wired to server action"
```

---

### Task 11: Profile Editor Page

**Files:**
- Modify: `src/app/(talent)/profile/page.tsx` (replace placeholder)

- [ ] **Step 1: Implement profile editor page**

Replace `src/app/(talent)/profile/page.tsx`:

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTalentProfile } from '@/lib/talent/queries';
import { ProfileForm } from '@/components/talent/profile-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function TalentProfilePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    redirect('/login');
  }

  const t = await getTranslations('talent.profile');
  const profile = await getTalentProfile(userId);

  if (!profile) {
    redirect('/talent/onboarding');
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">{t('title')}</h1>
        <Link href="/talent/home">
          <Button variant="ghost" size="sm" className="text-zinc-400">
            ← Back
          </Button>
        </Link>
      </div>

      <ProfileForm
        initialData={{
          displayName: profile.displayName || '',
          headline: profile.headline || '',
          bio: profile.bio || '',
          skills: profile.skills,
          experience: profile.experience,
          education: profile.education,
          goals: profile.goals,
          availability: profile.availability || 'open',
          salaryRange: profile.salaryRange,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(talent\)/profile/page.tsx
git commit -m "feat(spec2): implement profile editor page with back navigation"
```

---

### Task 12: Add Select Component (shadcn/ui dependency)

**Files:**
- Create: `src/components/ui/select.tsx` (via shadcn CLI)

- [ ] **Step 1: Install Select component**

The SkillEditor and ProfileForm use the Select component which may not have been installed in Spec 0. Install it if missing:

```bash
npx shadcn@latest add select
```

- [ ] **Step 2: Verify**

```bash
ls src/components/ui/select.tsx
```

Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "feat(spec2): add shadcn select component for skill/preference editors"
```

---

### Task 13: Background Job Queue Integration

**Files:**
- Modify: `src/lib/jobs/queue.ts` (add profile-specific queue export)

- [ ] **Step 1: Add profile queue export**

In `src/lib/jobs/queue.ts`, add a named export for the profile queue so the server action can import it. The queue definitions file from Spec 0 already defines job types including `embed-profile`. Ensure this export exists:

Add to `src/lib/jobs/queue.ts` (if not already present):

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from './redis-connection';

// ... existing queue definitions from Spec 0 ...

export const profileQueue = new Queue('profile', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Re-export for backward compatibility if the queue was named differently in Spec 0
export { profileQueue as embedProfileQueue };
```

If Spec 0 already has a queue that handles `embed-profile` jobs (e.g., a shared queue with typed job names), adjust the import in `src/app/(talent)/profile/actions.ts` to match. The server action imports `profileQueue` from `@/lib/jobs/queue` and calls `profileQueue.add('embed-profile', { userId })`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/jobs/queue.ts
git commit -m "feat(spec2): export profile queue for embed-profile background job"
```

---

### Task 14: Add Route to (talent) Layout

**Files:**
- Modify: `src/app/(talent)/layout.tsx` (ensure /profile route is accessible)

- [ ] **Step 1: Verify profile route is accessible**

The `(talent)` layout from Spec 0 wraps all talent routes. The `/talent/profile` route is inside the `(talent)` group and will automatically use the talent layout with sidebar and companion panel. No sidebar nav link is needed for the profile page (it is accessed via the "Edit Profile" button on the home page).

Verify the talent layout does not block the `/profile` route:

```bash
npm run dev
# Navigate to /talent/home and /talent/profile
```

Expected: Both routes render within the talent layout shell.

- [ ] **Step 2: Commit (if layout changes were needed)**

```bash
# Only commit if changes were made to the layout
git add src/app/\(talent\)/layout.tsx
git commit -m "feat(spec2): ensure profile route works within talent layout"
```

---

### Task 15: Types Verification and Final Integration Test

**Files:**
- Modify: `src/types/index.ts` (if needed)

- [ ] **Step 1: Verify types are complete**

Ensure `src/types/index.ts` includes the `Experience` and `Skill` types that the components depend on. These should already exist from Spec 0. Verify:

```typescript
// These should already exist in src/types/index.ts from Spec 0:
export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: string;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  description: string;
}
```

If they don't exist, add them.

- [ ] **Step 2: Run full check**

```bash
npm run check
```

Expected: All lint, typecheck, and tests pass.

- [ ] **Step 3: Run dev server and manually verify**

```bash
npm run dev
```

Manual verification checklist:
1. Log in as `talent1@csv.dev` / `csv2026`
2. Navigate to `/talent/home` — see profile header with avatar, name, headline, availability badge
3. See skill clusters grouped by category with opacity varying by level
4. See experience cards sorted by date
5. See companion bar with proactive status message (match/inbox counts)
6. Click "Edit Profile" — navigate to `/talent/profile`
7. Edit display name, add a skill, add an experience entry
8. Click "Save Changes" — see success message
9. Navigate back to `/talent/home` — see updated data
10. Expand companion chat — see session tabs (General, Home, Coach)
11. Send a message in the companion — see streaming response

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(spec2): complete talent home + profile implementation"
```
