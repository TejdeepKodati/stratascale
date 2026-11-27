'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  GitBranch,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DispositionBadge, RiskBadge } from '@/components/DispositionBadge';
import { formatCompactUsd, formatUsd } from '@/lib/formatters';
import type {
  ComplianceTier,
  CriticalityTier,
  DbCouplingLevel,
  Disposition6R,
  FinopsSimulationResult,
  PortfolioMigrationAnalysis,
  Workload,
  WorkloadAssessment,
} from '@/types/stratascale';

interface PortfolioMatrixViewProps {
  portfolioName: string;
  workloads: Workload[];
  analysis: PortfolioMigrationAnalysis;
  finops: FinopsSimulationResult;
  cycleTestActive: boolean;
  cycleTestDescription?: string;
  hasCycleTestOption: boolean;
  isDirty: boolean;
  onToggleCycleTest: () => void;
  onResetPortfolio: () => void;
  onUpsertWorkload: (workload: Workload, originalId?: string) => void;
  onDeleteWorkload: (id: string) => void;
  onInspectInDag: (id: string) => void;
}

type SortKey = 'id' | 'name' | 'onPrem' | 'cloud' | 'disposition' | 'wave' | 'confidence' | 'risk';

const ALL_DISPOSITIONS: Disposition6R[] = [
  'Rehost',
  'Replatform',
  'Refactor',
  'Repurchase',
  'Retire',
  'Retain',
];

const BAR_COLORS: Record<Disposition6R, string> = {
  Rehost: 'bg-[#047857]',
  Replatform: 'bg-[#0369A1]',
  Refactor: 'bg-[#B45309]',
  Repurchase: 'bg-[#0F172A]',
  Retire: 'bg-[#10B981]',
  Retain: 'bg-[#94A3B8]',
};

function createBlankWorkload(existingCount: number): Workload {
  return {
    id: `APP-${String(existingCount + 1).padStart(2, '0')}`,
    name: 'New Enterprise Service',
    domain: 'Core Platform',
    environment: 'Production',
    os: 'Ubuntu 22.04 LTS',
    eolOs: false,
    complianceTier: 'Standard',
    criticality: 'Tier-2',
    vcpus: 16,
    ramGb: 64,
    storageTb: 3.0,
    cpuUtilPct: 42,
    ramUtilPct: 51,
    monthlyEgressGb: 320,
    dbCoupling: 'Loose',
    hasSaasEquivalent: false,
    cloudReadinessScore: 68,
    businessValueScore: 72,
    regulatoryResidencyLock: false,
    decommissionCandidate: false,
    monthlyOnPremCostUsd: 11200,
    dependencies: [],
    notes: '',
  };
}

