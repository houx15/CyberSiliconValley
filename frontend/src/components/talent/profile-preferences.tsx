'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { OPPORTUNITY_TYPE_LABELS, type OpportunityType } from '@/types';

const OPPORTUNITY_TYPES = Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[];

interface ProfilePreferencesProps {
  visible: boolean;
  interestedTypes: OpportunityType[];
}

export function ProfilePreferences({ visible: initialVisible, interestedTypes: initialTypes }: ProfilePreferencesProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [selectedTypes, setSelectedTypes] = useState<OpportunityType[]>(initialTypes);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleVisible = async (checked: boolean) => {
    setVisible(checked);
    await save({ visible: checked });
  };

  const toggleType = async (type: OpportunityType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    await save({ goals: { interestedOpportunityTypes: next } });
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="space-y-4 py-4">
        {/* Visibility toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {visible ? (
              <Eye className="h-4 w-4 text-emerald-400" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <Label htmlFor="visible-toggle" className="text-sm font-medium">
              {visible ? '简历公开中' : '简历未公开'}
            </Label>
          </div>
          <Switch
            id="visible-toggle"
            checked={visible}
            onCheckedChange={toggleVisible}
            disabled={saving}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {visible ? '企业可以在人才市场看到你的简历' : '你的简历对企业不可见'}
        </p>

        {/* Interested opportunity types */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">感兴趣的机会类型</p>
          <div className="flex flex-wrap gap-2">
            {OPPORTUNITY_TYPES.map((type) => {
              const label = OPPORTUNITY_TYPE_LABELS[type];
              const active = selectedTypes.includes(type);
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className={`cursor-pointer select-none transition-colors ${
                    active
                      ? label.color
                      : 'border-border/40 text-muted-foreground hover:border-border'
                  }`}
                  onClick={() => toggleType(type)}
                >
                  {label.zh}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
