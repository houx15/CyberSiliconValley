'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles, Brain, Target, MessageCircle } from 'lucide-react';

interface Coach {
  id: string;
  name: string;
  specialty: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

const COACHES: Coach[] = [
  {
    id: 'general',
    name: '全能教练',
    specialty: '职业规划 · 简历优化 · 面试准备',
    description: '你的全方位 AI 职业顾问。无论是方向选择、简历打磨、面试模拟还是技能提升，都可以找我聊。',
    icon: Sparkles,
    gradient: 'from-purple-500/20 to-blue-500/20',
  },
  {
    id: 'technical',
    name: '技术教练',
    specialty: '系统设计 · 算法 · 技术深度',
    description: '专注技术面的职业发展。帮你拆解系统设计题、梳理技术栈、定位技术方向。',
    icon: Brain,
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    id: 'strategy',
    name: '求职策略师',
    specialty: '市场定位 · 薪资谈判 · Offer 决策',
    description: '从市场数据出发，帮你找准定位、优化投递策略、做出最优 Offer 选择。',
    icon: Target,
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
  {
    id: 'behavioral',
    name: '沟通教练',
    specialty: '行为面试 · 故事打磨 · 表达训练',
    description: '用 STAR 法则打磨你的职业故事，训练你在行为面试中的表达力和说服力。',
    icon: MessageCircle,
    gradient: 'from-rose-500/20 to-pink-500/20',
  },
];

interface CoachSelectorProps {
  selectedId: string;
  onSelect: (coachId: string) => void;
}

function CoachCard({ coach, isSelected, onSelect }: { coach: Coach; isSelected: boolean; onSelect: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const Icon = coach.icon;

  return (
    <div
      className="perspective-1000 h-44 cursor-pointer"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => !isSelected && setIsFlipped(false)}
      onClick={onSelect}
    >
      <motion.div
        className="relative h-full w-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl border px-4 py-5 backface-hidden',
            'bg-gradient-to-br',
            coach.gradient,
            isSelected
              ? 'border-primary/50 ring-1 ring-primary/30'
              : 'border-border/50'
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background/60">
              <Icon className="h-6 w-6 text-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">{coach.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{coach.specialty}</p>
          </div>
        </div>

        {/* Back */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl border px-4 py-5',
            'bg-gradient-to-br',
            coach.gradient,
            isSelected
              ? 'border-primary/50 ring-1 ring-primary/30'
              : 'border-border/50'
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex h-full flex-col justify-between">
            <p className="text-xs leading-relaxed text-foreground/80">{coach.description}</p>
            <div className="mt-2 text-center">
              <span
                className={cn(
                  'inline-block rounded-full px-3 py-1 text-xs font-medium',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/60 text-foreground'
                )}
              >
                {isSelected ? '已选择' : '选择'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CoachSelector({ selectedId, onSelect }: CoachSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {COACHES.map((coach) => (
        <CoachCard
          key={coach.id}
          coach={coach}
          isSelected={selectedId === coach.id}
          onSelect={() => onSelect(coach.id)}
        />
      ))}
    </div>
  );
}
