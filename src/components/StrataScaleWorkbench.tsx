'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  FileSpreadsheet,
  GitBranch,
  Layers3,
  LineChart,
  Menu,
  Presentation,
  X,
} from 'lucide-react';
import { DependencyDagView } from '@/components/DependencyDagView';
import { FinopsSimulatorView } from '@/components/FinopsSimulatorView';
import { IngestionSchemaView } from '@/components/IngestionSchemaView';
import { PortfolioMatrixView } from '@/components/PortfolioMatrixView';
import { clonePortfolioWorkloads, SEEDED_PORTFOLIOS } from '@/data/portfolios';
import { DEFAULT_FINOPS_ASSUMPTIONS, runFinopsSimulation } from '@/lib/finopsEngine';
import { formatCompactUsd } from '@/lib/formatters';
import { analyzePortfolioMigration } from '@/lib/migrationEngine';
import type {
  FinopsAssumptions,
  PortfolioSeed,
  Workload,
  WorkspaceView,
} from '@/types/stratascale';

interface CustomPortfolioState {
  id: string;
  name: string;
  workloads: Workload[];
}

const NAV_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'matrix',
    label: 'Portfolio Matrix',
    shortDesc: '6R scoring & specs',
    icon: Layers3,
  },
  {
    id: 'dag',
    label: 'Dependency DAG',
    shortDesc: 'Waves & SCC cycles',
    icon: GitBranch,
  },
  {
    id: 'finops',
    label: 'FinOps Simulator',
    shortDesc: '3-yr TCO & carbon',
    icon: LineChart,
  },
  {
    id: 'ingestion',
    label: 'Ingestion & Schema',
    shortDesc: 'CSV / XLSX mapper',
    icon: DatabaseZap,
  },
];

