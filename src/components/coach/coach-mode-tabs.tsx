'use client';

import { FileText, Mic, MessageSquare, Target } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CoachMode } from '@/types/graph';

interface CoachModeTabsProps {
  mode: CoachMode;
  onModeChange: (mode: CoachMode) => void;
}

const MODES: Array<{ value: CoachMode; label: string; icon: React.ReactNode }> = [
  { value: 'chat', label: 'Chat', icon: <MessageSquare className="size-4" /> },
  {
    value: 'resume-review',
    label: 'Resume Review',
    icon: <FileText className="size-4" />,
  },
  {
    value: 'mock-interview',
    label: 'Mock Interview',
    icon: <Mic className="size-4" />,
  },
  {
    value: 'skill-gaps',
    label: 'Skill Gaps',
    icon: <Target className="size-4" />,
  },
];

export default function CoachModeTabs({ mode, onModeChange }: CoachModeTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(value) => onModeChange(value as CoachMode)}>
      <TabsList className="grid w-full grid-cols-4 gap-1">
        {MODES.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            aria-label={item.label}
            className="flex items-center gap-1.5 text-xs sm:text-sm"
          >
            {item.icon}
            <span className="hidden sm:inline">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
