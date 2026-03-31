'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphEdge, GraphNode } from '@/types/graph';

type KeywordGraphProps = {
  data: GraphData;
  userSkills: string[];
  onKeywordClick: (keyword: string) => void;
  searchKeyword: string | null;
};

export const MIN_NODE_RADIUS = 30;
export const MAX_NODE_RADIUS = 70;
const PILL_HEIGHT = 32;
const PILL_PADDING_X = 16;

const COLORS = {
  nodeFill: '#141726',
  nodeStroke: '#2f3857',
  nodeText: '#f4f6fb',
  userSkillFill: '#16203c',
  userSkillStroke: '#3b82f6',
  userSkillGlow: 'rgba(59, 130, 246, 0.4)',
  edgeStroke: '#2b3551',
  countText: '#a8b3cf',
  searchHighlight: '#f59e0b',
};

type GraphLinkDatum = d3.SimulationLinkDatum<GraphNode> & { weight: number };

export function measureTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6 + PILL_PADDING_X * 2;
}

export function prepareGraphNodes(nodes: GraphNode[], userSkills: string[]): GraphNode[] {
  const maxJobCount = Math.max(...nodes.map((node) => node.jobCount), 1);
  const skillSet = new Set(userSkills.map((skill) => skill.toLowerCase()));

  return nodes.map((node) => ({
    ...node,
    isUserSkill: skillSet.has(node.keyword.toLowerCase()),
    radius:
      MIN_NODE_RADIUS +
      (node.jobCount / maxJobCount) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS),
  }));
}

