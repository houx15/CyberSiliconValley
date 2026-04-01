'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SkillEntry {
  name: string;
  level: string;
  required: boolean;
}

interface StructuredJobData {
  title: string;
  description: string;
  skills: SkillEntry[];
  seniority: string;
  timeline: string;
  deliverables: string[];
  budget: { min?: number; max?: number; currency: string };
  workMode: 'remote' | 'onsite' | 'hybrid';
}

interface JdEditorProps {
  data: StructuredJobData;
  onUpdate: (data: StructuredJobData) => void;
}

const seniorityOptions = ['Junior', 'Mid', 'Senior', 'Lead'];
const workModeOptions: Array<{ value: 'remote' | 'onsite' | 'hybrid'; label: string }> = [
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
];

export function JdEditor({ data, onUpdate }: JdEditorProps) {
  const router = useRouter();
  const [job, setJob] = useState<StructuredJobData>(data);
  const [publishing, setPublishing] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  function update(partial: Partial<StructuredJobData>) {
    const next = { ...job, ...partial };
    setJob(next);
    onUpdate(next);
  }

  function toggleSkillRequired(index: number) {
    const skills = [...job.skills];
    const current = skills[index];
    if (current) {
      skills[index] = { ...current, required: !current.required };
      update({ skills });
    }
  }

  function removeSkill(index: number) {
    const skills = job.skills.filter((_, i) => i !== index);
    update({ skills });
  }

  function addSkill() {
    if (!newSkill.trim()) return;
    const skills = [...job.skills, { name: newSkill.trim(), level: 'intermediate', required: true }];
    update({ skills });
    setNewSkill('');
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: job.title,
          description: job.description,
          structured: {
            skills: job.skills,
            seniority: job.seniority,
            timeline: job.timeline,
            deliverables: job.deliverables,
            budget: job.budget,
            workMode: job.workMode,
          },
          autoMatch: true,
          autoPrechat: false,
        }),
      });

      if (res.ok) {
        router.push('/enterprise/dashboard');
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Structured Job Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Title</label>
          <Input
            value={job.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Senior ML Engineer"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <textarea
            value={job.description}
            onChange={(e) => update({ description: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
          />
        </div>

        {/* Skills */}
        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Skills</label>
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill, i) => (
              <Badge
                key={`${skill.name}-${i}`}
                variant={skill.required ? 'default' : 'outline'}
                className="cursor-pointer gap-1 pr-1"
                onClick={() => toggleSkillRequired(i)}
              >
                {skill.name}
                <span className="ml-1 text-[10px] opacity-60">
                  {skill.required ? 'must' : 'nice'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSkill(i);
                  }}
                  className="ml-1 rounded-full px-1 text-xs hover:bg-background/20"
                >
                  x
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add skill..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button variant="outline" size="sm" onClick={addSkill} className="h-8">
              Add
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Click a skill to toggle must-have / nice-to-have
          </p>
        </div>

        {/* Seniority + Work Mode row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Seniority</label>
            <div className="flex gap-2">
              {seniorityOptions.map((opt) => (
                <Button
                  key={opt}
                  variant={job.seniority === opt ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => update({ seniority: opt })}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Work Mode</label>
            <div className="flex gap-2">
              {workModeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={job.workMode === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => update({ workMode: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Timeline</label>
          <Input
            value={job.timeline}
            onChange={(e) => update({ timeline: e.target.value })}
            placeholder="e.g. ASAP, 6 months"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Budget Range</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={job.budget.min ?? ''}
              onChange={(e) =>
                update({
                  budget: { ...job.budget, min: e.target.value ? Number(e.target.value) : undefined },
                })
              }
              placeholder="Min"
              className="h-8 w-28 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number"
              value={job.budget.max ?? ''}
              onChange={(e) =>
                update({
                  budget: { ...job.budget, max: e.target.value ? Number(e.target.value) : undefined },
                })
              }
              placeholder="Max"
              className="h-8 w-28 text-xs"
            />
            <Input
              value={job.budget.currency}
              onChange={(e) => update({ budget: { ...job.budget, currency: e.target.value } })}
              className="h-8 w-20 text-xs"
              placeholder="USD"
            />
          </div>
        </div>

        {/* Deliverables */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Deliverables</label>
          <div className="space-y-1">
            {job.deliverables.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  value={d}
                  onChange={(e) => {
                    const deliverables = [...job.deliverables];
                    deliverables[i] = e.target.value;
                    update({ deliverables });
                  }}
                  className="h-7 flex-1 text-xs"
                />
                <button
                  onClick={() => {
                    const deliverables = job.deliverables.filter((_, idx) => idx !== i);
                    update({ deliverables });
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  x
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => update({ deliverables: [...job.deliverables, ''] })}
            >
              + Add deliverable
            </Button>
          </div>
        </div>

        {/* Publish */}
        <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing || !job.title.trim()}>
            {publishing ? 'Publishing...' : 'Publish Job'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
