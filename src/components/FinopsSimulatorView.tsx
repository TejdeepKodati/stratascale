'use client';

import React, { useMemo, useState } from 'react';
import { Leaf, SlidersHorizontal } from 'lucide-react';
import { REGION_PROFILES } from '@/lib/finopsEngine';
import { formatCompactUsd, formatUsd } from '@/lib/formatters';
import type {
  CloudRegionId,
  CommitmentMix,
  FinopsAssumptions,
  FinopsSimulationResult,
} from '@/types/stratascale';

interface FinopsSimulatorViewProps {
  assumptions: FinopsAssumptions;
  finops: FinopsSimulationResult;
  onChangeAssumptions: (next: FinopsAssumptions) => void;
}

const REGION_ORDER: CloudRegionId[] = ['us-east-1', 'eu-central-1', 'ap-south-1'];

const MIX_PRESETS: Array<{ label: string; mix: CommitmentMix }> = [
  {
    label: 'Agile 70/30/0',
    mix: { onDemandPct: 70, oneYearSavingsPct: 30, threeYearReservedPct: 0 },
  },
  {
    label: 'Balanced 20/40/40',
    mix: { onDemandPct: 20, oneYearSavingsPct: 40, threeYearReservedPct: 40 },
  },
  {
    label: 'Committed 10/20/70',
    mix: { onDemandPct: 10, oneYearSavingsPct: 20, threeYearReservedPct: 70 },
  },
];

function rebalanceMix(
  current: CommitmentMix,
  changedKey: keyof CommitmentMix,
  rawVal: number
): CommitmentMix {
  const clamped = Math.max(0, Math.min(100, Math.round(rawVal)));
  const remaining = 100 - clamped;
  const otherKeys = (
    ['onDemandPct', 'oneYearSavingsPct', 'threeYearReservedPct'] as Array<
      keyof CommitmentMix
    >
  ).filter((k) => k !== changedKey);

  const [k1, k2] = otherKeys;
  const currentOtherSum = current[k1] + current[k2];

  let next1 = 0;
  let next2 = 0;
  if (currentOtherSum <= 0) {
    next1 = Math.floor(remaining / 2);
    next2 = remaining - next1;
  } else {
    next1 = Math.round((current[k1] / currentOtherSum) * remaining);
    next2 = remaining - next1;
  }

  return {
    ...current,
    [changedKey]: clamped,
    [k1]: Math.max(0, next1),
    [k2]: Math.max(0, next2),
  };
}

