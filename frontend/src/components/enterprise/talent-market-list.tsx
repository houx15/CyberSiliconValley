'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  PenLine,
  Bot,
  X,
  Briefcase,
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

interface JobOption {
  id: string;
  title: string;
}

const FALLBACK_TALENTS: TalentItem[] = [
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
    id: 't3', name: '王芳', title: '全栈工程师',
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
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [search, setSearch] = useState('');

  // AI mode
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearched, setAiSearched] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  // Manual filters
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [talents, setTalents] = useState<TalentItem[]>(FALLBACK_TALENTS);

  // Load talent market data
  useEffect(() => {
    fetch('/api/v1/talent-market', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.talents?.length > 0) setTalents(data.talents); })
      .catch(() => {});
  }, []);

  // Load enterprise jobs for the selector
  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch('/api/v1/jobs', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setJobs(
            (data.jobs || [])
              .filter((j: { status: string }) => j.status === 'open')
              .map((j: { id: string; title: string }) => ({ id: j.id, title: j.title || '未命名' }))
          );
        }
      } catch { /* ignore */ }
    }
    loadJobs();
  }, []);

  const filtered = useMemo(() => {
    let result = talents;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (mode === 'manual') {
      if (filterLocation) {
        const loc = filterLocation.toLowerCase();
        result = result.filter((t) => t.location.toLowerCase().includes(loc));
      }
      if (filterSkill) {
        const sk = filterSkill.toLowerCase();
        result = result.filter((t) => t.skills.some((s) => s.toLowerCase().includes(sk)));
      }
      if (filterStatus.length > 0) {
        result = result.filter((t) => filterStatus.includes(t.status));
      }
    }

    return result;
  }, [talents, search, mode, filterLocation, filterSkill, filterStatus]);

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    setSearch(aiQuery.trim());
    setAiSearched(true);
  };

  const handleJobSelect = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(jobId);
      setAiQuery(`帮我找适合「${job.title}」这个职位的人才`);
      setSearch(job.title);
      setAiSearched(true);
    }
  };

  const clearManualFilters = () => {
    setFilterLocation('');
    setFilterSkill('');
    setFilterStatus([]);
  };

  const hasManualFilters = filterLocation || filterSkill || filterStatus.length > 0;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-border/50 bg-card/50 p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 px-4 ${mode === 'ai' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMode('ai')}
          >
            <Sparkles className="h-4 w-4" />
            AI 模式
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 px-4 ${mode === 'manual' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMode('manual')}
          >
            <PenLine className="h-4 w-4" />
            手动筛选
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'ai' ? (
          <motion.div
            key="ai-search"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* AI search area */}
            <Card className="border-border/50 bg-card/80">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      描述你需要的人才，我会帮你在人才库中搜索匹配的候选人。
                    </p>
                    <textarea
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      placeholder="例如：我需要一个有 3 年以上经验的 Python 后端工程师，熟悉分布式系统，最好在北京..."
                      rows={3}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAiSearch();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <Button size="sm" onClick={handleAiSearch} disabled={!aiQuery.trim()} className="gap-1.5">
                        <Search className="h-4 w-4" />
                        搜索人才
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Job selector - select a job to search based on */}
                {jobs.length > 0 && (
                  <div className="border-t border-border/30 pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      <Briefcase className="mr-1 inline h-3 w-3" />
                      或选择一个已发布的职位，基于该职位搜索人才：
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {jobs.map((job) => (
                        <Badge
                          key={job.id}
                          variant="outline"
                          className={`cursor-pointer select-none text-xs transition-colors ${
                            selectedJob === job.id
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border/40 text-muted-foreground hover:border-border'
                          }`}
                          onClick={() => handleJobSelect(job.id)}
                        >
                          {job.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="manual-search"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Keyword search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索人才：姓名、方向或技能..."
                className="pl-9"
              />
            </div>

            {/* Expanded filters (default open in manual mode) */}
            <div className="space-y-3 rounded-lg border border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-3">
                <label className="w-16 shrink-0 text-xs text-muted-foreground">地点</label>
                <div className="relative flex-1">
                  <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="城市或地区..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="w-16 shrink-0 text-xs text-muted-foreground">技能</label>
                <Input
                  value={filterSkill}
                  onChange={(e) => setFilterSkill(e.target.value)}
                  placeholder="筛选特定技能..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="w-16 shrink-0 text-xs text-muted-foreground">状态</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(STATUS_CONFIG) as [string, { label: string; color: string }][]).map(([key, cfg]) => (
                    <Badge
                      key={key}
                      variant="outline"
                      className={`cursor-pointer select-none text-xs transition-colors ${
                        filterStatus.includes(key) ? cfg.color : 'border-border/40 text-muted-foreground'
                      }`}
                      onClick={() =>
                        setFilterStatus((prev) =>
                          prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                        )
                      }
                    >
                      {cfg.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {hasManualFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearManualFilters}>
                    <X className="h-3 w-3" />
                    清除筛选
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {(mode === 'manual' || aiSearched) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground">
            共 {filtered.length} 位人才
          </p>

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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>

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

                    <Badge variant="outline" className={`shrink-0 text-[11px] ${statusCfg.color}`}>
                      {statusCfg.label}
                    </Badge>

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
        </motion.div>
      )}
    </div>
  );
}
