'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Skill, Experience, Availability } from '@/types';
import { X, Plus } from 'lucide-react';

interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

interface Goals {
  targetRoles?: string[];
  workPreferences?: string[];
}

interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
}

interface ProfileData {
  displayName: string;
  headline: string;
  bio: string;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  goals: Goals;
  availability: Availability;
  salaryRange: SalaryRange;
}

interface ProfileEditorProps {
  initial: ProfileData;
}

export function ProfileEditor({ initial }: ProfileEditorProps) {
  const t = useTranslations('profileEditor');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(initial.displayName || '');
  const [headline, setHeadline] = useState(initial.headline || '');
  const [bio, setBio] = useState(initial.bio || '');
  const [availability, setAvailability] = useState<Availability>(initial.availability || 'open');
  const [skills, setSkills] = useState<Skill[]>(initial.skills || []);
  const [experience, setExperience] = useState<Experience[]>(initial.experience || []);
  const [education, setEducation] = useState<Education[]>(initial.education || []);
  const [goals, setGoals] = useState<Goals>(initial.goals || {});
  const [salaryRange, setSalaryRange] = useState<SalaryRange>(initial.salaryRange || {});

  // Skill add form
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<Skill['level']>('intermediate');
  const [newSkillCategory, setNewSkillCategory] = useState('');

  // Experience add form
  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState<Experience>({ company: '', role: '', duration: '', description: '' });

  // Education add form
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<Education>({ institution: '', degree: '', field: '', year: '' });

  // Goals form
  const [newTargetRole, setNewTargetRole] = useState('');
  const [newWorkPref, setNewWorkPref] = useState('');

  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function addSkill() {
    if (!newSkillName.trim() || !newSkillCategory.trim()) return;
    setSkills([...skills, { name: newSkillName.trim(), level: newSkillLevel, category: newSkillCategory.trim() }]);
    setNewSkillName('');
    setNewSkillCategory('');
  }

  function removeSkill(index: number) {
    setSkills(skills.filter((_, i) => i !== index));
  }

  function addExperience() {
    if (!newExp.company.trim() || !newExp.role.trim()) return;
    setExperience([newExp, ...experience]);
    setNewExp({ company: '', role: '', duration: '', description: '' });
    setShowAddExp(false);
  }

  function removeExperience(index: number) {
    setExperience(experience.filter((_, i) => i !== index));
  }

  function addEducation() {
    if (!newEdu.institution.trim() || !newEdu.degree.trim()) return;
    setEducation([newEdu, ...education]);
    setNewEdu({ institution: '', degree: '', field: '', year: '' });
    setShowAddEdu(false);
  }

  function removeEducation(index: number) {
    setEducation(education.filter((_, i) => i !== index));
  }

  function addTargetRole() {
    if (!newTargetRole.trim()) return;
    setGoals({ ...goals, targetRoles: [...(goals.targetRoles || []), newTargetRole.trim()] });
    setNewTargetRole('');
  }

  function removeTargetRole(index: number) {
    setGoals({ ...goals, targetRoles: (goals.targetRoles || []).filter((_, i) => i !== index) });
  }

  function addWorkPref() {
    if (!newWorkPref.trim()) return;
    setGoals({ ...goals, workPreferences: [...(goals.workPreferences || []), newWorkPref.trim()] });
    setNewWorkPref('');
  }

  function removeWorkPref(index: number) {
    setGoals({ ...goals, workPreferences: (goals.workPreferences || []).filter((_, i) => i !== index) });
  }

  async function handleSave() {
    setError('');
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            headline,
            bio,
            skills,
            experience,
            education,
            goals,
            availability,
            salaryRange,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || 'Failed to save');
          return;
        }

        setSaved(true);
        router.refresh();
      } catch {
        setError('Failed to save profile');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('displayName')}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('displayNamePlaceholder')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('headline')}</label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t('headlinePlaceholder')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('bio')}</label>
            <textarea
              className="h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bioPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('availability')}</label>
            <div className="flex gap-2">
              {(['open', 'busy', 'not_looking'] as Availability[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAvailability(a)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    availability === a
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t(`availability_${a}`)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>{t('skills')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, i) => (
              <Badge key={`${skill.name}-${i}`} variant="secondary" className="gap-1">
                {skill.name}
                <span className="text-[10px] opacity-60">({skill.level})</span>
                <button onClick={() => removeSkill(i)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-32"
              placeholder={t('skillName')}
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            />
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(e.target.value as Skill['level'])}
            >
              <option value="beginner">{t('levelBeginner')}</option>
              <option value="intermediate">{t('levelIntermediate')}</option>
              <option value="advanced">{t('levelAdvanced')}</option>
              <option value="expert">{t('levelExpert')}</option>
            </select>
            <Input
              className="w-32"
              placeholder={t('skillCategory')}
              value={newSkillCategory}
              onChange={(e) => setNewSkillCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            />
            <Button variant="outline" size="sm" onClick={addSkill}>
              <Plus className="h-3 w-3" /> {t('add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('experience')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddExp(!showAddExp)}>
            <Plus className="h-3 w-3" /> {t('add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddExp && (
            <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t('role')} value={newExp.role} onChange={(e) => setNewExp({ ...newExp, role: e.target.value })} />
                <Input placeholder={t('company')} value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} />
              </div>
              <Input placeholder={t('duration')} value={newExp.duration} onChange={(e) => setNewExp({ ...newExp, duration: e.target.value })} />
              <textarea
                className="h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring dark:bg-input/30"
                placeholder={t('description')}
                value={newExp.description}
                onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addExperience}>{t('add')}</Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddExp(false)}>{t('cancel')}</Button>
              </div>
            </div>
          )}
          {experience.map((exp, i) => (
            <div key={`${exp.company}-${i}`} className="flex items-start justify-between rounded-lg border border-border/50 p-3">
              <div>
                <p className="text-sm font-medium">{exp.role}</p>
                <p className="text-xs text-muted-foreground">{exp.company} {exp.duration && `· ${exp.duration}`}</p>
                {exp.description && <p className="mt-1 text-xs text-muted-foreground/70">{exp.description}</p>}
              </div>
              <button onClick={() => removeExperience(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('education')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddEdu(!showAddEdu)}>
            <Plus className="h-3 w-3" /> {t('add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddEdu && (
            <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t('institution')} value={newEdu.institution} onChange={(e) => setNewEdu({ ...newEdu, institution: e.target.value })} />
                <Input placeholder={t('degree')} value={newEdu.degree} onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t('field')} value={newEdu.field} onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })} />
                <Input placeholder={t('year')} value={newEdu.year} onChange={(e) => setNewEdu({ ...newEdu, year: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addEducation}>{t('add')}</Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddEdu(false)}>{t('cancel')}</Button>
              </div>
            </div>
          )}
          {education.map((edu, i) => (
            <div key={`${edu.institution}-${i}`} className="flex items-start justify-between rounded-lg border border-border/50 p-3">
              <div>
                <p className="text-sm font-medium">{edu.degree} in {edu.field}</p>
                <p className="text-xs text-muted-foreground">{edu.institution} {edu.year && `· ${edu.year}`}</p>
              </div>
              <button onClick={() => removeEducation(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle>{t('goals')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('targetRoles')}</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {(goals.targetRoles || []).map((role, i) => (
                <Badge key={`${role}-${i}`} variant="secondary" className="gap-1">
                  {role}
                  <button onClick={() => removeTargetRole(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="w-48"
                placeholder={t('targetRolePlaceholder')}
                value={newTargetRole}
                onChange={(e) => setNewTargetRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTargetRole()}
              />
              <Button variant="outline" size="sm" onClick={addTargetRole}>
                <Plus className="h-3 w-3" /> {t('add')}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('workPreferences')}</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {(goals.workPreferences || []).map((pref, i) => (
                <Badge key={`${pref}-${i}`} variant="secondary" className="gap-1">
                  {pref}
                  <button onClick={() => removeWorkPref(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="w-48"
                placeholder={t('workPrefPlaceholder')}
                value={newWorkPref}
                onChange={(e) => setNewWorkPref(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWorkPref()}
              />
              <Button variant="outline" size="sm" onClick={addWorkPref}>
                <Plus className="h-3 w-3" /> {t('add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary Range */}
      <Card>
        <CardHeader>
          <CardTitle>{t('salaryRange')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              className="w-28"
              placeholder={t('min')}
              value={salaryRange.min ?? ''}
              onChange={(e) => setSalaryRange({ ...salaryRange, min: e.target.value ? Number(e.target.value) : undefined })}
            />
            <span className="text-sm text-muted-foreground">—</span>
            <Input
              type="number"
              className="w-28"
              placeholder={t('max')}
              value={salaryRange.max ?? ''}
              onChange={(e) => setSalaryRange({ ...salaryRange, max: e.target.value ? Number(e.target.value) : undefined })}
            />
            <Input
              className="w-20"
              placeholder="USD"
              value={salaryRange.currency ?? ''}
              onChange={(e) => setSalaryRange({ ...salaryRange, currency: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
        {saved && <span className="text-sm text-emerald-600">{t('saved')}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
