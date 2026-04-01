'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  MapPin,
  MessageSquare,
  Search,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';

interface TalentItem {
  id: string;
  name: string;
  title: string;
  location: string;
  skills: string[];
  matchScore: number;
  experience: string;
  status: 'available' | 'pre_chat' | 'contacted';
}

const MOCK_TALENTS: TalentItem[] = [
  {
    id: 't1', name: '张伟', title: '高级后端工程师',
    location: '北京 · 远程优先', skills: ['Go', 'Kubernetes', '分布式系统', 'gRPC'],
    matchScore: 92, experience: '8 年', status: 'available',
  },
  {
    id: 't2', name: '李明', title: 'LLM 应用架构师',
    location: '杭州 · 可远程', skills: ['Python', 'RAG', 'LangChain', '向量数据库'],
    matchScore: 87, experience: '6 年', status: 'pre_chat',
  },
  {
    id: 't3', name: '���芳', title: '全栈工程师',
    location: '上海 · 混合', skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
    matchScore: 81, experience: '5 年', status: 'available',
  },
  {
    id: 't4', name: '陈强', title: 'AI 平台工程师',
    location: '深圳 · 现场', skills: ['Python', 'MLOps', 'Docker', 'PyTorch'],
    matchScore: 78, experience: '4 年', status: 'contacted',
  },
  {
    id: 't5', name: '赵慧', title: '数据工程师',
    location: '成都 · 远程', skills: ['Spark', 'Flink', 'Kafka', 'Python'],
    matchScore: 73, experience: '5 年', status: 'available',
  },
  {
    id: 't6', name: '孙鹏', title: '产品经理（AI 方向）',
    location: '北京 · 混合', skills: ['AI 产品', '用户研究', '数据分析', 'Figma'],
    matchScore: 68, experience: '7 年', status: 'available',
  },
];

const STATUS_CONFIG: Record<TalentItem['status'], { label: string; color: string }> = {
  available: { label: '可沟通', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  pre_chat: { label: '预沟通中', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  contacted: { label: '已联系', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
};

export function TalentMarketList() {
  const [search, setSearch] = useState('');

  const filtered = MOCK_TALENTS.filter(
    (t) =>
      !search ||
      t.name.includes(search) ||
      t.title.includes(search) ||
      t.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索人才：姓名、方向或技能..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        共 {filtered.length} 位人才
      </p>

      {/* Talent list */}
      <div className="space-y-3">
        {filtered.map((talent, i) => {
          const statusCfg = STATUS_CONFIG[talent.status];
          return (
            <motion.div
              key={talent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="border-border/50 bg-card/80 transition-colors hover:bg-card">
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{talent.name}</span>
                      <span className="text-xs text-muted-foreground">{talent.title}</span>
                      <span className="text-xs text-muted-foreground">· {talent.experience}经验</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {talent.location}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {talent.skills.slice(0, 4).map((skill) => (
                          <Badge key={skill} variant="outline" className="border-border/40 px-1.5 py-0 text-[10px] text-muted-foreground">
                            {skill}
                          </Badge>
                        ))}
                        {talent.skills.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{talent.skills.length - 4}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Match score */}
                  <div className="text-center">
                    <p className={`text-lg font-bold ${
                      talent.matchScore >= 80
                        ? 'text-emerald-400'
                        : talent.matchScore >= 70
                          ? 'text-amber-400'
                          : 'text-muted-foreground'
                    }`}>
                      {talent.matchScore}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">匹配</p>
                  </div>

                  {/* Status */}
                  <Badge variant="outline" className={`shrink-0 text-[11px] ${statusCfg.color}`}>
                    {statusCfg.label}
                  </Badge>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1.5">
                    {talent.status === 'available' && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        <MessageSquare className="h-3 w-3" />
                        预沟通
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1 text-xs">
                      详情
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
