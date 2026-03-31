import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveJobSheetKeyword } from '../fair-client';

vi.mock('@/components/fair/keyword-graph', () => ({
  default: () => <div data-testid="keyword-graph" />,
}));

vi.mock('@/components/fair/cluster-view', () => ({
  default: () => <div data-testid="cluster-view" />,
}));

vi.mock('@/components/fair/job-detail-sheet', () => ({
  default: () => <div data-testid="job-detail-sheet" />,
}));

vi.mock('@/components/fair/graph-search', () => ({
  default: () => <div data-testid="graph-search" />,
}));

describe('FairClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals?.();
  });

  it('renders a loading shell before graph data arrives', async () => {
    const { default: FairClient } = await import('../fair-client');
    const markup = renderToStaticMarkup(<FairClient userSkills={['RAG Pipeline']} />);

    expect(markup).toContain('Rendering opportunity graph...');
    expect(markup).toContain('bg-white/5');
  });

  it('keeps the opened sheet keyword stable even after active keyword clears', () => {
    expect(resolveJobSheetKeyword('rag', null, 'search-term')).toBe('rag');
    expect(resolveJobSheetKeyword(null, 'agents', 'search-term')).toBe('agents');
    expect(resolveJobSheetKeyword(null, null, 'search-term')).toBe('search-term');
    expect(resolveJobSheetKeyword(null, null, null)).toBe('');
  });
});
