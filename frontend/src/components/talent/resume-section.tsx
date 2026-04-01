'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumeView } from './resume-view';
import { ResumeEditor } from './resume-editor';
import type { Skill, Experience, Availability } from '@/types';

interface ResumeSectionProps {
  profile: {
    displayName: string;
    headline: string;
    bio: string;
    skills: Skill[];
    experience: Experience[];
    education: Array<{ institution: string; degree: string; field: string; year: string }>;
    goals: { targetRoles?: string[]; workPreferences?: string[] };
    availability: Availability;
    salaryRange: { min?: number; max?: number; currency?: string };
  };
}

export function ResumeSection({ profile }: ResumeSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {editing ? '编辑简历' : '我的简历'}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(!editing)}
          className="gap-1.5"
        >
          {editing ? (
            <>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回查看
            </>
          ) : (
            <>
              <PenLine className="h-3.5 w-3.5" />
              编辑
            </>
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ResumeEditor profile={profile} />
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ResumeView profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
