import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import KeywordGraph, { measureTextWidth, prepareGraphNodes } from '../keyword-graph';
import type { GraphData } from '@/types/graph';

const graphData: GraphData = {
  nodes: [
    { id: 'node-1', keyword: 'RAG', jobCount: 8, trending: true },
    { id: 'node-2', keyword: 'LangGraph', jobCount: 4, trending: false },
  ],
  edges: [{ id: 'edge-1', sourceId: 'node-1', targetId: 'node-2', weight: 1.6 }],
};

describe('KeywordGraph', () => {
  it('measures text width and highlights matching user skills', () => {
    expect(measureTextWidth('LangGraph', 13)).toBeGreaterThan(measureTextWidth('RAG', 13));

    const nodes = prepareGraphNodes(graphData.nodes, ['langgraph']);

    expect(nodes[0]?.isUserSkill).toBe(false);
    expect(nodes[1]?.isUserSkill).toBe(true);
    expect(nodes[0]?.radius).toBeGreaterThan(nodes[1]?.radius ?? 0);
  });

  it('renders the graph container and svg shell', () => {
    const markup = renderToStaticMarkup(
      <KeywordGraph
        data={graphData}
        userSkills={['RAG']}
        onKeywordClick={vi.fn()}
        searchKeyword={null}
      />
    );

    expect(markup).toContain('<svg');
    expect(markup).toContain('w-full h-full');
  });
});