export function StrataScaleWorkbench() {
  const [activeView, setActiveView] = useState<WorkspaceView>('matrix');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    SEEDED_PORTFOLIOS[0].id
  );
  const [customPortfolio, setCustomPortfolio] = useState<CustomPortfolioState | null>(
    null
  );
  const [editedWorkloadsByPortfolio, setEditedWorkloadsByPortfolio] = useState<
    Record<string, Workload[]>
  >({});
  const [cycleEnabledByPortfolio, setCycleEnabledByPortfolio] = useState<
    Record<string, boolean>
  >({});
  const [assumptions, setAssumptions] = useState<FinopsAssumptions>(
    DEFAULT_FINOPS_ASSUMPTIONS
  );
  const [selectedDagNodeId, setSelectedDagNodeId] = useState<string | null>(null);

  const [exportingType, setExportingType] = useState<'xlsx' | 'pptx' | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const activeSeed: PortfolioSeed | null = useMemo(
    () => SEEDED_PORTFOLIOS.find((p) => p.id === selectedPortfolioId) ?? null,
    [selectedPortfolioId]
  );

  const activePortfolioName = useMemo(() => {
    if (selectedPortfolioId === 'custom' && customPortfolio) {
      return `${customPortfolio.name} (${customPortfolio.workloads.length} apps)`;
    }
    return activeSeed?.name ?? SEEDED_PORTFOLIOS[0].name;
  }, [activeSeed, customPortfolio, selectedPortfolioId]);

  const activePortfolioSector = useMemo(() => {
    if (selectedPortfolioId === 'custom' && customPortfolio) {
      return 'Uploaded Custom Portfolio';
    }
    return activeSeed?.sector ?? 'Enterprise Portfolio';
  }, [activeSeed, customPortfolio, selectedPortfolioId]);

  const cycleTestActive = Boolean(cycleEnabledByPortfolio[selectedPortfolioId]);
  const isDirty = Boolean(editedWorkloadsByPortfolio[selectedPortfolioId]);

  const activeWorkloads = useMemo(() => {
    const customOverride = editedWorkloadsByPortfolio[selectedPortfolioId];
    if (customOverride) {
      return clonePortfolioWorkloads(
        customOverride,
        activeSeed?.cycleTestEdges ?? [],
        cycleTestActive
      );
    }
    if (selectedPortfolioId === 'custom' && customPortfolio) {
      return clonePortfolioWorkloads(customPortfolio.workloads);
    }
    const base = activeSeed?.workloads ?? SEEDED_PORTFOLIOS[0].workloads;
    return clonePortfolioWorkloads(
      base,
      activeSeed?.cycleTestEdges ?? [],
      cycleTestActive
    );
  }, [
    activeSeed,
    customPortfolio,
    cycleTestActive,
    editedWorkloadsByPortfolio,
    selectedPortfolioId,
  ]);

  const analysis = useMemo(
    () => analyzePortfolioMigration(activeWorkloads),
    [activeWorkloads]
  );

  const finops = useMemo(
    () => runFinopsSimulation(analysis, assumptions),
    [analysis, assumptions]
  );

  function getMutableBaseWorkloads(): Workload[] {
    const existing = editedWorkloadsByPortfolio[selectedPortfolioId];
    if (existing) return existing.map((w) => ({ ...w, dependencies: [...w.dependencies] }));
    if (selectedPortfolioId === 'custom' && customPortfolio) {
      return customPortfolio.workloads.map((w) => ({
        ...w,
        dependencies: [...w.dependencies],
      }));
    }
    return (activeSeed?.workloads ?? SEEDED_PORTFOLIOS[0].workloads).map((w) => ({
      ...w,
      dependencies: [...w.dependencies],
    }));
  }

  function handleUpsertWorkload(workload: Workload, originalId?: string) {
    const list = getMutableBaseWorkloads();
    if (originalId) {
      const idx = list.findIndex((w) => w.id === originalId);
      const renamed = originalId !== workload.id;
      const updated = list.map((w, i) => {
        if (i === idx) return workload;
        if (renamed) {
          return {
            ...w,
            dependencies: w.dependencies.map((d) =>
              d === originalId ? workload.id : d
            ),
          };
        }
        return w;
      });
      setEditedWorkloadsByPortfolio((prev) => ({
        ...prev,
        [selectedPortfolioId]: updated,
      }));
    } else {
      setEditedWorkloadsByPortfolio((prev) => ({
        ...prev,
        [selectedPortfolioId]: [workload, ...list],
      }));
    }
  }

  function handleDeleteWorkload(id: string) {
    const list = getMutableBaseWorkloads()
      .filter((w) => w.id !== id)
      .map((w) => ({
        ...w,
        dependencies: w.dependencies.filter((d) => d !== id),
      }));
    setEditedWorkloadsByPortfolio((prev) => ({
      ...prev,
      [selectedPortfolioId]: list,
    }));
    if (selectedDagNodeId === id) {
      setSelectedDagNodeId(null);
    }
  }

  function handleResetPortfolio() {
    setEditedWorkloadsByPortfolio((prev) => {
      const copy = { ...prev };
      delete copy[selectedPortfolioId];
      return copy;
    });
    setCycleEnabledByPortfolio((prev) => ({
      ...prev,
      [selectedPortfolioId]: false,
    }));
  }

  function handleToggleCycleTest() {
    setCycleEnabledByPortfolio((prev) => ({
      ...prev,
      [selectedPortfolioId]: !prev[selectedPortfolioId],
    }));
  }

  function handleApplyCustomPortfolio(name: string, workloads: Workload[]) {
    setCustomPortfolio({
      id: 'custom',
      name,
      workloads,
    });
    setEditedWorkloadsByPortfolio((prev) => {
      const copy = { ...prev };
      delete copy.custom;
      return copy;
    });
    setSelectedPortfolioId('custom');
    setSelectedDagNodeId(null);
    setActiveView('matrix');
  }

  async function handleExport(kind: 'xlsx' | 'pptx') {
    setExportingType(kind);
    setExportNotice(null);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioName: activePortfolioName,
          workloads: activeWorkloads,
          assumptions,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Export failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        match?.[1] ??
        (kind === 'xlsx'
          ? 'stratascale-assessment.xlsx'
          : 'stratascale-steering-deck.pptx');

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportNotice({
        type: 'success',
        message: `Exported ${filename} (${Math.round(blob.size / 1024)} KB).`,
      });
    } catch (err) {
      setExportNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Binary export failed.',
      });
    } finally {
      setExportingType(null);
    }
  }

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeView) ?? NAV_ITEMS[0];

  const renderNavContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Architectural Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-[#CBD5E1] px-4">
          {(!sidebarCollapsed || isMobile) && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-[#0369A1] bg-[#0369A1] text-[10px] font-bold text-[#FFFFFF]">
                  S
                </span>
                <span className="truncate text-sm font-bold tracking-tight text-[#0F172A]">
                  StrataScale
                </span>
              </div>
              <div className="tabular-mono mt-0.5 text-[10px] text-[#475569]">
                CLOUD LEDGER v1.0
              </div>
            </div>
          )}
          {sidebarCollapsed && !isMobile && (
            <span className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[#0369A1] bg-[#0369A1] text-[11px] font-bold text-[#FFFFFF]">
              S
            </span>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="rounded border border-[#CBD5E1] bg-[#FFFFFF] p-1 text-[#475569]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav aria-label="Workspace Views" className="space-y-1 p-2.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  if (isMobile) setMobileDrawerOpen(false);
                }}
                title={sidebarCollapsed && !isMobile ? item.label : undefined}
                className={`group flex w-full items-center gap-2.5 rounded border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-[#CBD5E1] border-l-[3px] border-l-[#0369A1] bg-[#FFFFFF] text-[#0369A1]'
                    : 'border-transparent text-[#475569] hover:border-[#CBD5E1]/60 hover:bg-[#FFFFFF]/70 hover:text-[#0F172A]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-[#0369A1]' : 'text-[#475569] group-hover:text-[#0F172A]'
                  }`}
                />
                {(!sidebarCollapsed || isMobile) && (
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-xs ${
                        active ? 'font-bold text-[#0F172A]' : 'font-semibold'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="truncate text-[10px] text-[#475569]">
                      {item.shortDesc}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Telemetry & Collapse Toggle */}
      <div className="border-t border-[#CBD5E1] p-3">
        {(!sidebarCollapsed || isMobile) && (
          <div className="mb-3 rounded border border-[#CBD5E1] bg-[#FFFFFF] p-2.5 text-[11px]">
            <div className="flex items-center justify-between text-[#475569]">
              <span>Active Scope</span>
              <span className="tabular-mono font-semibold text-[#0F172A]">
                {analysis.assessments.length} apps
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[#475569]">
              <span>Waves / Cycles</span>
              <span
                className={`tabular-mono font-semibold ${
                  analysis.graph.hasCycle ? 'text-[#DC2626]' : 'text-[#047857]'
                }`}
              >
                {analysis.graph.waves.length}W / {analysis.graph.cycleCount} SCC
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[#475569]">
              <span>3-Yr Net Delta</span>
              <span
                className={`tabular-mono font-semibold ${
                  finops.threeYearNetSavingsUsd >= 0
                    ? 'text-[#047857]'
                    : 'text-[#DC2626]'
                }`}
              >
                {formatCompactUsd(finops.threeYearNetSavingsUsd)}
              </span>
            </div>
          </div>
        )}

        {!isMobile && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A]"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse Rail</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Collapsible Left Vertical Navigation Rail (>=1024px) */}
      <aside
        aria-label="Primary Workspace Navigation"
        className={`hidden shrink-0 border-r border-[#CBD5E1] bg-[#EEF2F6] transition-[width] duration-150 lg:sticky lg:top-0 lg:block lg:h-screen ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[240px]'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Slide-Over Navigation Drawer (<1024px) */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
        >
          <div
            className="fixed inset-0 bg-[#0F172A]/40"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 h-full w-[260px] max-w-[85vw] border-r border-[#CBD5E1] bg-[#EEF2F6]">
            {renderNavContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Top Action Bar */}
        <header className="sticky top-0 z-30 border-b border-[#CBD5E1] bg-[#FFFFFF]/95 backdrop-blur-sm">
          <div className="flex flex-col gap-2.5 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open navigation menu"
                className="inline-flex shrink-0 items-center justify-center rounded border border-[#CBD5E1] bg-[#F8FAFC] p-1.5 text-[#0F172A] lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold text-[#0F172A] sm:text-base">
                    {activeNavMeta.label}
                  </h1>
                  <span className="tabular-mono hidden rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#475569] sm:inline-block">
                    {finops.region.id}
                  </span>
                </div>
                <p className="truncate text-[11px] text-[#475569]">
                  {activePortfolioSector} &middot; {activePortfolioName}
                </p>
              </div>
            </div>

            {/* Sticky Action Controls (Dataset Selector, Export .xlsx, Export .pptx) */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="sr-only">Select Portfolio Dataset</span>
                <select
                  value={selectedPortfolioId}
                  onChange={(e) => {
                    setSelectedPortfolioId(e.target.value);
                    setSelectedDagNodeId(null);
                  }}
                  aria-label="Dataset Selector"
                  className="max-w-full rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] focus:border-[#0369A1] focus:bg-[#FFFFFF] focus:outline-none"
                >
                  {SEEDED_PORTFOLIOS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {customPortfolio && (
                    <option value="custom">
                      Uploaded: {customPortfolio.name} ({customPortfolio.workloads.length} apps)
                    </option>
                  )}
                </select>
              </label>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => void handleExport('xlsx')}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#0369A1] hover:text-[#0369A1] disabled:opacity-60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#047857]" />
                {exportingType === 'xlsx' ? 'Generating .xlsx...' : 'Export .xlsx'}
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => void handleExport('pptx')}
                className="inline-flex items-center gap-1.5 rounded border border-[#0369A1] bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#025582] disabled:opacity-60"
              >
                <Presentation className="h-3.5 w-3.5" />
                {exportingType === 'pptx' ? 'Generating .pptx...' : 'Export .pptx'}
              </button>
            </div>
          </div>

          {exportNotice && (
            <div
              role="status"
              className={`flex items-center justify-between border-t px-4 py-1.5 text-xs sm:px-6 ${
                exportNotice.type === 'success'
                  ? 'border-[#047857]/20 bg-[#ECFDF5] text-[#047857]'
                  : 'border-[#DC2626]/20 bg-[#FEF2F2] text-[#DC2626]'
              }`}
            >
              <span>{exportNotice.message}</span>
              <button
                type="button"
                onClick={() => setExportNotice(null)}
                aria-label="Dismiss notification"
                className="ml-3 text-current opacity-75 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </header>

        {/* Active Workspace View */}
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
          {activeView === 'matrix' && (
            <PortfolioMatrixView
              portfolioName={activePortfolioName}
              workloads={activeWorkloads}
              analysis={analysis}
              finops={finops}
              cycleTestActive={cycleTestActive}
              cycleTestDescription={activeSeed?.cycleTestDescription}
              hasCycleTestOption={Boolean(activeSeed?.cycleTestEdges.length)}
              isDirty={isDirty}
              onToggleCycleTest={handleToggleCycleTest}
              onResetPortfolio={handleResetPortfolio}
              onUpsertWorkload={handleUpsertWorkload}
              onDeleteWorkload={handleDeleteWorkload}
              onInspectInDag={(id) => {
                setSelectedDagNodeId(id || null);
                setActiveView('dag');
              }}
            />
          )}

          {activeView === 'dag' && (
            <DependencyDagView
              analysis={analysis}
              finops={finops}
              selectedNodeId={selectedDagNodeId}
              onSelectNode={setSelectedDagNodeId}
              cycleTestActive={cycleTestActive}
              hasCycleTestOption={Boolean(activeSeed?.cycleTestEdges.length)}
              cycleTestDescription={activeSeed?.cycleTestDescription}
              onToggleCycleTest={handleToggleCycleTest}
            />
          )}

          {activeView === 'finops' && (
            <FinopsSimulatorView
              assumptions={assumptions}
              finops={finops}
              onChangeAssumptions={setAssumptions}
            />
          )}

          {activeView === 'ingestion' && (
            <IngestionSchemaView
              activeWorkloads={activeWorkloads}
              activePortfolioName={activePortfolioName}
              onApplyCustomPortfolio={handleApplyCustomPortfolio}
            />
          )}
        </main>

        {/* Persistent Workspace Footer */}
        <footer className="mt-auto border-t border-[#CBD5E1] bg-[#FFFFFF] px-4 py-3 text-xs sm:px-6">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[#475569]">
              StrataScale Architectural Cloud Ledger &middot; Deterministic 6R, Tarjan/Kahn DAG &amp; FinOps Engine
            </div>
            <div className="text-right">
              <a
                href="https://github.com/TejdeepKodati/stratascale"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#475569] transition-colors hover:text-[#0369A1] hover:underline"
              >
                {'made with \u2665 by Tejdeep'}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
