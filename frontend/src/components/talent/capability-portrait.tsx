'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { Skill } from '@/types';

interface CapabilityPortraitProps {
  skills: Skill[];
}

const LEVEL_STYLES: Record<Skill['level'], string> = {
  expert: 'bg-primary/90 text-primary-foreground',
  advanced: 'bg-primary/70 text-primary-foreground',
  intermediate: 'bg-primary/50 text-primary-foreground',
  beginner: 'bg-primary/30 text-primary-foreground/80',
};

const LEVEL_LABELS: Record<Skill['level'], string> = {
  expert: 'Expert',
  advanced: 'Advanced',
  intermediate: 'Intermediate',
  beginner: 'Beginner',
};

function groupSkillsByCategory(skills: Skill[]): Record<string, Skill[]> {
  const groups: Record<string, Skill[]> = {};
  for (const skill of skills) {
    const cat = skill.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(skill);
  }
  return groups;
}

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
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
};

const tagVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
};

export function CapabilityPortrait({ skills }: CapabilityPortraitProps) {
  const t = useTranslations('talentHome');

  if (!skills || skills.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('noSkills')}</p>
      </div>
    );
  }

  const groups = groupSkillsByCategory(skills);
  const categories = Object.entries(groups).sort(
    ([, a], [, b]) => b.length - a.length
  );

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {categories.map(([category, catSkills]) => (
        <motion.div
          key={category}
          variants={clusterVariants}
          className="rounded-lg border border-border/50 p-4"
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h3>
          <motion.div
            className="flex flex-wrap gap-2"
            variants={containerVariants}
          >
            {catSkills.map((skill) => (
              <motion.span
                key={skill.name}
                variants={tagVariants}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${LEVEL_STYLES[skill.level]}`}
                title={`${skill.name} — ${LEVEL_LABELS[skill.level]}`}
              >
                {skill.name}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}
