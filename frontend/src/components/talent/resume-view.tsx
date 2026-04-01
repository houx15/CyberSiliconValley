'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, GraduationCap, Target, MapPin } from 'lucide-react';
import type { Skill, Experience, Availability } from '@/types';

interface ResumeViewProps {
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

export function ResumeView({ profile }: ResumeViewProps) {
  return (
    <div className="space-y-5">
      {/* Bio */}
      {profile.bio && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="py-4">
            <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">技能</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <Badge
                key={skill.name}
                variant="secondary"
                className="px-3 py-1 text-xs"
              >
                {skill.name}
                {skill.level && (
                  <span className="ml-1 text-muted-foreground">· {skill.level}</span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {profile.experience.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            工作经历
          </h3>
          <div className="space-y-3">
            {profile.experience.map((exp, i) => (
              <Card key={i} className="border-border/30 bg-card/60">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{exp.role}</p>
                      <p className="text-xs text-muted-foreground">{exp.company}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/70">{exp.duration}</span>
                  </div>
                  {exp.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-foreground/70">{exp.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {profile.education.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            教育背景
          </h3>
          <div className="space-y-2">
            {profile.education.map((edu, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/60 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{edu.institution}</p>
                  <p className="text-xs text-muted-foreground">{edu.degree} · {edu.field}</p>
                </div>
                <span className="text-xs text-muted-foreground/70">{edu.year}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Goals & Preferences */}
      {(profile.goals.targetRoles?.length || profile.goals.workPreferences?.length) ? (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target className="h-4 w-4 text-muted-foreground" />
            求职意向
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.goals.targetRoles?.map((role) => (
              <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
            ))}
            {profile.goals.workPreferences?.map((pref) => (
              <Badge key={pref} variant="outline" className="text-xs">
                <MapPin className="mr-1 h-3 w-3" />{pref}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Salary */}
      {(profile.salaryRange.min || profile.salaryRange.max) && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">期望薪资</h3>
          <p className="text-sm text-muted-foreground">
            {profile.salaryRange.min && profile.salaryRange.max
              ? `${profile.salaryRange.min}–${profile.salaryRange.max} ${profile.salaryRange.currency || 'CNY'}`
              : profile.salaryRange.min
                ? `${profile.salaryRange.min}+ ${profile.salaryRange.currency || 'CNY'}`
                : `≤${profile.salaryRange.max} ${profile.salaryRange.currency || 'CNY'}`
            }
          </p>
        </section>
      )}
    </div>
  );
}
