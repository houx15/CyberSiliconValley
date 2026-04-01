'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OPPORTUNITY_TYPE_LABELS, type OpportunityType } from '@/types';

const OPP_TYPES = Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[];

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
  location?: string;
  focusCategory?: OpportunityType;
}

interface JdEditorProps {
  data: StructuredJobData;
  onUpdate: (data: StructuredJobData) => void;
}

const seniorityOptions = [
  { value: 'Junior', label: '初级' },
  { value: 'Mid', label: '中级' },
  { value: 'Senior', label: '高级' },
  { value: 'Lead', label: '负责人' },
];
const workModeOptions: Array<{ value: 'remote' | 'onsite' | 'hybrid'; label: string }> = [
  { value: 'remote', label: '远程' },
  { value: 'onsite', label: '现场' },
  { value: 'hybrid', label: '混合' },
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
        credentials: 'include',
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
            location: job.location || undefined,
            focusCategory: job.focusCategory || undefined,
          },
          autoMatch: true,
          autoPrechat: false,
        }),
      });

      if (res.ok) {
        router.push('/enterprise/jobs');
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">机会详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">标题</label>
          <Input
            value={job.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="例如：高级 ML 工程师"
          />
        </div>

        {/* Opportunity Type */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">机会类型</label>
          <div className="flex flex-wrap gap-2">
            {OPP_TYPES.map((type) => {
              const label = OPPORTUNITY_TYPE_LABELS[type];
              return (
                <Button
                  key={type}
                  variant={job.focusCategory === type ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${job.focusCategory === type ? '' : label.color}`}
                  onClick={() => update({ focusCategory: type })}
                >
                  {label.zh}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">地点</label>
          <Input
            value={job.location ?? ''}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="例如：北京、远程"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">描述</label>
          <textarea
            value={job.description}
            onChange={(e) => update({ description: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
            placeholder="详细描述这个机会的职责和要求..."
          />
        </div>

        {/* Skills */}
        <div>
          <label className="mb-2 block text-xs text-muted-foreground">技能要求</label>
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
                  {skill.required ? '必须' : '加分'}
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
              placeholder="添加技能..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button variant="outline" size="sm" onClick={addSkill} className="h-8">
              添加
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            点击技能切换「必须」/「加分」
          </p>
        </div>

        {/* Seniority + Work Mode row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">资历要求</label>
            <div className="flex gap-2">
              {seniorityOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={job.seniority === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => update({ seniority: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">工作方式</label>
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
          <label className="mb-1 block text-xs text-muted-foreground">时间线</label>
          <Input
            value={job.timeline}
            onChange={(e) => update({ timeline: e.target.value })}
            placeholder="例如：立即、6 个月"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">薪资/预算范围</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={job.budget.min ?? ''}
              onChange={(e) =>
                update({
                  budget: { ...job.budget, min: e.target.value ? Number(e.target.value) : undefined },
                })
              }
              placeholder="最低"
              className="h-8 w-28 text-xs"
            />
            <span className="text-xs text-muted-foreground">至</span>
            <Input
              type="number"
              value={job.budget.max ?? ''}
              onChange={(e) =>
                update({
                  budget: { ...job.budget, max: e.target.value ? Number(e.target.value) : undefined },
                })
              }
              placeholder="最高"
              className="h-8 w-28 text-xs"
            />
            <Input
              value={job.budget.currency}
              onChange={(e) => update({ budget: { ...job.budget, currency: e.target.value } })}
              className="h-8 w-20 text-xs"
              placeholder="CNY"
            />
          </div>
        </div>

        {/* Deliverables */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">交付物</label>
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
              + 添加交付物
            </Button>
          </div>
        </div>

        {/* Publish */}
        <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button onClick={handlePublish} disabled={publishing || !job.title.trim()}>
            {publishing ? '发布中...' : '发布机会'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
