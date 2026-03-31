import { describe, expect, it, vi } from 'vitest';

describe('deriveGraphSnapshot', () => {
  it('derives keyword counts, trending flags, and co-occurrence edges from open jobs', async () => {
    const { deriveGraphSnapshot } = await import('../workers/update-graph');

    const snapshot = deriveGraphSnapshot([
      {
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        structured: {
          skills: [
            { name: 'RAG Pipeline', required: true },
            { name: 'LangGraph', required: true },
          ],
        },
      },
      {
        createdAt: new Date('2026-03-27T00:00:00.000Z'),
        structured: {
          skills: [
            { name: 'RAG Pipeline', required: true },
            { name: 'LangGraph', required: false },
          ],
        },
      },
      {
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        structured: {
          skills: [
            { name: 'RAG Pipeline', required: true },
            { name: 'Vector Databases', required: false },
            { name: 'Prompt Engineering', required: false },
          ],
        },
      },
    ]);

    expect(snapshot.nodes).toEqual([
      { keyword: 'RAG Pipeline', jobCount: 3, trending: true },
      { keyword: 'LangGraph', jobCount: 2, trending: true },
      { keyword: 'Prompt Engineering', jobCount: 1, trending: false },
      { keyword: 'Vector Databases', jobCount: 1, trending: false },
    ]);
    expect(snapshot.edges).toEqual([
      { sourceKeyword: 'LangGraph', targetKeyword: 'RAG Pipeline', weight: 2 },
    ]);
    expect(snapshot.trendingCount).toBe(2);
  });

  it('returns an empty snapshot when there are no open jobs', async () => {
    const { deriveGraphSnapshot } = await import('../workers/update-graph');

    expect(deriveGraphSnapshot([])).toEqual({
      nodes: [],
      edges: [],
      trendingCount: 0,
    });
  });
});

describe('planKeywordNodeSync', () => {
  it('preserves stable node ids for unchanged keywords', async () => {
    const { planKeywordNodeSync } = await import('../workers/update-graph');

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-node-id');

    try {
      const plan = planKeywordNodeSync(
        [
          { id: 'existing-rag-id', keyword: 'RAG Pipeline' },
          { id: 'removed-id', keyword: 'Old Skill' },
        ],
        [
          { keyword: 'RAG Pipeline', jobCount: 5, trending: true },
          { keyword: 'LangGraph', jobCount: 2, trending: false },
        ],
        new Date('2026-03-31T00:00:00.000Z')
      );

      expect(plan.keywordToId.get('RAG Pipeline')).toBe('existing-rag-id');
      expect(plan.keywordToId.get('LangGraph')).toBe('new-node-id');
      expect(plan.updates).toEqual([
        { id: 'existing-rag-id', keyword: 'RAG Pipeline', jobCount: 5, trending: true },
      ]);
      expect(plan.inserts).toEqual([
        {
          id: 'new-node-id',
          keyword: 'LangGraph',
          jobCount: 2,
          trending: false,
          createdAt: new Date('2026-03-31T00:00:00.000Z'),
        },
      ]);
      expect(plan.removedNodeIds).toEqual(['removed-id']);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
