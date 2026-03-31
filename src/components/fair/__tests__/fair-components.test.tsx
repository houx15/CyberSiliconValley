import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CompanyCard from '../company-card';
import JobDetailSheet, { JobDetailContent, JobDetailErrorState } from '../job-detail-sheet';
import GraphSearch, { getKeywordSuggestions, shouldClearSearch } from '../graph-search';
import type { ClusterJob, GraphNode, JobDetail } from '@/types/graph';

describe('fair components', () => {
  it('renders company card fields and score badges', () => {
    const job: ClusterJob = {
      id: 'job-1',
      title: 'Senior RAG Engineer',
      companyName: 'Aperture AI',
      location: 'San Francisco',
      workMode: 'Hybrid',
      matchScore: 87,
      skills: [
        { name: 'RAG Pipeline', level: 'expert', required: true },
        { name: 'TypeScript', level: 'advanced', required: false },
        { name: 'Postgres', level: 'advanced', required: false },
        { name: 'D3', level: 'intermediate', required: false },
        { name: 'React', level: 'advanced', required: false },
      ],
    };

    const markup = renderToStaticMarkup(<CompanyCard job={job} onClick={() => undefined} />);

    expect(markup).toContain('Aperture AI');
    expect(markup).toContain('Senior RAG Engineer');
    expect(markup).toContain('87%');
    expect(markup).toContain('RAG Pipeline');
    expect(markup).toContain('+1');
  });

  it('ranks graph keyword suggestions by query match and job count', () => {
    const nodes: GraphNode[] = [
      { id: '1', keyword: 'Agent Orchestration', jobCount: 3, trending: false },
      { id: '2', keyword: 'RAG Pipeline', jobCount: 12, trending: true },
      { id: '3', keyword: 'React', jobCount: 7, trending: false },
    ];

    expect(getKeywordSuggestions(nodes, 'rag')).toEqual([
      { id: '2', keyword: 'RAG Pipeline', jobCount: 12, trending: true },
    ]);
    expect(getKeywordSuggestions(nodes, '')).toEqual([]);
    expect(shouldClearSearch('   ')).toBe(true);
    expect(shouldClearSearch('rag')).toBe(false);
  });

  it('renders job detail content with the key metadata sections', () => {
    const detail: JobDetail = {
      id: 'job-1',
      title: 'AI Platform Lead',
      companyName: 'Northstar Labs',
      location: 'Remote',
      workMode: 'Remote',
      matchScore: 91,
      skills: [
        { name: 'LangGraph', level: 'advanced', required: true },
        { name: 'TypeScript', level: 'advanced', required: false },
      ],
      description: 'Own the platform roadmap.',
      seniority: 'Senior',
      budgetRange: '$180k-$220k',
      timeline: 'Q2 2026',
      deliverables: 'Platform launch',
      matchBreakdown: { skills: 94, goals: 88 },
      aiReasoning: 'Strong orchestration fit.',
    };

    const markup = renderToStaticMarkup(
      <JobDetailContent detail={detail} keyword="RAG" />
    );

    expect(markup).toContain('AI Platform Lead');
    expect(markup).toContain('91%');
    expect(markup).toContain('LangGraph');
    expect(markup).toContain('Strong orchestration fit.');
    expect(markup).toContain('Apply');
  });

  it('renders a distinct job detail error state', () => {
    const markup = renderToStaticMarkup(
      <JobDetailErrorState error="Network failed" onRetry={() => undefined} />
    );

    expect(markup).toContain('Unable to load job details.');
    expect(markup).toContain('Network failed');
    expect(markup).toContain('Try again');
  });

  it('exports a client wrapper for the sheet component', () => {
    expect(typeof JobDetailSheet).toBe('function');
    expect(typeof GraphSearch).toBe('function');
  });
});