export function PortfolioMatrixView({
  portfolioName,
  workloads,
  analysis,
  finops,
  cycleTestActive,
  cycleTestDescription,
  hasCycleTestOption,
  isDirty,
  onToggleCycleTest,
  onResetPortfolio,
  onUpsertWorkload,
  onDeleteWorkload,
  onInspectInDag,
}: PortfolioMatrixViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState<Disposition6R | 'ALL'>('ALL');
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'EOL' | 'HIGH_RISK' | 'CYCLE'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('wave');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOriginalId, setEditingOriginalId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<Workload | null>(null);
  const [depsText, setDepsText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedAssessment: WorkloadAssessment | null = useMemo(() => {
    if (!editingOriginalId) return null;
    return analysis.assessmentById[editingOriginalId] ?? null;
  }, [analysis.assessmentById, editingOriginalId]);

  const filteredAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = analysis.assessments.filter((a) => {
      if (dispositionFilter !== 'ALL' && a.disposition !== dispositionFilter) return false;
      if (alertFilter === 'EOL' && !a.workload.eolOs) return false;
      if (alertFilter === 'HIGH_RISK' && a.riskLevel !== 'High') return false;
      if (alertFilter === 'CYCLE' && !a.blockedByCycle) return false;
      if (!q) return true;
      return (
        a.workload.id.toLowerCase().includes(q) ||
        a.workload.name.toLowerCase().includes(q) ||
        a.workload.domain.toLowerCase().includes(q) ||
        a.workload.os.toLowerCase().includes(q) ||
        a.workload.complianceTier.toLowerCase().includes(q)
      );
    });

    const riskRank = { Low: 1, Medium: 2, High: 3 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'id':
          cmp = a.workload.id.localeCompare(b.workload.id);
          break;
        case 'name':
          cmp = a.workload.name.localeCompare(b.workload.name);
          break;
        case 'onPrem':
          cmp = a.workload.monthlyOnPremCostUsd - b.workload.monthlyOnPremCostUsd;
          break;
        case 'cloud':
          cmp =
            (finops.projectionById[a.workload.id]?.steadyStateMonthlyCloudUsd ?? 0) -
            (finops.projectionById[b.workload.id]?.steadyStateMonthlyCloudUsd ?? 0);
          break;
        case 'disposition':
          cmp = a.disposition.localeCompare(b.disposition);
          break;
        case 'wave':
          cmp = a.waveIndex - b.waveIndex || a.workload.id.localeCompare(b.workload.id);
          break;
        case 'confidence':
          cmp = a.confidencePct - b.confidencePct;
          break;
        case 'risk':
          cmp = riskRank[a.riskLevel] - riskRank[b.riskLevel];
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    analysis.assessments,
    alertFilter,
    dispositionFilter,
    finops.projectionById,
    searchQuery,
    sortDir,
    sortKey,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function openEditDrawer(w: Workload) {
    setEditingOriginalId(w.id);
    setDraft({ ...w, dependencies: [...w.dependencies] });
    setDepsText(w.dependencies.join(', '));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openAddDrawer() {
    const blank = createBlankWorkload(workloads.length);
    setEditingOriginalId(undefined);
    setDraft(blank);
    setDepsText('');
    setFormError(null);
    setDrawerOpen(true);
  }

  function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const cleanId = draft.id.trim().toUpperCase();
    const cleanName = draft.name.trim();
    if (!cleanId || !cleanName) {
      setFormError('Workload ID and Application Name are required.');
      return;
    }
    const collision = workloads.some(
      (w) => w.id.toLowerCase() === cleanId.toLowerCase() && w.id !== editingOriginalId
    );
    if (collision) {
      setFormError(`Workload ID "${cleanId}" already exists in this portfolio.`);
      return;
    }

    const parsedDeps = depsText
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    onUpsertWorkload(
      {
        ...draft,
        id: cleanId,
        name: cleanName,
        dependencies: parsedDeps,
      },
      editingOriginalId
    );
    setDrawerOpen(false);
  }

  const totalCount = Math.max(1, analysis.assessments.length);

  return (
    <div className="space-y-4">
      {/* Unified Architectural Ledger Summary Strip */}
      <section
        aria-label="Portfolio Specification Summary"
        className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF]"
      >
        <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Column 1: Scope & Sizing */}
          <div className="p-4 lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              Portfolio Scope
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular-mono text-2xl font-semibold text-[#0F172A]">
                {analysis.assessments.length}
              </span>
              <span className="text-xs text-[#475569]">
                workloads across{' '}
                <strong className="tabular-mono text-[#0F172A]">
                  {analysis.graph.waves.length}
                </strong>{' '}
                waves
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#475569]">
              <span>Right-Sized Compute</span>
              <span className="tabular-mono font-medium text-[#0F172A]">
                {finops.rightSizingSummary.provisionedVcpus} &rarr;{' '}
                {finops.rightSizingSummary.rightSizedVcpus} vCPUs (-
                {finops.rightSizingSummary.vcpuReductionPct}%)
              </span>
            </div>
          </div>

          {/* Column 2: 6R Distribution Micro-Bar */}
          <div className="p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                6R Disposition Mix
              </span>
              {dispositionFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setDispositionFilter('ALL')}
                  className="text-[11px] font-medium text-[#0369A1] hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div
              className="mt-2 flex h-2.5 w-full overflow-hidden rounded-sm bg-[#EEF2F6]"
              role="img"
              aria-label="6R disposition distribution bar"
            >
              {ALL_DISPOSITIONS.map((disp) => {
                const count = analysis.dispositionCounts[disp];
                if (count === 0) return null;
                const widthPct = (count / totalCount) * 100;
                return (
                  <div
                    key={disp}
                    style={{ width: `${widthPct}%` }}
                    className={`${BAR_COLORS[disp]} transition-all`}
                    title={`${disp}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ALL_DISPOSITIONS.map((disp) => {
                const count = analysis.dispositionCounts[disp];
                const active = dispositionFilter === disp;
                return (
                  <button
                    key={disp}
                    type="button"
                    onClick={() =>
                      setDispositionFilter((prev) => (prev === disp ? 'ALL' : disp))
                    }
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                      active
                        ? 'border-[#0369A1] bg-[#F0F9FF] font-semibold text-[#0369A1]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:border-[#CBD5E1] hover:text-[#0F172A]'
                    }`}
                  >
                    <span>{disp}</span>
                    <span className="tabular-mono font-semibold text-[#0F172A]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Risk & Topology Status */}
          <div className="p-4 lg:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              Risk &amp; DAG Health
            </div>
            <div className="mt-1.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">EOL OS Exposure</span>
                <span
                  className={`tabular-mono font-semibold ${
                    analysis.eolCount > 0 ? 'text-[#DC2626]' : 'text-[#047857]'
                  }`}
                >
                  {analysis.eolCount} apps
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">High Risk Items</span>
                <span
                  className={`tabular-mono font-semibold ${
                    analysis.highRiskCount > 0 ? 'text-[#B45309]' : 'text-[#047857]'
                  }`}
                >
                  {analysis.highRiskCount} apps
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">DAG Cycles</span>
                {analysis.graph.hasCycle ? (
                  <span className="tabular-mono inline-flex items-center gap-1 font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {analysis.graph.cycleCount} SCC
                  </span>
                ) : (
                  <span className="tabular-mono inline-flex items-center gap-1 font-semibold text-[#047857]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    0 Clear
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Column 4: Financial Run-Rate & 3-Yr Delta */}
          <div className="p-4 lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              FinOps Run-Rate &amp; 3-Yr Delta
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-xs text-[#475569]">Monthly On-Prem &rarr; Cloud</span>
              <span className="tabular-mono text-sm font-semibold text-[#0F172A]">
                {formatCompactUsd(finops.steadyStateMonthlyOnPremUsd)} &rarr;{' '}
                <span className="text-[#0369A1]">
                  {formatCompactUsd(finops.steadyStateMonthlyCloudUsd)}
                </span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-[#E2E8F0] pt-2">
              <span className="text-xs font-medium text-[#475569]">3-Yr Net Savings</span>
              <span
                className={`tabular-mono text-base font-semibold ${
                  finops.threeYearNetSavingsUsd >= 0
                    ? 'text-[#047857]'
                    : 'text-[#DC2626]'
                }`}
              >
                {formatCompactUsd(finops.threeYearNetSavingsUsd)} ({finops.threeYearSavingsPct}%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Cycle Diagnostic Banner when Cycle Test is active or uploaded data has a cycle */}
      {analysis.graph.hasCycle && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-[#DC2626]/40 bg-[#FEF2F2] px-4 py-3 text-xs text-[#0F172A] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
            <div>
              <span className="font-semibold text-[#DC2626]">
                Circular Dependency Detected ({analysis.graph.cycleCount} SCC):
              </span>{' '}
              {analysis.graph.sccs.map((s) => `${s.id} [${s.nodeIds.join(', ')}]`).join('; ')}.{' '}
              <span className="text-[#475569]">
                Affected workloads and downstream dependents are marked blocked until decoupled.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onInspectInDag(analysis.graph.cyclicNodeIds[0] ?? '')}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded border border-[#DC2626]/40 bg-[#FFFFFF] px-2.5 py-1 font-medium text-[#DC2626] hover:bg-[#FEF2F2] sm:self-center"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Inspect Cycle in DAG
          </button>
        </div>
      )}

      {/* Table Filter & Action Toolbar */}
      <div className="flex flex-col gap-2.5 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#475569]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter ID, app, domain, OS..."
              aria-label="Filter workloads"
              className="w-full rounded border border-[#CBD5E1] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-[#475569] focus:border-[#0369A1] focus:bg-[#FFFFFF] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'EOL', label: `EOL OS (${analysis.eolCount})` },
                { key: 'HIGH_RISK', label: `High Risk (${analysis.highRiskCount})` },
                {
                  key: 'CYCLE',
                  label: `Cycle Blocked (${analysis.assessments.filter((a) => a.blockedByCycle).length})`,
                },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setAlertFilter(f.key)}
                className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  alertFilter === f.key
                    ? 'border-[#0369A1] bg-[#0369A1] text-[#FFFFFF]'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:border-[#CBD5E1] hover:text-[#0F172A]'
                }`}
              >
                {f.label}
              </button>
            ))}
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

          {isDirty && (
            <button
              type="button"
              onClick={onResetPortfolio}
              className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Seed
            </button>
          )}

          <button
            type="button"
            onClick={openAddDrawer}
            className="inline-flex items-center gap-1.5 rounded border border-[#0369A1] bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#025582]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Workload
          </button>
        </div>
      </div>

      {/* Specification Table */}
      <div className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#EEF2F6] px-3 py-2 text-[11px] font-medium text-[#475569]">
          <span>
            Showing <strong className="tabular-mono text-[#0F172A]">{filteredAssessments.length}</strong> of{' '}
            <strong className="tabular-mono text-[#0F172A]">{analysis.assessments.length}</strong>{' '}
            workloads in {portfolioName}
          </span>
          <span className="hidden sm:inline">Click any row to inspect 6R score weights or edit parameters</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#CBD5E1] bg-[#EEF2F6] text-[10.5px] font-semibold uppercase tracking-wide text-[#475569]">
                <th className="py-2.5 pl-3 pr-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    ID
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    Application
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5 whitespace-nowrap">OS / EOL</th>
                <th className="px-2 py-2.5 whitespace-nowrap">Tier / DB</th>
                <th className="px-2 py-2.5 whitespace-nowrap">Compute</th>
                <th className="px-2 py-2.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('onPrem')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    On-Prem
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('disposition')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    6R Strategy
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('cloud')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    Cloud/mo
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('wave')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    Wave
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('risk')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A]"
                  >
                    Conf / Risk
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-xs text-[#475569]">
                    No workloads match the current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((item) => {
                  const w = item.workload;
                  const proj = finops.projectionById[w.id];
                  return (
                    <tr
                      key={w.id}
                      onClick={() => openEditDrawer(w)}
                      className="cursor-pointer transition-colors hover:bg-[#F8FAFC]"
                    >
                      <td className="py-2.5 pl-3 pr-2 align-top whitespace-nowrap">
                        <span className="tabular-mono font-semibold text-[#0F172A]">
                          {w.id}
                        </span>
                      </td>
                      <td className="max-w-[210px] px-2 py-2.5 align-top">
                        <div className="font-semibold leading-snug text-[#0F172A]">
                          {w.name}
                        </div>
                        <div className="text-[11px] text-[#475569]">
                          {w.domain} &middot; {w.environment}
                        </div>
                      </td>
                      <td className="max-w-[132px] px-2 py-2.5 align-top">
                        <div className="leading-snug text-[#0F172A]">{w.os}</div>
                        {w.eolOs ? (
                          <span className="mt-0.5 inline-block rounded border border-[#DC2626]/30 bg-[#FEF2F2] px-1.5 py-0 text-[10px] font-semibold text-[#DC2626]">
                            EOL OS
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#475569]">Supported</span>
                        )}
                      </td>
                      <td className="max-w-[125px] px-2 py-2.5 align-top">
                        <div className="tabular-mono text-[11px] font-medium text-[#0F172A]">
                          {w.complianceTier}
                        </div>
                        <div className="text-[11px] text-[#475569]">
                          {w.dbCoupling} &middot; {w.criticality}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 align-top whitespace-nowrap">
                        <div className="tabular-mono text-[11px] text-[#0F172A]">
                          {w.vcpus}c / {w.ramGb}G
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-[#475569]">
                          <span className="tabular-mono">{w.cpuUtilPct}%</span>
                          <div className="h-1.5 w-9 overflow-hidden rounded-sm bg-[#E2E8F0]">
                            <div
                              className={`h-full ${
                                w.cpuUtilPct < 25 ? 'bg-[#B45309]' : 'bg-[#0369A1]'
                              }`}
                              style={{ width: `${w.cpuUtilPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="tabular-mono px-2 py-2.5 text-right align-top font-medium text-[#0F172A] whitespace-nowrap">
                        {formatUsd(w.monthlyOnPremCostUsd)}
                      </td>
                      <td className="max-w-[126px] px-2 py-2.5 align-top">
                        <DispositionBadge disposition={item.disposition} />
                        <div className="mt-1 truncate text-[10px] text-[#475569]">
                          {item.rationaleTags[0] ?? 'Balanced fit'}
                        </div>
                      </td>
                      <td className="tabular-mono px-2 py-2.5 text-right align-top font-medium text-[#0369A1] whitespace-nowrap">
                        {formatUsd(proj?.steadyStateMonthlyCloudUsd ?? w.monthlyOnPremCostUsd)}
                        {proj && proj.monthlyDeltaUsd > 0 && (
                          <div className="text-[10px] text-[#047857]">
                            -{formatUsd(proj.monthlyDeltaUsd)}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 align-top whitespace-nowrap">
                        <span
                          className={`tabular-mono inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${
                            item.blockedByCycle
                              ? 'border-[#DC2626]/40 bg-[#FEF2F2] text-[#DC2626]'
                              : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A]'
                          }`}
                        >
                          W{item.waveIndex}
                          {item.sccId ? ` (${item.sccId})` : ''}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="tabular-mono text-[11px] font-medium text-[#0F172A]">
                            {item.confidencePct}%
                          </span>
                          <RiskBadge risk={item.riskLevel} />
                        </div>
                        <div className="tabular-mono mt-0.5 text-[10px] text-[#475569]">
                          {item.complexityPoints} pts
                        </div>
                      </td>
                      <td
                        className="py-2.5 pl-2 pr-3 text-right align-top whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(w)}
                            aria-label={`Edit ${w.id}`}
                            className="rounded border border-[#E2E8F0] p-1 text-[#475569] hover:border-[#0369A1] hover:text-[#0369A1]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onInspectInDag(w.id)}
                            aria-label={`View ${w.id} in Dependency DAG`}
                            className="rounded border border-[#E2E8F0] p-1 text-[#475569] hover:border-[#0369A1] hover:text-[#0369A1]"
                          >
                            <GitBranch className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workload Inspector & Editor Slide-Over */}
      {drawerOpen && draft && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/35"
          role="dialog"
          aria-modal="true"
          aria-label={editingOriginalId ? `Edit Workload ${editingOriginalId}` : 'Add Workload'}
        >
          <div className="flex h-full w-full max-w-xl flex-col border-l border-[#CBD5E1] bg-[#FFFFFF]">
            <div className="flex items-center justify-between border-b border-[#CBD5E1] bg-[#EEF2F6] px-5 py-3.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                  {editingOriginalId ? 'Workload Assessment Inspector' : 'New Portfolio Workload'}
                </div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {editingOriginalId ? `${draft.id} -- ${draft.name}` : 'Add Workload Specification'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close inspector"
                className="rounded border border-[#CBD5E1] bg-[#FFFFFF] p-1.5 text-[#475569] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDraft} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {selectedAssessment && (
                <div className="rounded border border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DispositionBadge disposition={selectedAssessment.disposition} />
                      <span className="tabular-mono text-xs font-semibold text-[#0F172A]">
                        {selectedAssessment.confidencePct}% confidence
                      </span>
                      <span className="tabular-mono text-xs text-[#475569]">
                        Wave {selectedAssessment.waveIndex} &middot;{' '}
                        {selectedAssessment.complexityPoints} pts
                      </span>
                    </div>
                    <RiskBadge risk={selectedAssessment.riskLevel} />
                  </div>

                  {/* 6R Weighted Score Breakdown */}
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {ALL_DISPOSITIONS.map((strategy) => {
                      const val = selectedAssessment.scores[strategy];
                      const isWinner = selectedAssessment.disposition === strategy;
                      return (
                        <div key={strategy} className="text-[11px]">
                          <div className="flex justify-between">
                            <span
                              className={
                                isWinner ? 'font-semibold text-[#0369A1]' : 'text-[#475569]'
                              }
                            >
                              {strategy}
                            </span>
                            <span className="tabular-mono font-semibold text-[#0F172A]">
                              {val}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-[#E2E8F0]">
                            <div
                              className={isWinner ? 'h-full bg-[#0369A1]' : 'h-full bg-[#94A3B8]'}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedAssessment.rationaleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-0.5 text-[10px] font-medium text-[#475569]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded border border-[#DC2626]/40 bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Workload ID *</span>
                  <input
                    type="text"
                    value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                    required
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Application Name *</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                    required
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Domain</span>
                  <input
                    type="text"
                    value={draft.domain}
                    onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                    className="mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Operating System</span>
                  <input
                    type="text"
                    value={draft.os}
                    onChange={(e) => setDraft({ ...draft, os: e.target.value })}
                    className="mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Compliance Tier</span>
                  <select
                    value={draft.complianceTier}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        complianceTier: e.target.value as ComplianceTier,
                      })
                    }
                    className="mt-1 w-full rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="SOC2">SOC2</option>
                    <option value="ISO-27001">ISO-27001</option>
                    <option value="PCI-DSS">PCI-DSS</option>
                    <option value="HIPAA">HIPAA</option>
                  </select>
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">DB Coupling</span>
                  <select
                    value={draft.dbCoupling}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dbCoupling: e.target.value as DbCouplingLevel,
                      })
                    }
                    className="mt-1 w-full rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  >
                    <option value="None">None (Stateless)</option>
                    <option value="Loose">Loose</option>
                    <option value="Tight">Tight</option>
                    <option value="Mainframe">Mainframe</option>
                  </select>
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Criticality</span>
                  <select
                    value={draft.criticality}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        criticality: e.target.value as CriticalityTier,
                      })
                    }
                    className="mt-1 w-full rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  >
                    <option value="Tier-1">Tier-1 (Mission Critical)</option>
                    <option value="Tier-2">Tier-2 (Business Core)</option>
                    <option value="Tier-3">Tier-3 (Supporting)</option>
                  </select>
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Monthly On-Prem Cost ($)</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={draft.monthlyOnPremCostUsd}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        monthlyOnPremCostUsd: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">vCPUs</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.vcpus}
                    onChange={(e) =>
                      setDraft({ ...draft, vcpus: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">RAM (GB)</span>
                  <input
                    type="number"
                    min={2}
                    value={draft.ramGb}
                    onChange={(e) =>
                      setDraft({ ...draft, ramGb: Math.max(2, Number(e.target.value) || 2) })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">CPU Utilization (%)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.cpuUtilPct}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        cpuUtilPct: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Storage (TB)</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={draft.storageTb}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        storageTb: Math.max(0.1, Number(e.target.value) || 0.1),
                      })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Cloud Readiness (1-100)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.cloudReadinessScore}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        cloudReadinessScore: Math.min(
                          100,
                          Math.max(1, Number(e.target.value) || 1)
                        ),
                      })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-semibold text-[#0F172A]">Business Value (1-100)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.businessValueScore}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        businessValueScore: Math.min(
                          100,
                          Math.max(1, Number(e.target.value) || 1)
                        ),
                      })
                    }
                    className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="font-semibold text-[#0F172A]">
                  Upstream Dependencies (comma or semicolon separated IDs)
                </span>
                <input
                  type="text"
                  value={depsText}
                  onChange={(e) => setDepsText(e.target.value)}
                  placeholder="e.g. RET-01, RET-02"
                  className="tabular-mono mt-1 w-full rounded border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:border-[#0369A1] focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.eolOs}
                    onChange={(e) => setDraft({ ...draft, eolOs: e.target.checked })}
                    className="accent-[#DC2626]"
                  />
                  <span>End-of-Life (EOL) OS</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.hasSaasEquivalent}
                    onChange={(e) =>
                      setDraft({ ...draft, hasSaasEquivalent: e.target.checked })
                    }
                    className="accent-[#0369A1]"
                  />
                  <span>Commercial SaaS Fit</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.regulatoryResidencyLock}
                    onChange={(e) =>
                      setDraft({ ...draft, regulatoryResidencyLock: e.target.checked })
                    }
                    className="accent-[#0369A1]"
                  />
                  <span>Residency / Edge Lock</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.decommissionCandidate}
                    onChange={(e) =>
                      setDraft({ ...draft, decommissionCandidate: e.target.checked })
                    }
                    className="accent-[#047857]"
                  />
                  <span>Decommission Candidate</span>
                </label>
              </div>
              </div>

              <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-[#E2E8F0] bg-[#FFFFFF] px-5 py-3.5">
                {editingOriginalId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteWorkload(editingOriginalId);
                      setDrawerOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-[#DC2626]/40 px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Workload
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded border border-[#0369A1] bg-[#0369A1] px-4 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#025582]"
                  >
                    Apply &amp; Recompute
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