export function FinopsSimulatorView({
  assumptions,
  finops,
  onChangeAssumptions,
}: FinopsSimulatorViewProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const activeMonthPoint = useMemo(() => {
    const idx = hoveredMonth !== null ? hoveredMonth - 1 : 35;
    return finops.monthlySeries[idx] ?? finops.monthlySeries[finops.monthlySeries.length - 1];
  }, [finops.monthlySeries, hoveredMonth]);

  // SVG Chart geometry
  const chart = useMemo(() => {
    const W = 760;
    const H = 300;
    const padL = 68;
    const padR = 24;
    const padT = 20;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxCum = Math.max(
      1000,
      ...finops.monthlySeries.map((p) =>
        Math.max(p.cumulativeOnPremUsd, p.cumulativeCloudScenarioUsd)
      )
    );
    const yMax = Math.ceil((maxCum * 1.08) / 500000) * 500000 || maxCum * 1.1;

    const maxLabor = Math.max(
      1,
      ...finops.monthlySeries.map((p) => p.migrationLaborMonthlyUsd)
    );

    const xForMonth = (m: number) => padL + ((m - 1) / 35) * plotW;
    const yForVal = (val: number) => padT + plotH - (val / yMax) * plotH;

    const onPremPath = finops.monthlySeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForMonth(p.month).toFixed(1)} ${yForVal(p.cumulativeOnPremUsd).toFixed(1)}`)
      .join(' ');

    const cloudPath = finops.monthlySeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForMonth(p.month).toFixed(1)} ${yForVal(p.cumulativeCloudScenarioUsd).toFixed(1)}`)
      .join(' ');

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      value: Math.round(yMax * t),
      y: yForVal(yMax * t),
    }));

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      yMax,
      maxLabor,
      xForMonth,
      yForVal,
      onPremPath,
      cloudPath,
      yTicks,
    };
  }, [finops.monthlySeries]);

  const mix = finops.assumptions.commitmentMix;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      {/* Left Parameter Control Ledger */}
      <aside
        aria-label="FinOps Sizing Parameters"
        className="space-y-4 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-4"
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#0369A1]" />
            <h2 className="text-sm font-bold text-[#0F172A]">FinOps Sizing Controls</h2>
          </div>
          <span className="tabular-mono rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#475569]">
            36-Mo Model
          </span>
        </div>

        {/* Target Cloud Region */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
            Target Cloud Region (PUE &amp; Grid Carbon)
          </div>
          <div className="mt-2 space-y-2">
            {REGION_ORDER.map((regionId) => {
              const profile = REGION_PROFILES[regionId];
              const selected = assumptions.targetRegion === regionId;
              return (
                <button
                  key={regionId}
                  type="button"
                  onClick={() =>
                    onChangeAssumptions({ ...assumptions, targetRegion: regionId })
                  }
                  className={`w-full rounded border p-2.5 text-left transition-colors ${
                    selected
                      ? 'border-[#0369A1] bg-[#F0F9FF]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        selected ? 'text-[#0369A1]' : 'text-[#0F172A]'
                      }`}
                    >
                      {profile.name}
                    </span>
                    <span className="tabular-mono text-[11px] font-medium text-[#475569]">
                      {profile.costMultiplier.toFixed(2)}x cost
                    </span>
                  </div>
                  <div className="tabular-mono mt-1 flex items-center justify-between text-[11px] text-[#475569]">
                    <span>PUE {profile.pue.toFixed(2)}</span>
                    <span>{profile.gridCarbonKgPerKwh.toFixed(3)} kgCO2e/kWh</span>
                    <span>${profile.egressRatePerGbUsd.toFixed(3)}/GB</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compute Commitment Mix */}
        <div className="border-t border-[#E2E8F0] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              Compute Commitment Mix
            </span>
            <span className="tabular-mono text-[11px] font-semibold text-[#0369A1]">
              {mix.onDemandPct}/{mix.oneYearSavingsPct}/{mix.threeYearReservedPct}%
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {MIX_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onChangeAssumptions({
                    ...assumptions,
                    commitmentMix: preset.mix,
                  })
                }
                className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-[#475569] hover:border-[#0369A1] hover:text-[#0369A1]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {(
              [
                { key: 'onDemandPct', label: 'On-Demand (0% disc.)' },
                { key: 'oneYearSavingsPct', label: '1-Yr Savings Plan (32% disc.)' },
                { key: 'threeYearReservedPct', label: '3-Yr Reserved (56% disc.)' },
              ] as const
            ).map((item) => (
              <label key={item.key} className="block">
                <div className="flex justify-between">
                  <span className="text-[#475569]">{item.label}</span>
                  <span className="tabular-mono font-semibold text-[#0F172A]">
                    {mix[item.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={mix[item.key]}
                  onChange={(e) =>
                    onChangeAssumptions({
                      ...assumptions,
                      commitmentMix: rebalanceMix(mix, item.key, Number(e.target.value)),
                    })
                  }
                  className="ledger-range mt-1.5 w-full"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Right-Sizing Target Utilization */}
        <div className="border-t border-[#E2E8F0] pt-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0F172A]">
              Right-Sizing Target Utilization
            </span>
            <span className="tabular-mono font-semibold text-[#0369A1]">
              {assumptions.targetUtilizationPct}%
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={85}
            step={1}
            aria-label="Right-Sizing Target Utilization"
            value={assumptions.targetUtilizationPct}
            onChange={(e) =>
              onChangeAssumptions({
                ...assumptions,
                targetUtilizationPct: Number(e.target.value),
              })
            }
            className="ledger-range mt-2 w-full"
          />
          <div className="mt-1.5 flex justify-between text-[11px] text-[#475569]">
            <span>40% (Headroom)</span>
            <span className="tabular-mono font-medium text-[#0F172A]">
              {finops.rightSizingSummary.provisionedVcpus} &rarr;{' '}
              {finops.rightSizingSummary.rightSizedVcpus} vCPUs
            </span>
            <span>85% (Dense)</span>
          </div>
        </div>

        {/* Migration Contingency % */}
        <div className="border-t border-[#E2E8F0] pt-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0F172A]">Migration Contingency Buffer</span>
            <span className="tabular-mono font-semibold text-[#B45309]">
              {assumptions.contingencyPct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={35}
            step={1}
            aria-label="Migration Contingency Buffer"
            value={assumptions.contingencyPct}
            onChange={(e) =>
              onChangeAssumptions({
                ...assumptions,
                contingencyPct: Number(e.target.value),
              })
            }
            className="ledger-range mt-2 w-full"
          />
          <div className="mt-1.5 flex justify-between text-[11px] text-[#475569]">
            <span>0%</span>
            <span className="tabular-mono font-medium text-[#0F172A]">
              +{formatUsd(finops.totalContingencyUsd)} reserve
            </span>
            <span>35%</span>
          </div>
        </div>
      </aside>

      {/* Right Financial & Carbon Cashflow Ledger */}
      <div className="space-y-4">
        {/* Unified Headline Ledger Strip */}
        <section className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
          <div className="grid grid-cols-2 divide-x divide-y divide-[#E2E8F0] md:grid-cols-5 md:divide-y-0">
            <div className="p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                3-Yr On-Prem TCO
              </div>
              <div className="tabular-mono mt-1 text-lg font-bold text-[#0F172A]">
                {formatCompactUsd(finops.threeYearOnPremTcoUsd)}
              </div>
              <div className="tabular-mono text-[11px] text-[#475569]">
                {formatUsd(finops.steadyStateMonthlyOnPremUsd)}/mo base
              </div>
            </div>

            <div className="p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                3-Yr Cloud TCO
              </div>
              <div className="tabular-mono mt-1 text-lg font-bold text-[#0369A1]">
                {formatCompactUsd(finops.threeYearCloudTcoUsd)}
              </div>
              <div className="tabular-mono text-[11px] text-[#475569]">
                incl. {formatCompactUsd(finops.totalMigrationLaborUsd + finops.totalContingencyUsd)} labor
              </div>
            </div>

            <div className="p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Net 3-Yr Savings
              </div>
              <div
                className={`tabular-mono mt-1 text-lg font-bold ${
                  finops.threeYearNetSavingsUsd >= 0
                    ? 'text-[#047857]'
                    : 'text-[#DC2626]'
                }`}
              >
                {formatCompactUsd(finops.threeYearNetSavingsUsd)}
              </div>
              <div className="tabular-mono text-[11px] text-[#475569]">
                {finops.threeYearSavingsPct}% TCO delta
              </div>
            </div>

            <div className="p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Break-Even Point
              </div>
              <div className="tabular-mono mt-1 text-lg font-bold text-[#0F172A]">
                {finops.breakEvenMonth ? `Month ${finops.breakEvenMonth}` : '> 36 Mo'}
              </div>
              <div className="text-[11px] text-[#475569]">
                Cumulative payback
              </div>
            </div>

            <div className="col-span-2 p-3.5 md:col-span-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                <Leaf className="h-3.5 w-3.5 text-[#047857]" />
                Annual CO2e Delta
              </div>
              <div className="tabular-mono mt-1 text-lg font-bold text-[#047857]">
                -{finops.annualCo2eReductionTons} t
              </div>
              <div className="tabular-mono text-[11px] text-[#475569]">
                -{finops.co2eReductionPct}% vs on-prem
              </div>
            </div>
          </div>
        </section>

        {/* Interactive SVG 36-Month Cumulative Cashflow & Break-Even Chart */}
        <section className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#EEF2F6] px-4 py-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                36-Month Cumulative Cashflow &amp; Break-Even Trajectory
              </h3>
              <p className="text-[11px] text-[#475569]">
                Wave-phased cutover accounting for dual-run baseline, cloud savings, and one-time labor
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-[#475569]" />
                On-Premises Baseline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#0369A1]" />
                Cloud Scenario
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#B45309]/40" />
                Migration Labor
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chart.W} ${chart.H}`}
                role="img"
                aria-label="36-month cumulative TCO cashflow comparison chart"
                className="h-auto w-full min-w-[540px]"
              >
                {/* Horizontal gridlines & Y labels */}
                {chart.yTicks.map((tick) => (
                  <g key={tick.value}>
                    <line
                      x1={chart.padL}
                      y1={tick.y}
                      x2={chart.W - chart.padR}
                      y2={tick.y}
                      stroke="#E2E8F0"
                      strokeWidth={1}
                    />
                    <text
                      x={chart.padL - 8}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize={10}
                      fill="#475569"
                      style={{ fontFamily: 'var(--font-mono), monospace' }}
                    >
                      {formatCompactUsd(tick.value)}
                    </text>
                  </g>
                ))}

                {/* X-axis month ticks */}
                {[1, 6, 12, 18, 24, 30, 36].map((m) => (
                  <g key={m}>
                    <line
                      x1={chart.xForMonth(m)}
                      y1={chart.padT + chart.plotH}
                      x2={chart.xForMonth(m)}
                      y2={chart.padT + chart.plotH + 5}
                      stroke="#CBD5E1"
                    />
                    <text
                      x={chart.xForMonth(m)}
                      y={chart.padT + chart.plotH + 19}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#475569"
                      style={{ fontFamily: 'var(--font-mono), monospace' }}
                    >
                      M{m}
                    </text>
                  </g>
                ))}

                {/* Monthly Migration Labor Spike Bars along bottom */}
                {finops.monthlySeries.map((pt) => {
                  if (pt.migrationLaborMonthlyUsd <= 0) return null;
                  const barH = Math.max(
                    3,
                    (pt.migrationLaborMonthlyUsd / chart.maxLabor) * 52
                  );
                  const x = chart.xForMonth(pt.month) - 4;
                  const y = chart.padT + chart.plotH - barH;
                  return (
                    <rect
                      key={`labor-${pt.month}`}
                      x={x}
                      y={y}
                      width={8}
                      height={barH}
                      rx={1}
                      fill="#B45309"
                      fillOpacity={0.35}
                    />
                  );
                })}

                {/* Cumulative Lines */}
                <path
                  d={chart.onPremPath}
                  fill="none"
                  stroke="#475569"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <path
                  d={chart.cloudPath}
                  fill="none"
                  stroke="#0369A1"
                  strokeWidth={2.6}
                />

                {/* Break-Even Marker */}
                {finops.breakEvenMonth && (
                  <g>
                    <line
                      x1={chart.xForMonth(finops.breakEvenMonth)}
                      y1={chart.padT}
                      x2={chart.xForMonth(finops.breakEvenMonth)}
                      y2={chart.padT + chart.plotH}
                      stroke="#047857"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={chart.xForMonth(finops.breakEvenMonth)}
                      cy={chart.yForVal(
                        finops.monthlySeries[finops.breakEvenMonth - 1]
                          .cumulativeCloudScenarioUsd
                      )}
                      r={5}
                      fill="#047857"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <rect
                      x={Math.min(
                        chart.W - 120,
                        chart.xForMonth(finops.breakEvenMonth) + 6
                      )}
                      y={chart.padT + 4}
                      width={106}
                      height={20}
                      rx={3}
                      fill="#ECFDF5"
                      stroke="#047857"
                      strokeOpacity={0.4}
                    />
                    <text
                      x={Math.min(
                        chart.W - 114,
                        chart.xForMonth(finops.breakEvenMonth) + 12
                      )}
                      y={chart.padT + 17}
                      fontSize={10}
                      fontWeight={700}
                      fill="#047857"
                      style={{ fontFamily: 'var(--font-mono), monospace' }}
                    >
                      Break-Even M{finops.breakEvenMonth}
                    </text>
                  </g>
                )}

                {/* Hovered month crosshair */}
                {hoveredMonth !== null && (
                  <line
                    x1={chart.xForMonth(hoveredMonth)}
                    y1={chart.padT}
                    x2={chart.xForMonth(hoveredMonth)}
                    y2={chart.padT + chart.plotH}
                    stroke="#0369A1"
                    strokeOpacity={0.4}
                    strokeWidth={1}
                  />
                )}

                {/* Invisible interactive columns for Month 1..36 */}
                {finops.monthlySeries.map((pt) => {
                  const colW = chart.plotW / 35;
                  return (
                    <rect
                      key={`hit-${pt.month}`}
                      x={chart.xForMonth(pt.month) - colW / 2}
                      y={chart.padT}
                      width={colW}
                      height={chart.plotH}
                      fill="transparent"
                      onMouseEnter={() => setHoveredMonth(pt.month)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    />
                  );
                })}
              </svg>
            </div>

            {/* Interactive Month Readout Ledger Bar */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-xs sm:grid-cols-5">
              <div>
                <div className="text-[10px] uppercase text-[#475569]">
                  {hoveredMonth ? `Inspected Month ${activeMonthPoint.month}` : 'Horizon End (Month 36)'}
                </div>
                <div className="tabular-mono font-semibold text-[#0F172A]">
                  {activeMonthPoint.waveEvents.length > 0
                    ? activeMonthPoint.waveEvents.join(', ')
                    : 'Steady State'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#475569]">Monthly On-Prem</div>
                <div className="tabular-mono font-semibold text-[#0F172A]">
                  {formatUsd(activeMonthPoint.onPremMonthlyUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#475569]">Cloud + Labor/mo</div>
                <div className="tabular-mono font-semibold text-[#0369A1]">
                  {formatUsd(activeMonthPoint.totalCloudScenarioMonthlyUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#475569]">Cum. Cloud TCO</div>
                <div className="tabular-mono font-semibold text-[#0F172A]">
                  {formatCompactUsd(activeMonthPoint.cumulativeCloudScenarioUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#475569]">Cum. Net Delta</div>
                <div
                  className={`tabular-mono font-semibold ${
                    activeMonthPoint.cumulativeNetSavingsUsd >= 0
                      ? 'text-[#047857]'
                      : 'text-[#B45309]'
                  }`}
                >
                  {formatCompactUsd(activeMonthPoint.cumulativeNetSavingsUsd)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Component & Sustainability Ledger Tables */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
            <div className="border-b border-[#E2E8F0] bg-[#EEF2F6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              3-Year Cost Component Ledger
            </div>
            <table className="w-full border-collapse text-xs">
              <tbody className="divide-y divide-[#E2E8F0]">
                {[
                  {
                    label: 'Cloud Compute (Right-Sized + Commitment)',
                    value: finops.costBreakdown3Yr.computeUsd,
                  },
                  {
                    label: 'Cloud Block & Object Storage',
                    value: finops.costBreakdown3Yr.storageUsd,
                  },
                  {
                    label: 'Outbound Network Egress',
                    value: finops.costBreakdown3Yr.egressUsd,
                  },
                  {
                    label: 'SaaS Repurchase Licenses',
                    value: finops.costBreakdown3Yr.saasUsd,
                  },
                  {
                    label: 'Dual-Run & Retained On-Premises',
                    value: finops.costBreakdown3Yr.retainedOnPremUsd,
                  },
                  {
                    label: `Migration Labor + ${assumptions.contingencyPct}% Contingency`,
                    value: finops.costBreakdown3Yr.migrationLaborAndContingencyUsd,
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-2 text-[#475569]">{row.label}</td>
                    <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                      {formatUsd(row.value)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#F8FAFC] font-bold">
                  <td className="px-4 py-2.5 text-[#0F172A]">Total 3-Year Cloud Scenario</td>
                  <td className="tabular-mono px-4 py-2.5 text-right text-[#0369A1]">
                    {formatUsd(finops.threeYearCloudTcoUsd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
            <div className="border-b border-[#E2E8F0] bg-[#EEF2F6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Carbon-Aware Sizing &amp; Infrastructure Efficiency
            </div>
            <table className="w-full border-collapse text-xs">
              <tbody className="divide-y divide-[#E2E8F0]">
                <tr>
                  <td className="px-4 py-2 text-[#475569]">Provisioned vs Right-Sized vCPUs</td>
                  <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                    {finops.rightSizingSummary.provisionedVcpus} &rarr;{' '}
                    {finops.rightSizingSummary.rightSizedVcpus} (-
                    {finops.rightSizingSummary.vcpuReductionPct}%)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[#475569]">Provisioned vs Right-Sized RAM</td>
                  <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                    {finops.rightSizingSummary.provisionedRamGb} GB &rarr;{' '}
                    {finops.rightSizingSummary.rightSizedRamGb} GB
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[#475569]">Facility PUE Comparison</td>
                  <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                    1.67 (On-Prem) &rarr; {finops.region.pue.toFixed(2)} ({finops.region.id})
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[#475569]">Regional Grid Carbon Intensity</td>
                  <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                    {finops.region.gridCarbonKgPerKwh.toFixed(3)} kgCO2e/kWh
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[#475569]">Annual Emissions (On-Prem &rarr; Cloud)</td>
                  <td className="tabular-mono px-4 py-2 text-right font-semibold text-[#0F172A]">
                    {finops.annualCo2eBaselineTons} &rarr; {finops.annualCo2eCloudTons} tCO2e/yr
                  </td>
                </tr>
                <tr className="bg-[#ECFDF5] font-bold">
                  <td className="px-4 py-2.5 text-[#047857]">Annual Carbon Abatement</td>
                  <td className="tabular-mono px-4 py-2.5 text-right text-[#047857]">
                    -{finops.annualCo2eReductionTons} tCO2e/yr (-{finops.co2eReductionPct}%)
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
