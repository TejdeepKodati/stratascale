import PptxGenJS from 'pptxgenjs';
import type {
  Disposition6R,
  FinopsSimulationResult,
  PortfolioMigrationAnalysis,
} from '@/types/stratascale';

const C_CANVAS = 'F8FAFC';
const C_PAPER = 'FFFFFF';
const C_MUTED_BAND = 'EEF2F6';
const C_INK = '0F172A';
const C_MUTED_INK = '475569';
const C_BORDER = 'CBD5E1';
const C_COBALT = '0369A1';
const C_SAVINGS = '047857';
const C_CAUTION = 'B45309';
const C_DANGER = 'DC2626';

function fmtUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
}

function addSlideHeader(
  slide: PptxGenJS.Slide,
  pres: PptxGenJS,
  kicker: string,
  title: string,
  slideNum: number
) {
  slide.background = { color: C_CANVAS };

  // Top precision cobalt rule
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.08,
    fill: { color: C_COBALT },
    line: { type: 'none' },
  });

  slide.addText(kicker.toUpperCase(), {
    x: 0.55,
    y: 0.24,
    w: 9.0,
    h: 0.24,
    fontFace: 'Calibri',
    fontSize: 10,
    bold: true,
    color: C_COBALT,
    charSpacing: 1.5,
  });

  slide.addText(title, {
    x: 0.55,
    y: 0.48,
    w: 10.5,
    h: 0.45,
    fontFace: 'Calibri',
    fontSize: 22,
    bold: true,
    color: C_INK,
  });

  slide.addText(`STRATASCALE  |  SLIDE ${slideNum} / 5`, {
    x: 10.6,
    y: 0.28,
    w: 2.18,
    h: 0.28,
    fontFace: 'Consolas',
    fontSize: 9,
    color: C_MUTED_INK,
    align: 'right',
  });

  // Subtle separator line
  slide.addShape(pres.ShapeType.line, {
    x: 0.55,
    y: 1.0,
    w: 12.23,
    h: 0,
    line: { color: C_BORDER, pt: 1 },
  });
}

