'use client';

import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, List, Search, MapPin, Sparkles, PenLine, X, Bot } from 'lucide-react';
import KeywordGraph from '@/components/fair/keyword-graph';
import ClusterView from '@/components/fair/cluster-view';
import JobDetailSheet from '@/components/fair/job-detail-sheet';
import GraphSearch from '@/components/fair/graph-search';
import CompanyCard from '@/components/fair/company-card';
import { GraphSkeleton } from '@/components/loading/graph-skeleton';
import { NoMatches } from '@/components/empty-states/no-matches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OPPORTUNITY_TYPE_LABELS, type OpportunityType } from '@/types';
import type { GraphData, ClusterJob } from '@/types/graph';

type FairClientProps = {
  userSkills: string[];
};

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };
const OPP_TYPES = Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[];

const WORK_MODE_OPTIONS = [
  { value: 'remote', label: '远程' },
  { value: 'onsite', label: '现场' },
  { value: 'hybrid', label: '混合' },
];

export function resolveJobSheetKeyword(
  sheetKeyword: string | null,
  activeKeyword: string | null,
  searchKeyword: string | null
): string {
  return sheetKeyword ?? activeKeyword ?? searchKeyword ?? '';
}

export default function FairClient({ userSkills }: FairClientProps) {
  // Search mode: AI or manual
  const [searchMode, setSearchMode] = useState<'ai' | 'manual'>('ai');

  // View mode: graph or list
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');

  // Graph state
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);
  const [sheetKeyword, setSheetKeyword] = useState<string | null>(null);

  // List mode state
  const [allJobs, setAllJobs] = useState<ClusterJob[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // AI search
  const [aiQuery, setAiQuery] = useState('');

  // Manual filters
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterWorkMode, setFilterWorkMode] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<OpportunityType[]>([]);

  // Load graph data
  useEffect(() => {
    const controller = new AbortController();
    async function loadGraph() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/v1/graph', {
          signal: controller.signal,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('加载机会图谱失败');
        const payload = (await response.json()) as GraphData;
        if (!controller.signal.aborted) setGraphData(payload);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadGraph();
    return () => controller.abort();
  }, []);

  // Load all jobs for list mode
  useEffect(() => {
    if (viewMode !== 'list') return;
    if (allJobs.length > 0) return; // already loaded
    const controller = new AbortController();
    async function loadAllJobs() {
      setListLoading(true);
      try {
        const res = await fetch('/api/v1/graph/jobs/all', {
          signal: controller.signal,
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAllJobs(data.jobs || []);
        }
      } catch {
        if (!controller.signal.aborted) setAllJobs([]);
      } finally {
        if (!controller.signal.aborted) setListLoading(false);
      }
    }
    loadAllJobs();
    return () => controller.abort();
  }, [viewMode, allJobs.length]);

  // Filtered jobs for list mode
  const filteredJobs = useMemo(() => {
    let jobs = allJobs;
    const kw = searchMode === 'ai' ? aiQuery.trim().toLowerCase() : filterKeyword.toLowerCase();
    if (kw) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          j.companyName.toLowerCase().includes(kw) ||
          j.skills.some((s) => s.name.toLowerCase().includes(kw))
      );
    }
    if (filterLocation) {
      const loc = filterLocation.toLowerCase();
      jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc));
    }
    if (filterWorkMode.length > 0) {
      jobs = jobs.filter((j) => filterWorkMode.includes(j.workMode));
    }
    return jobs;
  }, [allJobs, searchMode, aiQuery, filterKeyword, filterLocation, filterWorkMode]);

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    // Switch to list mode to show filtered results
    setViewMode('list');
  };

  const clearFilters = () => {
    setFilterKeyword('');
    setFilterLocation('');
    setFilterWorkMode([]);
    setFilterTypes([]);
  };

  const hasActiveFilters = filterKeyword || filterLocation || filterWorkMode.length > 0 || filterTypes.length > 0;

  const graph = graphData ?? EMPTY_GRAPH;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          <GraphSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-10">
        <div className="max-w-xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-100">
          <p className="text-lg font-semibold">无法加载机会市场</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_38%),linear-gradient(180deg,_rgba(6,10,21,0.96),_rgba(9,12,20,0.94))]">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-300/70">
                Opportunity Market
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                机会市场
              </h1>
            </div>

            {/* Search mode toggle */}
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 px-4 ${searchMode === 'ai' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setSearchMode('ai')}
              >
                <Sparkles className="h-4 w-4" />
                AI 搜索
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 px-4 ${searchMode === 'manual' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setSearchMode('manual')}
              >
                <PenLine className="h-4 w-4" />
                手动筛选
              </Button>
            </div>
          </div>

          {/* Search area */}
          <AnimatePresence mode="wait">
            {searchMode === 'ai' ? (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
                        <Bot className="h-4 w-4 text-sky-400" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          用自然语言描述你想找的机会，AI 帮你搜索和匹配。
                        </p>
                        <textarea
                          value={aiQuery}
                          onChange={(e) => setAiQuery(e.target.value)}
                          placeholder="例如：我想找北京的远程 AI 岗位，最好是做 RAG 相关的..."
                          rows={2}
                          className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAiSearch();
                            }
                          }}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={handleAiSearch} disabled={!aiQuery.trim()} className="gap-1.5">
                            <Search className="h-4 w-4" />
                            搜索机会
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                  {/* Keyword */}
                  <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-xs text-muted-foreground">关键词</label>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={filterKeyword}
                        onChange={(e) => setFilterKeyword(e.target.value)}
                        placeholder="职位、公司或技能..."
                        className="h-8 border-white/10 bg-white/5 pl-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-xs text-muted-foreground">地点</label>
                    <div className="relative flex-1">
                      <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        placeholder="城市或地区..."
                        className="h-8 border-white/10 bg-white/5 pl-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Work mode */}
                  <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-xs text-muted-foreground">工作方式</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WORK_MODE_OPTIONS.map((opt) => (
                        <Badge
                          key={opt.value}
                          variant="outline"
                          className={`cursor-pointer select-none text-xs transition-colors ${
                            filterWorkMode.includes(opt.value)
                              ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                              : 'border-white/10 text-muted-foreground hover:border-white/20'
                          }`}
                          onClick={() =>
                            setFilterWorkMode((prev) =>
                              prev.includes(opt.value)
                                ? prev.filter((v) => v !== opt.value)
                                : [...prev, opt.value]
                            )
                          }
                        >
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Opportunity type */}
                  <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-xs text-muted-foreground">类型</label>
                    <div className="flex flex-wrap gap-1.5">
                      {OPP_TYPES.map((type) => {
                        const label = OPPORTUNITY_TYPE_LABELS[type];
                        const active = filterTypes.includes(type);
                        return (
                          <Badge
                            key={type}
                            variant="outline"
                            className={`cursor-pointer select-none text-xs transition-colors ${
                              active
                                ? label.color
                                : 'border-white/10 text-muted-foreground hover:border-white/20'
                            }`}
                            onClick={() =>
                              setFilterTypes((prev) =>
                                prev.includes(type)
                                  ? prev.filter((t) => t !== type)
                                  : [...prev, type]
                              )
                            }
                          >
                            {label.zh}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
                        <X className="h-3 w-3" />
                        清除筛选
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* View mode toggle + content */}
      <div className="relative flex-1 overflow-hidden px-6 py-4">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
          {/* View toggle bar */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 px-3 ${viewMode === 'graph' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('graph')}
              >
                <LayoutGrid className="h-4 w-4" />
                图谱
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 px-3 ${viewMode === 'list' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
                列表
              </Button>
            </div>

            {viewMode === 'graph' && (
              <GraphSearch nodes={graph.nodes} onSearch={setSearchKeyword} />
            )}

            {viewMode === 'list' && (
              <p className="text-xs text-muted-foreground">
                共 {filteredJobs.length} 个机会
              </p>
            )}
          </div>

          {/* Content area */}
          {viewMode === 'graph' ? (
            graph.nodes.length === 0 ? (
              <div className="flex min-h-[480px] items-center justify-center rounded-[28px] border border-white/10 bg-white/5 px-6 text-center">
                <NoMatches />
              </div>
            ) : (
              <div className="relative flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
                <KeywordGraph
                  data={graph}
                  userSkills={userSkills}
                  onKeywordClick={setActiveKeyword}
                  searchKeyword={searchKeyword}
                />
                <AnimatePresence>
                  {activeKeyword ? (
                    <ClusterView
                      keyword={activeKeyword}
                      onBack={() => setActiveKeyword(null)}
                      onJobClick={(jobId) => {
                        setSheetKeyword(activeKeyword);
                        setSelectedJobId(jobId);
                        setSheetOpen(true);
                      }}
                    />
                  ) : null}
                </AnimatePresence>
                <JobDetailSheet
                  jobId={selectedJobId}
                  keyword={resolveJobSheetKeyword(sheetKeyword, activeKeyword, searchKeyword)}
                  open={sheetOpen}
                  onOpenChange={setSheetOpen}
                />
              </div>
            )
          ) : (
            <div className="space-y-4">
              {listLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-xl border border-white/10 bg-white/5" />
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
                  <p className="text-lg font-medium text-foreground">暂无匹配的机会</p>
                  <p className="mt-2 text-sm">试试调整筛选条件或切换到图谱模式探索</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredJobs.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                    >
                      <CompanyCard
                        job={job}
                        onClick={(jobId) => {
                          setSelectedJobId(jobId);
                          setSheetKeyword(null);
                          setSheetOpen(true);
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}

              <JobDetailSheet
                jobId={selectedJobId}
                keyword={resolveJobSheetKeyword(sheetKeyword, activeKeyword, searchKeyword)}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