export default function KeywordGraph({
  data,
  userSkills,
  onKeywordClick,
  searchKeyword,
}: KeywordGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLinkDatum> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const nodes = useMemo(() => prepareGraphNodes(data.nodes, userSkills), [data.nodes, userSkills]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || dimensions.width === 0 || dimensions.height === 0 || nodes.length === 0) {
      return;
    }

    const edges = data.edges.map((edge) => ({ ...edge }));
    const svgSelection = d3.select(svg);
    svgSelection.selectAll('*').remove();

    svgSelection.attr('width', dimensions.width).attr('height', dimensions.height);

    const defs = svgSelection.append('defs');
    const glowFilter = defs
      .append('filter')
      .attr('id', 'keyword-graph-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const merge = glowFilter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const graphRoot = svgSelection.append('g');
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 4])
      .on('zoom', (event) => {
        graphRoot.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior);

    const linkData = edges.reduce<GraphLinkDatum[]>((acc, edge: GraphEdge) => {
        const source = nodes.find((node) => node.id === edge.sourceId);
        const target = nodes.find((node) => node.id === edge.targetId);
        if (!source || !target) {
          return acc;
        }

        acc.push({
          source,
          target,
          weight: edge.weight,
        });

        return acc;
      }, []);

    const simulation = d3
      .forceSimulation<GraphNode>(nodes.map((node) => ({ ...node })))
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLinkDatum>(linkData)
          .id((node) => node.id)
          .distance((link) => Math.max(90, 150 - link.weight * 20))
          .strength((link) => Math.min(0.8, 0.2 + link.weight * 0.12))
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-260))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((node) => (node.radius ?? MIN_NODE_RADIUS) + 14))
      .force(
        'user-skill-focus',
        d3
          .forceRadial<GraphNode>(
            (node) => (node.isUserSkill ? Math.min(dimensions.width, dimensions.height) * 0.1 : Math.min(dimensions.width, dimensions.height) * 0.28),
            dimensions.width / 2,
            dimensions.height / 2
          )
          .strength((node) => (node.isUserSkill ? 0.08 : 0.02))
      );

    simulationRef.current = simulation;

    const link = graphRoot
      .append('g')
      .attr('class', 'keyword-links')
      .selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', COLORS.edgeStroke)
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', (datum) => Math.max(1, Math.min(4, datum.weight)));

    const nodeGroup = graphRoot
      .append('g')
      .attr('class', 'keyword-nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(simulation.nodes())
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_event, datum) => {
        onKeywordClick(datum.keyword);
      });

    nodeGroup
      .append('rect')
      .attr('rx', PILL_HEIGHT / 2)
      .attr('ry', PILL_HEIGHT / 2)
      .attr('height', PILL_HEIGHT)
      .attr('width', (datum) => measureTextWidth(datum.keyword, 13) + (datum.trending ? 24 : 0))
      .attr('x', (datum) => -((measureTextWidth(datum.keyword, 13) + (datum.trending ? 24 : 0)) / 2))
      .attr('y', -PILL_HEIGHT / 2)
      .attr('fill', (datum) => (datum.isUserSkill ? COLORS.userSkillFill : COLORS.nodeFill))
      .attr('stroke', (datum) => (datum.isUserSkill ? COLORS.userSkillStroke : COLORS.nodeStroke))
      .attr('stroke-width', (datum) => (datum.isUserSkill ? 2 : 1))
      .attr('filter', (datum) => (datum.isUserSkill ? 'url(#keyword-graph-glow)' : null));

    nodeGroup
      .append('text')
      .text((datum) => datum.keyword)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', COLORS.nodeText)
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('dx', (datum) => (datum.trending ? -8 : 0));

    nodeGroup
      .append('text')
      .text((datum) => `${datum.jobCount}`)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'central')
      .attr('fill', COLORS.countText)
      .attr('font-size', 10)
      .attr('dx', (datum) => measureTextWidth(datum.keyword, 13) / 2 - 2 + (datum.trending ? -8 : 0));

    nodeGroup
      .filter((datum) => datum.trending)
      .append('text')
      .text('●')
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#22c55e')
      .attr('font-size', 12)
      .attr('dx', (datum) => (measureTextWidth(datum.keyword, 13) + 24) / 2 - 6);

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, datum) => {
        if (!event.active) {
          simulation.alphaTarget(0.2).restart();
        }

        datum.fx = datum.x;
        datum.fy = datum.y;
      })
      .on('drag', (event, datum) => {
        datum.fx = event.x;
        datum.fy = event.y;
      })
      .on('end', (event, datum) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }

        datum.fx = null;
        datum.fy = null;
      });

    nodeGroup.call(drag);

    simulation.on('tick', () => {
      link
        .attr('x1', (datum) => (datum.source as GraphNode).x ?? 0)
        .attr('y1', (datum) => (datum.source as GraphNode).y ?? 0)
        .attr('x2', (datum) => (datum.target as GraphNode).x ?? 0)
        .attr('y2', (datum) => (datum.target as GraphNode).y ?? 0);

      nodeGroup.attr('transform', (datum) => `translate(${datum.x ?? 0},${datum.y ?? 0})`);
    });

    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [data.edges, dimensions.height, dimensions.width, nodes, onKeywordClick]);

  useEffect(() => {
    const svg = svgRef.current;
    const simulation = simulationRef.current;
    const zoomBehavior = zoomBehaviorRef.current;

    if (!svg || !simulation || !zoomBehavior || !searchKeyword) {
      return;
    }

    const target = simulation
      .nodes()
      .find((node) => node.keyword.toLowerCase() === searchKeyword.toLowerCase());

    if (!target || target.x === undefined || target.y === undefined) {
      return;
    }

    d3.select(svg)
      .transition()
      .duration(500)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity
          .translate(dimensions.width / 2, dimensions.height / 2)
          .scale(1.8)
          .translate(-target.x, -target.y)
      );

    d3.select(svg)
      .selectAll<SVGRectElement, GraphNode>('.keyword-nodes g rect')
      .attr('stroke', (datum) =>
        datum.keyword.toLowerCase() === searchKeyword.toLowerCase()
          ? COLORS.searchHighlight
          : datum.isUserSkill
            ? COLORS.userSkillStroke
            : COLORS.nodeStroke
      )
      .attr('stroke-width', (datum) =>
        datum.keyword.toLowerCase() === searchKeyword.toLowerCase() ? 3 : datum.isUserSkill ? 2 : 1
      );
  }, [dimensions.height, dimensions.width, searchKeyword]);

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[480px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(87,113,255,0.18),_transparent_45%),linear-gradient(180deg,_rgba(9,13,25,0.98),_rgba(14,18,31,0.94))]">
      <svg ref={svgRef} className="w-full h-full" aria-label="Opportunity keyword graph" />
    </div>
  );
}
