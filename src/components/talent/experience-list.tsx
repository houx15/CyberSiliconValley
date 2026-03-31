'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Experience } from '@/types';

interface ExperienceListProps {
  experience: Experience[];
}

export function ExperienceList({ experience }: ExperienceListProps) {
  const t = useTranslations('talentHome');

  if (!experience || experience.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('noExperience')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {experience.map((exp, i) => (
        <Card key={`${exp.company}-${exp.role}-${i}`} size="sm">
          <CardHeader>
            <CardTitle>{exp.role}</CardTitle>
            <CardDescription>
              {exp.company}
              {exp.duration && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  {exp.duration}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          {exp.description && (
            <CardContent>
              <p className="text-sm text-muted-foreground">{exp.description}</p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
