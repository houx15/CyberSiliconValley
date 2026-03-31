'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { User, Briefcase, Code, Target } from 'lucide-react';
import type { Skill, Experience } from '@/types';

interface ProfileData {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills: Skill[];
  experience: Experience[];
  goals?: {
    targetRoles?: string[];
    workPreferences?: string[];
    interests?: string[];
  };
}

interface ProfileRevealProps {
  profileData: ProfileData;
  revealedFields: Set<string>;
}

const revealAnimation = {
  hidden: {
    filter: 'blur(20px)',
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    filter: 'blur(0px)',
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      duration: 0.6,
      bounce: 0.2,
    },
  },
};

const skillAnimation = {
  hidden: {
    filter: 'blur(10px)',
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    filter: 'blur(0px)',
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      duration: 0.4,
      bounce: 0.3,
    },
  },
};

function FoggedSection({
  revealed,
  children,
  icon: Icon,
  label,
}: {
  revealed: boolean;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="relative">
      {/* Always show the fogged placeholder */}
      {!revealed && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-foreground/10">
          <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
            <Icon className="w-4 h-4 text-foreground/20" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-24 rounded bg-foreground/5 mb-2" />
            <div className="h-3 w-40 rounded bg-foreground/5" />
          </div>
        </div>
      )}

      {/* Revealed content */}
      {revealed && (
        <motion.div
          variants={revealAnimation}
          initial="hidden"
          animate="visible"
          className="p-4 rounded-xl border border-foreground/15 bg-foreground/[0.02]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Icon className="w-4 h-4 text-foreground/50" />
            <span className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
              {label}
            </span>
          </div>
          {children}
        </motion.div>
      )}
    </div>
  );
}

function SkillLevelBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    expert: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    advanced: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    intermediate: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    beginner: 'bg-foreground/10 text-foreground/60 border-foreground/20',
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border ${colorMap[level] || colorMap.beginner}`}
    >
      {level}
    </span>
  );
}

export function ProfileReveal({ profileData, revealedFields }: ProfileRevealProps) {
  const t = useTranslations('onboarding');

  const hasIdentity = revealedFields.has('displayName') || revealedFields.has('headline');
  const hasSkills = revealedFields.has('skills') && profileData.skills.length > 0;
  const hasExperience = revealedFields.has('experience') && profileData.experience.length > 0;
  const hasGoals = revealedFields.has('goals');

  return (
    <div className="h-full bg-background p-6 space-y-4 overflow-y-auto">
      <div className="mb-6">
        <h2 className="font-serif text-lg text-foreground/80">{t('profileTitle')}</h2>
        <p className="text-xs text-foreground/40 mt-1">{t('profileSubtitle')}</p>
      </div>

      {/* Identity */}
      <FoggedSection
        revealed={hasIdentity}
        icon={User}
        label={t('profile.identity')}
      >
        {profileData.displayName && (
          <h3 className="text-xl font-semibold text-foreground mb-1">
            {profileData.displayName}
          </h3>
        )}
        {profileData.headline && (
          <p className="text-sm text-foreground/70">{profileData.headline}</p>
        )}
        {profileData.bio && (
          <p className="text-sm text-foreground/60 mt-2">{profileData.bio}</p>
        )}
      </FoggedSection>

      {/* Skills */}
      <FoggedSection
        revealed={hasSkills}
        icon={Code}
        label={t('profile.skills')}
      >
        <div className="flex flex-wrap gap-2">
          {profileData.skills.map((skill, index) => (
            <motion.div
              key={`${skill.name}-${index}`}
              variants={skillAnimation}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-foreground/15 bg-foreground/5"
            >
              <span className="text-sm text-foreground/90">{skill.name}</span>
              <SkillLevelBadge level={skill.level} />
            </motion.div>
          ))}
        </div>
      </FoggedSection>

      {/* Experience */}
      <FoggedSection
        revealed={hasExperience}
        icon={Briefcase}
        label={t('profile.experience')}
      >
        <div className="space-y-3">
          {profileData.experience.map((exp, index) => (
            <motion.div
              key={`${exp.company}-${index}`}
              variants={revealAnimation}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.15 }}
              className="border-l-2 border-foreground/15 pl-3"
            >
              <h4 className="text-sm font-medium text-foreground">{exp.role}</h4>
              <p className="text-xs text-foreground/60">
                {exp.company} {exp.duration ? `- ${exp.duration}` : ''}
              </p>
              {exp.description && (
                <p className="text-xs text-foreground/50 mt-1">{exp.description}</p>
              )}
            </motion.div>
          ))}
        </div>
      </FoggedSection>

      {/* Goals */}
      <FoggedSection
        revealed={hasGoals}
        icon={Target}
        label={t('profile.goals')}
      >
        {profileData.goals?.targetRoles && profileData.goals.targetRoles.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-foreground/50">{t('profile.targetRoles')}</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profileData.goals.targetRoles.map((role) => (
                <span
                  key={role}
                  className="text-xs px-2 py-1 rounded bg-foreground/10 text-foreground/70"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}
        {profileData.goals?.workPreferences &&
          profileData.goals.workPreferences.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-foreground/50">{t('profile.workPreferences')}</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {profileData.goals.workPreferences.map((pref) => (
                  <span
                    key={pref}
                    className="text-xs px-2 py-1 rounded bg-foreground/10 text-foreground/70"
                  >
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}
        {profileData.goals?.interests && profileData.goals.interests.length > 0 && (
          <div>
            <span className="text-xs text-foreground/50">{t('profile.interests')}</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profileData.goals.interests.map((interest) => (
                <span
                  key={interest}
                  className="text-xs px-2 py-1 rounded bg-foreground/10 text-foreground/70"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Fallback if goals has no structured fields */}
        {profileData.goals &&
          !profileData.goals.targetRoles?.length &&
          !profileData.goals.workPreferences?.length &&
          !profileData.goals.interests?.length && (
            <p className="text-sm text-foreground/60">
              {JSON.stringify(profileData.goals)}
            </p>
          )}
      </FoggedSection>
    </div>
  );
}