export async function generatePortfolioPptxBuffer(
  portfolioName: string,
  analysis: PortfolioMigrationAnalysis,
  finops: FinopsSimulationResult
): Promise<Uint8Array> {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'StrataScale Architectural Cloud Ledger';
  pres.subject = `Cloud Migration & FinOps Executive Review -- ${portfolioName}`;
  pres.title = `${portfolioName} -- Steering Committee Briefing`;

  const today = new Date().toISOString().split('T')[0];
  const mix = finops.assumptions.commitmentMix;

  // =========================================================================
  // SLIDE 1: Title Slide
  // =========================================================================
  const s1 = pres.addSlide();
  s1.background = { color: C_CANVAS };

  s1.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.28,
    h: 7.5,
    fill: { color: C_INK },
    line: { type: 'none' },
  });
  s1.addShape(pres.ShapeType.rect, {
    x: 0.28,
    y: 0,
    w: 0.08,
    h: 7.5,
    fill: { color: C_COBALT },
    line: { type: 'none' },
  });

  s1.addText('EXECUTIVE STEERING COMMITTEE BRIEFING', {
    x: 0.85,
    y: 0.9,
    w: 11.4,
    h: 0.3,
    fontFace: 'Calibri',
    fontSize: 11,
    bold: true,
    color: C_COBALT,
    charSpacing: 2,
  });

  s1.addText(portfolioName, {
    x: 0.85,
    y: 1.35,
    w: 11.4,
    h: 0.9,
    fontFace: 'Calibri',
    fontSize: 34,
    bold: true,
    color: C_INK,
  });

  s1.addText(
    'Enterprise Cloud Migration Disposition, Topological Wave Plan & 3-Year FinOps Cashflow Assessment',
    {
      x: 0.85,
      y: 2.28,
      w: 11.0,
      h: 0.5,
      fontFace: 'Calibri',
      fontSize: 16,
      color: C_MUTED_INK,
    }
  );

  // Scope parameter strip
  s1.addShape(pres.ShapeType.rect, {
    x: 0.85,
    y: 3.1,
    w: 11.7,
    h: 0.82,
    fill: { color: C_PAPER },
    line: { color: C_BORDER, pt: 1 },
  });
  s1.addText(
    `Region: ${finops.region.name}   |   Right-Sizing Target: ${finops.assumptions.targetUtilizationPct}%   |   Commitment Mix: ${mix.onDemandPct}% OD / ${mix.oneYearSavingsPct}% 1Y SP / ${mix.threeYearReservedPct}% 3Y RI   |   Contingency: ${finops.assumptions.contingencyPct}%`,
    {
      x: 1.05,
      y: 3.25,
      w: 11.3,
      h: 0.5,
      fontFace: 'Consolas',
      fontSize: 10.5,
      color: C_INK,
      valign: 'middle',
    }
  );

  // 4 Ledger Metric Boxes on Title Slide
  const titleMetrics = [
    {
      label: '3-YEAR NET TCO SAVINGS',
      value: fmtUsd(finops.threeYearNetSavingsUsd),
      sub: `${finops.threeYearSavingsPct}% reduction vs baseline`,
      accent: finops.threeYearNetSavingsUsd >= 0 ? C_SAVINGS : C_DANGER,
    },
    {
      label: 'BREAK-EVEN HORIZON',
      value: finops.breakEvenMonth ? `Month ${finops.breakEvenMonth}` : '> 36 Months',
      sub: `Investment: ${fmtUsd(finops.totalMigrationLaborUsd + finops.totalContingencyUsd)}`,
      accent: C_COBALT,
    },
    {
      label: 'TOPOLOGICAL WAVES',
      value: `${analysis.graph.waves.length} Waves`,
      sub: analysis.graph.hasCycle
        ? `${analysis.graph.cycleCount} SCC cycle blocker(s)`
        : `${analysis.assessments.length} apps, 0 cycles`,
      accent: analysis.graph.hasCycle ? C_DANGER : C_SAVINGS,
    },
    {
      label: 'ANNUAL CARBON DELTA',
      value: `-${finops.annualCo2eReductionTons} tCO2e`,
      sub: `${finops.co2eReductionPct}% footprint reduction/yr`,
      accent: C_SAVINGS,
    },
  ];

  titleMetrics.forEach((m, i) => {
    const boxX = 0.85 + i * 2.98;
    s1.addShape(pres.ShapeType.rect, {
      x: boxX,
      y: 4.35,
      w: 2.76,
      h: 1.65,
      fill: { color: C_PAPER },
      line: { color: C_BORDER, pt: 1 },
    });
    s1.addShape(pres.ShapeType.rect, {
      x: boxX,
      y: 4.35,
      w: 2.76,
      h: 0.06,
      fill: { color: m.accent },
      line: { type: 'none' },
    });
    s1.addText(m.label, {
      x: boxX + 0.16,
      y: 4.52,
      w: 2.44,
      h: 0.25,
      fontFace: 'Calibri',
      fontSize: 9,
      bold: true,
      color: C_MUTED_INK,
    });
    s1.addText(m.value, {
      x: boxX + 0.16,
      y: 4.86,
      w: 2.44,
      h: 0.48,
      fontFace: 'Consolas',
      fontSize: 20,
      bold: true,
      color: m.accent,
    });
    s1.addText(m.sub, {
      x: boxX + 0.16,
      y: 5.42,
      w: 2.44,
      h: 0.38,
      fontFace: 'Calibri',
      fontSize: 10,
      color: C_MUTED_INK,
    });
  });

  s1.addText(`Generated by StrataScale Assessment Workbench  |  ${today}`, {
    x: 0.85,
    y: 6.75,
    w: 11.7,
    h: 0.3,
    fontFace: 'Calibri',
    fontSize: 10,
    color: C_MUTED_INK,
  });

  // =========================================================================
  // SLIDE 2: Portfolio 6R Breakdown
  // =========================================================================
  const s2 = pres.addSlide();
  addSlideHeader(
    s2,
    pres,
    'Application Rationalization',
    'Portfolio 6R Disposition & Monthly Spend Shift',
    2
  );

  const dispositions: Disposition6R[] = [
    'Rehost',
    'Replatform',
    'Refactor',
    'Repurchase',
    'Retire',
    'Retain',
  ];

  const sixRRows: PptxGenJS.TableRow[] = [
    [
      { text: '6R Strategy', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Apps', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'Share %', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'On-Prem $/mo', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'Cloud $/mo', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'Avg Cplx', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
    ],
  ];

  const onPremChartVals: number[] = [];
  const cloudChartVals: number[] = [];

  for (const disp of dispositions) {
    const items = analysis.assessments.filter((a) => a.disposition === disp);
    const count = items.length;
    const share =
      analysis.assessments.length > 0
        ? `${Math.round((count / analysis.assessments.length) * 100)}%`
        : '0%';
    const onPrem = items.reduce((s, a) => s + a.workload.monthlyOnPremCostUsd, 0);
    const cloud = items.reduce(
      (s, a) => s + (finops.projectionById[a.workload.id]?.steadyStateMonthlyCloudUsd ?? 0),
      0
    );
    const avgCplx =
      count > 0
        ? (items.reduce((s, a) => s + a.complexityPoints, 0) / count).toFixed(1)
        : '0.0';

    onPremChartVals.push(Math.round(onPrem / 1000));
    cloudChartVals.push(Math.round(cloud / 1000));

    sixRRows.push([
      { text: disp, options: { bold: true, color: C_INK } },
      { text: String(count), options: { align: 'right', fontFace: 'Consolas' } },
      { text: share, options: { align: 'right', fontFace: 'Consolas' } },
      { text: fmtUsd(onPrem), options: { align: 'right', fontFace: 'Consolas' } },
      { text: fmtUsd(cloud), options: { align: 'right', fontFace: 'Consolas', color: C_COBALT } },
      { text: avgCplx, options: { align: 'right', fontFace: 'Consolas' } },
    ]);
  }

  sixRRows.push([
    { text: 'TOTAL PORTFOLIO', options: { bold: true, fill: { color: C_MUTED_BAND } } },
    { text: String(analysis.assessments.length), options: { bold: true, align: 'right', fontFace: 'Consolas', fill: { color: C_MUTED_BAND } } },
    { text: '100%', options: { bold: true, align: 'right', fontFace: 'Consolas', fill: { color: C_MUTED_BAND } } },
    { text: fmtUsd(finops.steadyStateMonthlyOnPremUsd), options: { bold: true, align: 'right', fontFace: 'Consolas', fill: { color: C_MUTED_BAND } } },
    { text: fmtUsd(finops.steadyStateMonthlyCloudUsd), options: { bold: true, align: 'right', fontFace: 'Consolas', color: C_SAVINGS, fill: { color: C_MUTED_BAND } } },
    { text: '-', options: { align: 'right', fill: { color: C_MUTED_BAND } } },
  ]);

  s2.addTable(sixRRows, {
    x: 0.55,
    y: 1.25,
    w: 6.75,
    colW: [1.45, 0.75, 0.9, 1.35, 1.35, 0.95],
    border: { type: 'solid', color: C_BORDER, pt: 0.75 },
    fontFace: 'Calibri',
    fontSize: 10.5,
    fill: { color: C_PAPER },
    rowH: 0.44,
    valign: 'middle',
  });

  // Right chart comparing On-Prem vs Cloud Monthly Spend ($K)
  s2.addShape(pres.ShapeType.rect, {
    x: 7.55,
    y: 1.25,
    w: 5.23,
    h: 4.15,
    fill: { color: C_PAPER },
    line: { color: C_BORDER, pt: 1 },
  });
  s2.addChart(
    pres.ChartType.bar,
    [
      { name: 'On-Prem ($K/mo)', labels: dispositions, values: onPremChartVals },
      { name: 'Cloud Target ($K/mo)', labels: dispositions, values: cloudChartVals },
    ],
    {
      x: 7.68,
      y: 1.4,
      w: 4.98,
      h: 3.85,
      barDir: 'col',
      barGrouping: 'clustered',
      chartColors: ['94A3B8', C_COBALT],
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Monthly Run-Rate by 6R ($K)',
      titleFontSize: 11,
      titleColor: C_INK,
      valAxisLabelFormatCode: '$#,##0"K"',
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
    }
  );

  // Executive Insight Strip at bottom of Slide 2
  s2.addShape(pres.ShapeType.rect, {
    x: 0.55,
    y: 5.65,
    w: 12.23,
    h: 1.3,
    fill: { color: C_PAPER },
    line: { color: C_BORDER, pt: 1 },
  });
  s2.addText(
    `Portfolio Summary: Steady-state monthly run-rate drops from ${fmtUsd(finops.steadyStateMonthlyOnPremUsd)}/mo to ${fmtUsd(finops.steadyStateMonthlyCloudUsd)}/mo (saving ${fmtUsd(finops.steadyStateMonthlySavingsUsd)}/mo) via ${finops.rightSizingSummary.vcpuReductionPct}% vCPU right-sizing (${finops.rightSizingSummary.provisionedVcpus} -> ${finops.rightSizingSummary.rightSizedVcpus} vCPUs) plus ${analysis.dispositionCounts.Retire} retired and ${analysis.dispositionCounts.Repurchase} SaaS-replaced workloads.`,
    {
      x: 0.78,
      y: 5.82,
      w: 11.75,
      h: 0.95,
      fontFace: 'Calibri',
      fontSize: 12,
      color: C_INK,
      valign: 'middle',
    }
  );

  // =========================================================================
  // SLIDE 3: Dependency Wave Roadmap
  // =========================================================================
  const s3 = pres.addSlide();
  addSlideHeader(
    s3,
    pres,
    'Execution Sequencing (Tarjan SCC + Kahn Topological Sort)',
    'Dependency-Ordered Migration Wave Roadmap',
    3
  );

  const cycleAlertColor = analysis.graph.hasCycle ? C_DANGER : C_SAVINGS;
  const cycleAlertBg = analysis.graph.hasCycle ? 'FEF2F2' : 'ECFDF5';
  s3.addShape(pres.ShapeType.rect, {
    x: 0.55,
    y: 1.18,
    w: 12.23,
    h: 0.62,
    fill: { color: cycleAlertBg },
    line: { color: cycleAlertColor, pt: 1 },
  });
  s3.addText(
    analysis.graph.hasCycle
      ? `CYCLE BLOCKER DETECTED: ${analysis.graph.cycleCount} Strongly Connected Component(s) affecting ${analysis.graph.cyclicNodeIds.length} workloads (${analysis.graph.cyclicNodeIds.join(', ')}). Decoupling required prior to wave cutover.`
      : `TOPOLOGY VERIFIED: Zero circular dependencies detected across ${analysis.assessments.length} workloads and ${analysis.graph.allEdges.length} dependency edges (${analysis.graph.waves.length} clean topological waves).`,
    {
      x: 0.75,
      y: 1.24,
      w: 11.85,
      h: 0.5,
      fontFace: 'Calibri',
      fontSize: 11,
      bold: true,
      color: cycleAlertColor,
      valign: 'middle',
    }
  );

  const waveRows: PptxGenJS.TableRow[] = [
    [
      { text: 'Wave', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Apps', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'Workloads in Topological Sequence', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Complexity', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'On-Prem Exit ($/mo)', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
      { text: 'Wave Status', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
    ],
  ];

  analysis.graph.waves.slice(0, 7).forEach((wave) => {
    waveRows.push([
      { text: `Wave ${wave.waveIndex}`, options: { bold: true, fontFace: 'Consolas', color: C_INK } },
      { text: String(wave.nodeIds.length), options: { align: 'right', fontFace: 'Consolas' } },
      { text: wave.nodeIds.join(', '), options: { fontFace: 'Consolas', fontSize: 9.5 } },
      { text: `${wave.totalComplexityPoints} pts`, options: { align: 'right', fontFace: 'Consolas' } },
      { text: fmtUsd(wave.totalMonthlyOnPremUsd), options: { align: 'right', fontFace: 'Consolas' } },
      {
        text: wave.hasCycleNode ? 'Cycle Blocked' : 'Ready',
        options: {
          bold: true,
          color: wave.hasCycleNode ? C_DANGER : C_SAVINGS,
        },
      },
    ]);
  });

  s3.addTable(waveRows, {
    x: 0.55,
    y: 2.02,
    w: 12.23,
    colW: [1.15, 0.75, 5.78, 1.35, 1.75, 1.45],
    border: { type: 'solid', color: C_BORDER, pt: 0.75 },
    fontFace: 'Calibri',
    fontSize: 10.5,
    fill: { color: C_PAPER },
    rowH: 0.52,
    valign: 'middle',
  });

  // Visual wave timeline tiles along bottom
  const shownWaves = analysis.graph.waves.slice(0, 5);
  const tileW = shownWaves.length > 0 ? (12.23 - (shownWaves.length - 1) * 0.18) / shownWaves.length : 12.23;
  shownWaves.forEach((wave, i) => {
    const xPos = 0.55 + i * (tileW + 0.18);
    s3.addShape(pres.ShapeType.rect, {
      x: xPos,
      y: 5.7,
      w: tileW,
      h: 1.25,
      fill: { color: C_PAPER },
      line: { color: wave.hasCycleNode ? C_DANGER : C_COBALT, pt: 1 },
    });
    s3.addText(
      `WAVE ${wave.waveIndex}  (${wave.nodeIds.length} apps)`,
      {
        x: xPos + 0.12,
        y: 5.8,
        w: tileW - 0.24,
        h: 0.28,
        fontFace: 'Consolas',
        fontSize: 10,
        bold: true,
        color: wave.hasCycleNode ? C_DANGER : C_COBALT,
      }
    );
    s3.addText(wave.nodeIds.slice(0, 6).join(', ') + (wave.nodeIds.length > 6 ? '...' : ''), {
      x: xPos + 0.12,
      y: 6.14,
      w: tileW - 0.24,
      h: 0.7,
      fontFace: 'Consolas',
      fontSize: 8.5,
      color: C_MUTED_INK,
      valign: 'top',
    });
  });

  // =========================================================================
  // SLIDE 4: 3-Year FinOps TCO & Break-Even
  // =========================================================================
  const s4 = pres.addSlide();
  addSlideHeader(
    s4,
    pres,
    'Financial & Carbon Modeling',
    '3-Year Cumulative Cashflow, Break-Even & Sustainability',
    4
  );

  // Sample months for clean chart labels
  const sampleMonths = [1, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const sampledPoints = sampleMonths.map(
    (m) => finops.monthlySeries[m - 1] ?? finops.monthlySeries[finops.monthlySeries.length - 1]
  );

  s4.addShape(pres.ShapeType.rect, {
    x: 0.55,
    y: 1.22,
    w: 7.55,
    h: 4.55,
    fill: { color: C_PAPER },
    line: { color: C_BORDER, pt: 1 },
  });

  s4.addChart(
    pres.ChartType.line,
    [
      {
        name: 'Cumulative On-Prem Baseline ($K)',
        labels: sampledPoints.map((p) => `M${p.month}`),
        values: sampledPoints.map((p) => Math.round(p.cumulativeOnPremUsd / 1000)),
      },
      {
        name: 'Cumulative Cloud Scenario ($K)',
        labels: sampledPoints.map((p) => `M${p.month}`),
        values: sampledPoints.map((p) => Math.round(p.cumulativeCloudScenarioUsd / 1000)),
      },
    ],
    {
      x: 0.68,
      y: 1.36,
      w: 7.28,
      h: 4.25,
      chartColors: ['64748B', C_COBALT],
      lineSize: 2.5,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: `36-Month Cumulative TCO Trajectory (Break-Even: ${finops.breakEvenMonth ? `Month ${finops.breakEvenMonth}` : '> 36 Mo'})`,
      titleFontSize: 11,
      titleColor: C_INK,
      valAxisLabelFormatCode: '$#,##0"K"',
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
    }
  );

  const finopsTableRows: PptxGenJS.TableRow[] = [
    [
      { text: '3-Year TCO Component', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Amount (USD)', options: { bold: true, color: C_PAPER, fill: { color: C_INK }, align: 'right' } },
    ],
    [
      { text: 'Baseline On-Premises TCO (36 mo)' },
      { text: fmtUsd(finops.threeYearOnPremTcoUsd), options: { align: 'right', fontFace: 'Consolas', bold: true } },
    ],
    [
      { text: 'Cloud Compute (Right-Sized + Commitments)' },
      { text: fmtUsd(finops.costBreakdown3Yr.computeUsd), options: { align: 'right', fontFace: 'Consolas' } },
    ],
    [
      { text: 'Cloud Storage & Egress' },
      {
        text: fmtUsd(finops.costBreakdown3Yr.storageUsd + finops.costBreakdown3Yr.egressUsd),
        options: { align: 'right', fontFace: 'Consolas' },
      },
    ],
    [
      { text: 'SaaS Repurchase & Retained On-Prem' },
      {
        text: fmtUsd(finops.costBreakdown3Yr.saasUsd + finops.costBreakdown3Yr.retainedOnPremUsd),
        options: { align: 'right', fontFace: 'Consolas' },
      },
    ],
    [
      { text: `Migration Labor + ${finops.assumptions.contingencyPct}% Contingency` },
      {
        text: fmtUsd(finops.costBreakdown3Yr.migrationLaborAndContingencyUsd),
        options: { align: 'right', fontFace: 'Consolas', color: C_CAUTION },
      },
    ],
    [
      { text: 'Total Cloud Scenario TCO (36 mo)', options: { bold: true, fill: { color: C_MUTED_BAND } } },
      {
        text: fmtUsd(finops.threeYearCloudTcoUsd),
        options: { bold: true, align: 'right', fontFace: 'Consolas', fill: { color: C_MUTED_BAND } },
      },
    ],
    [
      { text: 'Net 3-Year Savings', options: { bold: true, fill: { color: 'ECFDF5' } } },
      {
        text: `${fmtUsd(finops.threeYearNetSavingsUsd)} (${finops.threeYearSavingsPct}%)`,
        options: {
          bold: true,
          align: 'right',
          fontFace: 'Consolas',
          color: finops.threeYearNetSavingsUsd >= 0 ? C_SAVINGS : C_DANGER,
          fill: { color: 'ECFDF5' },
        },
      },
    ],
  ];

  s4.addTable(finopsTableRows, {
    x: 8.32,
    y: 1.22,
    w: 4.46,
    colW: [2.76, 1.7],
    border: { type: 'solid', color: C_BORDER, pt: 0.75 },
    fontFace: 'Calibri',
    fontSize: 10,
    fill: { color: C_PAPER },
    rowH: 0.48,
    valign: 'middle',
  });

  // Carbon Callout at bottom
  s4.addShape(pres.ShapeType.rect, {
    x: 0.55,
    y: 5.95,
    w: 12.23,
    h: 1.0,
    fill: { color: C_PAPER },
    line: { color: C_BORDER, pt: 1 },
  });
  s4.addText(
    `Carbon-Aware Sizing (${finops.region.name}): On-Prem PUE 1.67 (${finops.annualCo2eBaselineTons} tCO2e/yr) -> Cloud PUE ${finops.region.pue} at ${finops.region.gridCarbonKgPerKwh} kgCO2e/kWh (${finops.annualCo2eCloudTons} tCO2e/yr)  |  Annual Abatement: ${finops.annualCo2eReductionTons} tCO2e/yr (-${finops.co2eReductionPct}%)`,
    {
      x: 0.78,
      y: 6.1,
      w: 11.75,
      h: 0.7,
      fontFace: 'Calibri',
      fontSize: 11.5,
      bold: true,
      color: C_SAVINGS,
      valign: 'middle',
    }
  );

  // =========================================================================
  // SLIDE 5: Risk & EOL Mitigation Summary
  // =========================================================================
  const s5 = pres.addSlide();
  addSlideHeader(
    s5,
    pres,
    'Governance & Operational Readiness',
    'Risk Register, End-of-Life OS & Compliance Mitigation Plan',
    5
  );

  const priorityRisks = [...analysis.assessments]
    .filter(
      (a) =>
        a.workload.eolOs ||
        a.riskLevel === 'High' ||
        a.blockedByCycle ||
        a.workload.regulatoryResidencyLock
    )
    .sort((a, b) => Number(b.workload.eolOs) - Number(a.workload.eolOs) || b.complexityPoints - a.complexityPoints)
    .slice(0, 7);

  const riskRows: PptxGenJS.TableRow[] = [
    [
      { text: 'ID', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Workload Name', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'OS / EOL Status', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Compliance', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: '6R & Wave', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
      { text: 'Mitigation Action', options: { bold: true, color: C_PAPER, fill: { color: C_INK } } },
    ],
  ];

  for (const item of priorityRisks) {
    const mitigation = item.blockedByCycle
      ? 'Decouple SCC circular edge via async event interface before cutover.'
      : item.workload.eolOs
        ? `Prioritize OS upgrade or extended-support ${item.disposition} in Wave ${item.waveIndex}.`
        : item.workload.regulatoryResidencyLock
          ? 'Retain on-prem; expose standardized API gateway to cloud waves.'
          : `Execute ${item.workload.complianceTier} control validation ahead of Wave ${item.waveIndex}.`;

    riskRows.push([
      { text: item.workload.id, options: { bold: true, fontFace: 'Consolas' } },
      { text: item.workload.name },
      {
        text: `${item.workload.os}${item.workload.eolOs ? ' [EOL]' : ''}`,
        options: {
          color: item.workload.eolOs ? C_DANGER : C_INK,
          bold: item.workload.eolOs,
        },
      },
      { text: item.workload.complianceTier, options: { fontFace: 'Consolas', fontSize: 9.5 } },
      { text: `${item.disposition} / W${item.waveIndex}`, options: { fontFace: 'Consolas', fontSize: 9.5 } },
      { text: mitigation, options: { fontSize: 9.5, color: C_MUTED_INK } },
    ]);
  }

  if (priorityRisks.length === 0) {
    riskRows.push([
      { text: '-', options: { align: 'center' } },
      { text: 'No critical EOL, cycle, or high-risk blockers detected.' },
      { text: 'Supported' },
      { text: 'Standard' },
      { text: 'All Waves' },
      { text: 'Proceed with standard Wave 1 landing zone readiness checks.' },
    ]);
  }

  s5.addTable(riskRows, {
    x: 0.55,
    y: 1.25,
    w: 12.23,
    colW: [1.05, 2.75, 2.15, 1.3, 1.55, 3.43],
    border: { type: 'solid', color: C_BORDER, pt: 0.75 },
    fontFace: 'Calibri',
    fontSize: 10,
    fill: { color: C_PAPER },
    rowH: 0.56,
    valign: 'middle',
  });

  // Footer risk counters
  s5.addShape(pres.ShapeType.rect, {
    x: 0.55,
    y: 5.98,
    w: 12.23,
    h: 0.92,
    fill: { color: C_MUTED_BAND },
    line: { color: C_BORDER, pt: 1 },
  });
  s5.addText(
    `Risk Summary:  ${analysis.eolCount} End-of-Life OS Workloads   |   ${analysis.highRiskCount} High-Risk Workloads   |   ${analysis.assessments.filter((a) => a.workload.complianceTier === 'PCI-DSS' || a.workload.complianceTier === 'HIPAA' || a.workload.complianceTier === 'ISO-27001').length} Regulated Tier Workloads   |   ${analysis.graph.hasCycle ? `${analysis.graph.cycleCount} Dependency Cycle(s)` : '0 Dependency Cycles'}`,
    {
      x: 0.78,
      y: 6.14,
      w: 11.75,
      h: 0.6,
      fontFace: 'Consolas',
      fontSize: 10.5,
      bold: true,
      color: C_INK,
      valign: 'middle',
    }
  );

  const output = await pres.write({ outputType: 'uint8array' });
  if (output instanceof Uint8Array) {
    return output;
  }
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }
  return new Uint8Array(Buffer.from(output as string, 'binary'));
}
