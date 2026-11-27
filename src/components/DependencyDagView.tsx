'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DispositionBadge, RiskBadge } from '@/components/DispositionBadge';
import { formatUsd } from '@/lib/formatters';
import type {
  FinopsSimulationResult,
  PortfolioMigrationAnalysis,
} from '@/types/stratascale';

interface DependencyDagViewProps {
  analysis: PortfolioMigrationAnalysis;
  finops: FinopsSimulationResult;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  cycleTestActive: boolean;
  hasCycleTestOption: boolean;
  cycleTestDescription?: string;
  onToggleCycleTest: () => void;
}

interface PositionedNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  waveIndex: number;
}

const NODE_W = 208;
const NODE_H = 74;
const COL_GAP = 88;
const ROW_GAP = 22;
const TOP_HEADER_H = 58;
const PAD_X = 28;
const PAD_BOTTOM = 32;

function collectTransitive(
  startId: string,
  adjacency: Map<string, string[]>
): Set<string> {
  const visited = new Set<string>();
  const queue = [...(adjacency.get(startId) ?? [])];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (!visited.has(curr)) {
      visited.add(curr);
      for (const next of adjacency.get(curr) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
  }
  return visited;
}

function truncateLabel(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}...` : str;
}

export function DependencyDagView({
  analysis,
  finops,
  selectedNodeId,
  onSelectNode,
  cycleTestActive,
  hasCycleTestOption,
  cycleTestDescription,
  onToggleCycleTest,
}: DependencyDagViewProps) {
  const [zoom, setZoom] = useState<number>(1);

  // Clear selection if selected node no longer exists
  useEffect(() => {
    if (selectedNodeId && !analysis.assessmentById[selectedNodeId]) {
      onSelectNode(null);
    }
  }, [analysis.assessmentById, onSelectNode, selectedNodeId]);

  const { upstreamMap, downstreamMap } = useMemo(() => {
    const up = new Map<string, string[]>();
    const down = new Map<string, string[]>();
    for (const a of analysis.assessments) {
      up.set(a.workload.id, a.upstreamIds);
      down.set(a.workload.id, a.downstreamIds);
    }
    return { upstreamMap: up, downstreamMap: down };
  }, [analysis.assessments]);

  const activeHighlight = useMemo(() => {
    if (!selectedNodeId) return null;
    const upstreamSet = collectTransitive(selectedNodeId, upstreamMap);
    const downstreamSet = collectTransitive(selectedNodeId, downstreamMap);
    return {
      selected: selectedNodeId,
      upstreamSet,
      downstreamSet,
    };
  }, [downstreamMap, selectedNodeId, upstreamMap]);

  const layout = useMemo(() => {
    const waves = analysis.graph.waves;
    const positions = new Map<string, PositionedNode>();
    let maxRows = 1;

    waves.forEach((wave, colIdx) => {
      maxRows = Math.max(maxRows, wave.nodeIds.length);
      const x = PAD_X + colIdx * (NODE_W + COL_GAP);
      wave.nodeIds.forEach((id, rowIdx) => {
        const y = TOP_HEADER_H + 18 + rowIdx * (NODE_H + ROW_GAP);
        positions.set(id, {
          id,
          x,
          y,
          w: NODE_W,
          h: NODE_H,
          waveIndex: wave.waveIndex,
        });
      });
    });

    const width = Math.max(
      720,
      PAD_X * 2 + waves.length * NODE_W + Math.max(0, waves.length - 1) * COL_GAP
    );
    const height = Math.max(
      340,
      TOP_HEADER_H + 18 + maxRows * NODE_H + Math.max(0, maxRows - 1) * ROW_GAP + PAD_BOTTOM
    );

    return { waves, positions, width, height };
  }, [analysis.graph.waves]);

  const selectedAssessment = selectedNodeId
    ? analysis.assessmentById[selectedNodeId] ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Topology Status & Controls Strip */}
      <section className="flex flex-col gap-3 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {analysis.graph.hasCycle ? (
            <div className="inline-flex items-center gap-2 rounded border border-[#DC2626]/40 bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#DC2626]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Cycle Blocker: {analysis.graph.cycleCount} SCC ({analysis.graph.cyclicNodeIds.length}{' '}
                cyclic nodes)
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded border border-[#047857]/30 bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Valid Acyclic Topology &mdash; {analysis.graph.waves.length} Topological Waves,{' '}
                {analysis.graph.allEdges.length} Edges
              </span>
            </div>
          )}

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#0369A1]" />
              Upstream Prereq
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#B45309]" />
              Downstream Impact
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" />
              SCC Cycle / Blocker
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasCycleTestOption && (
            <button
              type="button"
              onClick={onToggleCycleTest}
              title={cycleTestDescription}
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                cycleTestActive
                  ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
                  : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] hover:border-[#0369A1] hover:text-[#0369A1]'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {cycleTestActive ? 'Remove Cycle Test Case' : 'Inject Cycle Test Case'}
            </button>
          )}

          <div className="inline-flex items-center overflow-hidden rounded border border-[#CBD5E1] bg-[#F8FAFC]">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out DAG"
              className="px-2 py-1.5 text-[#475569] hover:bg-[#FFFFFF] hover:text-[#0F172A]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-mono border-x border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#0F172A]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.3, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in DAG"
              className="px-2 py-1.5 text-[#475569] hover:bg-[#FFFFFF] hover:text-[#0F172A]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                onSelectNode(null);
              }}
              aria-label="Reset DAG view"
              className="border-l border-[#CBD5E1] px-2 py-1.5 text-[#475569] hover:bg-[#FFFFFF] hover:text-[#0F172A]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Tarjan SCC Cycle Diagnostics Box */}
      {analysis.graph.hasCycle && (
        <div
          role="alert"
          className="rounded-md border border-[#DC2626]/40 bg-[#FEF2F2] p-3.5 text-xs"
        >
          <div className="font-semibold text-[#DC2626]">
            Strongly Connected Component (SCC) Cycle Diagnostics
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {analysis.graph.sccs.map((scc) => (
              <div
                key={scc.id}
                className="rounded border border-[#DC2626]/30 bg-[#FFFFFF] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="tabular-mono break-words font-semibold text-[#DC2626]">
                    {scc.id}: {scc.nodeIds.join(' <-> ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectNode(scc.nodeIds[0])}
                    className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[#0369A1] hover:underline"
                  >
                    Focus SCC
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#475569]">{scc.remediationHint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dangling Dependency Warnings if uploaded data had missing IDs */}
      {analysis.graph.danglingDependencies.length > 0 && (
        <div className="rounded-md border border-[#B45309]/40 bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#B45309]">
          <strong>Unresolved Reference(s):</strong>{' '}
          {analysis.graph.danglingDependencies
            .map((d) => `${d.workloadId} -> ${d.missingDependencyId} (missing)`)
            .join(', ')}
        </div>
      )}

      {/* Interactive SVG Blueprint Canvas */}
      <div className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#EEF2F6] px-3.5 py-2 text-[11px] font-medium text-[#475569]">
          <span>
            Topological Wave Blueprint (Left-to-Right Prerequisite Order &middot; Click any node to trace blast radius)
          </span>
          {selectedNodeId && (
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="font-semibold text-[#0369A1] hover:underline"
            >
              Clear selection ({selectedNodeId})
            </button>
          )}
        </div>

        <div className="overflow-x-auto bg-[#F8FAFC] p-3">
          <svg
            width={Math.round(layout.width * zoom)}
            height={Math.round(layout.height * zoom)}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Topological migration dependency graph"
            className="mx-auto block rounded border border-[#E2E8F0] bg-[#FFFFFF]"
          >
            <defs>
              <pattern
                id="blueprint-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="1"
                />
              </pattern>

              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
              </marker>
              <marker
                id="arrow-upstream"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0369A1" />
              </marker>
              <marker
                id="arrow-downstream"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#B45309" />
              </marker>
              <marker
                id="arrow-cycle"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
              </marker>
            </defs>

            <rect width={layout.width} height={layout.height} fill="url(#blueprint-grid)" />

            {/* Wave Column Bands */}
            {layout.waves.map((wave, colIdx) => {
              const colX = PAD_X + colIdx * (NODE_W + COL_GAP) - 12;
              const colW = NODE_W + 24;
              return (
                <g key={wave.waveIndex}>
                  <rect
                    x={colX}
                    y={10}
                    width={colW}
                    height={layout.height - 20}
                    rx={4}
                    fill={wave.hasCycleNode ? '#FEF2F2' : '#F8FAFC'}
                    fillOpacity={wave.hasCycleNode ? 0.55 : 0.7}
                    stroke={wave.hasCycleNode ? '#FECACA' : '#E2E8F0'}
                    strokeWidth={1}
                  />
                  <rect
                    x={colX}
                    y={10}
                    width={colW}
                    height={42}
                    rx={4}
                    fill={wave.hasCycleNode ? '#FEE2E2' : '#EEF2F6'}
                  />
                  <text
                    x={colX + 12}
                    y={29}
                    fontSize={11}
                    fontWeight={700}
                    fill={wave.hasCycleNode ? '#DC2626' : '#0F172A'}
                    style={{ fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {wave.hasCycleNode ? `WAVE ${wave.waveIndex} [SCC]` : `WAVE ${wave.waveIndex}`}
                  </text>
                  <text
                    x={colX + 12}
                    y={44}
                    fontSize={10}
                    fill="#475569"
                    style={{ fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {wave.nodeIds.length} apps &middot; {wave.totalComplexityPoints} pts
                  </text>
                </g>
              );
            })}

            {/* Dependency Edges */}
            {analysis.graph.allEdges.map((edge) => {
              const fromPos = layout.positions.get(edge.from);
              const toPos = layout.positions.get(edge.to);
              if (!fromPos || !toPos) return null;

              const isUpstreamEdge =
                activeHighlight &&
                (edge.to === activeHighlight.selected ||
                  (activeHighlight.upstreamSet.has(edge.to) &&
                    activeHighlight.upstreamSet.has(edge.from)));
              const isDownstreamEdge =
                activeHighlight &&
                (edge.from === activeHighlight.selected ||
                  (activeHighlight.downstreamSet.has(edge.from) &&
                    activeHighlight.downstreamSet.has(edge.to)));

              let stroke = '#94A3B8';
              let strokeWidth = 1.5;
              let markerEnd = 'url(#arrow-default)';
              let opacity = activeHighlight ? 0.2 : 0.85;

              if (edge.isCyclic) {
                stroke = '#DC2626';
                strokeWidth = 2.4;
                markerEnd = 'url(#arrow-cycle)';
                opacity = 1;
              } else if (isUpstreamEdge) {
                stroke = '#0369A1';
                strokeWidth = 2.3;
                markerEnd = 'url(#arrow-upstream)';
                opacity = 1;
              } else if (isDownstreamEdge) {
                stroke = '#B45309';
                strokeWidth = 2.3;
                markerEnd = 'url(#arrow-downstream)';
                opacity = 1;
              }

              // Same-column back-edge / intra-SCC edge vs forward left-to-right curve
              let d = '';
              if (fromPos.x === toPos.x) {
                const startX = fromPos.x + fromPos.w;
                const startY = fromPos.y + fromPos.h / 2;
                const endX = toPos.x + toPos.w;
                const endY = toPos.y + toPos.h / 2;
                const loopOffset = 46;
                d = `M ${startX} ${startY} C ${startX + loopOffset} ${startY}, ${endX + loopOffset} ${endY}, ${endX + 2} ${endY}`;
              } else if (fromPos.x > toPos.x) {
                // Backward edge in cycle
                const startX = fromPos.x;
                const startY = fromPos.y + fromPos.h / 2;
                const endX = toPos.x + toPos.w;
                const endY = toPos.y + toPos.h / 2;
                const midY = Math.min(startY, endY) - 42;
                d = `M ${startX} ${startY} C ${startX - 40} ${midY}, ${endX + 40} ${midY}, ${endX} ${endY}`;
              } else {
                const startX = fromPos.x + fromPos.w;
                const startY = fromPos.y + fromPos.h / 2;
                const endX = toPos.x;
                const endY = toPos.y + toPos.h / 2;
                const dx = Math.max(36, (endX - startX) * 0.5);
                d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX - 2} ${endY}`;
              }

              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.isCyclic ? '5 3' : undefined}
                  opacity={opacity}
                  markerEnd={markerEnd}
                />
              );
            })}

            {/* Workload Nodes */}
            {analysis.assessments.map((item) => {
              const pos = layout.positions.get(item.workload.id);
              if (!pos) return null;

              const isSelected = activeHighlight?.selected === item.workload.id;
              const isUpstream = activeHighlight?.upstreamSet.has(item.workload.id) ?? false;
              const isDownstream =
                activeHighlight?.downstreamSet.has(item.workload.id) ?? false;
              const dimmed =
                Boolean(activeHighlight) &&
                !isSelected &&
                !isUpstream &&
                !isDownstream &&
                !item.sccId;

              let borderStroke = '#CBD5E1';
              let strokeW = 1.2;
              let fill = '#FFFFFF';
              let topAccent = '#0369A1';

              if (item.sccId) {
                borderStroke = '#DC2626';
                strokeW = 2;
                fill = '#FEF2F2';
                topAccent = '#DC2626';
              } else if (isSelected) {
                borderStroke = '#0369A1';
                strokeW = 2.4;
                fill = '#F0F9FF';
                topAccent = '#0369A1';
              } else if (isUpstream) {
                borderStroke = '#0369A1';
                strokeW = 1.8;
                fill = '#F8FAFC';
                topAccent = '#0369A1';
              } else if (isDownstream) {
                borderStroke = '#B45309';
                strokeW = 1.8;
                fill = '#FFFBEB';
                topAccent = '#B45309';
              } else if (item.disposition === 'Retire' || item.disposition === 'Rehost') {
                topAccent = '#047857';
              } else if (item.disposition === 'Refactor') {
                topAccent = '#B45309';
              }

              return (
                <g
                  key={item.workload.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={dimmed ? 0.35 : 1}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.workload.id} ${item.workload.name}, ${item.disposition}, Wave ${item.waveIndex}`}
                  onClick={() =>
                    onSelectNode(isSelected ? null : item.workload.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectNode(isSelected ? null : item.workload.id);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  <rect
                    width={pos.w}
                    height={pos.h}
                    rx={4}
                    fill={fill}
                    stroke={borderStroke}
                    strokeWidth={strokeW}
                  />
                  <rect width={4} height={pos.h} rx={2} fill={topAccent} />

                  <text
                    x={12}
                    y={19}
                    fontSize={11}
                    fontWeight={700}
                    fill="#0F172A"
                    style={{ fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {item.workload.id}
                  </text>

                  <text
                    x={pos.w - 10}
                    y={19}
                    fontSize={10}
                    fontWeight={600}
                    textAnchor="end"
                    fill={item.sccId ? '#DC2626' : '#0369A1'}
                    style={{ fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {item.disposition}
                  </text>

                  <text
                    x={12}
                    y={39}
                    fontSize={11.5}
                    fontWeight={600}
                    fill="#0F172A"
                  >
                    {truncateLabel(item.workload.name, 24)}
                  </text>

                  <text
                    x={12}
                    y={59}
                    fontSize={10}
                    fill={item.workload.eolOs ? '#DC2626' : '#475569'}
                    style={{ fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {item.workload.eolOs ? 'EOL OS' : item.workload.complianceTier} &middot;{' '}
                    {formatUsd(item.workload.monthlyOnPremCostUsd)}/mo
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Node Architectural Inspector */}
      {selectedAssessment ? (
        <section className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-mono text-sm font-bold text-[#0F172A]">
                  {selectedAssessment.workload.id}
                </span>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {selectedAssessment.workload.name}
                </h3>
                <DispositionBadge disposition={selectedAssessment.disposition} />
                <RiskBadge risk={selectedAssessment.riskLevel} />
                {selectedAssessment.sccId && (
                  <span className="tabular-mono rounded border border-[#DC2626]/40 bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                    Cycle Group: {selectedAssessment.sccId}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#475569]">
                {selectedAssessment.workload.domain} &middot;{' '}
                {selectedAssessment.workload.os}
                {selectedAssessment.workload.eolOs ? ' [EOL]' : ''} &middot; DB Coupling:{' '}
                {selectedAssessment.workload.dbCoupling} &middot; Target Cutover: Wave{' '}
                {selectedAssessment.waveIndex} (Month{' '}
                {finops.projectionById[selectedAssessment.workload.id]?.cutoverMonth ?? '-'})
              </p>
            </div>
            <div className="tabular-mono text-right text-xs">
              <div className="font-semibold text-[#0F172A]">
                On-Prem: {formatUsd(selectedAssessment.workload.monthlyOnPremCostUsd)}/mo
              </div>
              <div className="text-[#0369A1]">
                Cloud:{' '}
                {formatUsd(
                  finops.projectionById[selectedAssessment.workload.id]
                    ?.steadyStateMonthlyCloudUsd ?? 0
                )}
                /mo
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0369A1]">
                Direct Upstream Prerequisites ({selectedAssessment.upstreamIds.length})
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedAssessment.upstreamIds.length === 0 ? (
                  <span className="text-xs text-[#475569]">
                    Root node (no upstream prerequisites).
                  </span>
                ) : (
                  selectedAssessment.upstreamIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectNode(id)}
                      className="tabular-mono inline-flex items-center gap-1 rounded border border-[#0369A1]/40 bg-[#F0F9FF] px-2 py-1 text-xs font-medium text-[#0369A1] hover:bg-[#E0F2FE]"
                    >
                      {id}
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-sans">
                        {analysis.assessmentById[id]?.workload.name ?? id}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                Direct Downstream Dependents ({selectedAssessment.downstreamIds.length})
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedAssessment.downstreamIds.length === 0 ? (
                  <span className="text-xs text-[#475569]">
                    Leaf workload (no downstream dependents).
                  </span>
                ) : (
                  selectedAssessment.downstreamIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectNode(id)}
                      className="tabular-mono inline-flex items-center gap-1 rounded border border-[#B45309]/40 bg-[#FFFBEB] px-2 py-1 text-xs font-medium text-[#B45309] hover:bg-[#FEF3C7]"
                    >
                      {id}
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-sans">
                        {analysis.assessmentById[id]?.workload.name ?? id}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-3 text-xs text-[#475569]">
          Select any workload tile in the blueprint above to highlight transitive upstream prerequisites, downstream dependents, and wave cutover alignment.
        </div>
      )}
    </div>
  );
}
