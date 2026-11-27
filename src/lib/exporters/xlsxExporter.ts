import ExcelJS from 'exceljs';
import type {
  Disposition6R,
  FinopsSimulationResult,
  PortfolioMigrationAnalysis,
} from '@/types/stratascale';

const HAIRLINE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const DISPOSITION_COLORS: Record<Disposition6R, { bg: string; fg: string }> = {
  Rehost: { bg: 'FFD1FAE5', fg: 'FF047857' },
  Replatform: { bg: 'FFE0F2FE', fg: 'FF0369A1' },
  Refactor: { bg: 'FFFEF3C7', fg: 'FFB45309' },
  Repurchase: { bg: 'FFE2E8F0', fg: 'FF0F172A' },
  Retire: { bg: 'FFD1FAE5', fg: 'FF047857' },
  Retain: { bg: 'FFF1F5F9', fg: 'FF475569' },
};

function styleHeaderRow(row: ExcelJS.Row, bgArgb = 'FF0F172A', fgArgb = 'FFFFFFFF') {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fgArgb } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = HAIRLINE_BORDER;
  });
}

function styleDataRow(row: ExcelJS.Row, isStripe = false) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    if (isStripe) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    cell.alignment = { vertical: 'middle' };
    cell.border = HAIRLINE_BORDER;
  });
}

export async function generatePortfolioXlsxBuffer(
  portfolioName: string,
  analysis: PortfolioMigrationAnalysis,
  finops: FinopsSimulationResult
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StrataScale Architectural Cloud Ledger';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = workbook.addWorksheet('Executive Summary');
  const matrixSheet = workbook.addWorksheet('6R Workload Matrix', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const waveSheet = workbook.addWorksheet('Wave Plan', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const cashflowSheet = workbook.addWorksheet('3-Year FinOps Cashflow', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const workloadCount = analysis.assessments.length;
  const lastMatrixRow = Math.max(2, workloadCount + 1);
  const cashflowLastMonthRow = 37; // Header row 1 + 36 months = row 37

  // =========================================================================
  // SHEET 2: 6R Workload Matrix (populate first so references match exact cols)
  // =========================================================================
  matrixSheet.columns = [
    { header: 'Workload ID', key: 'id', width: 14 }, // A
    { header: 'Application Name', key: 'name', width: 32 }, // B
    { header: 'Domain', key: 'domain', width: 22 }, // C
    { header: 'Env', key: 'env', width: 12 }, // D
    { header: 'Operating System', key: 'os', width: 22 }, // E
    { header: 'EOL Risk', key: 'eol', width: 11 }, // F
    { header: 'Compliance', key: 'compliance', width: 14 }, // G
    { header: 'DB Coupling', key: 'dbCoupling', width: 14 }, // H
    { header: 'vCPUs', key: 'vcpus', width: 10 }, // I
    { header: 'Right-Sized vCPUs', key: 'rsVcpus', width: 16 }, // J
    { header: 'RAM (GB)', key: 'ramGb', width: 11 }, // K
    { header: 'CPU Util %', key: 'cpuUtil', width: 12 }, // L
    { header: 'Wave', key: 'wave', width: 10 }, // M
    { header: 'Monthly On-Prem ($)', key: 'onPrem', width: 19 }, // N
    { header: 'Recommended 6R', key: 'disposition', width: 17 }, // O
    { header: 'Monthly Cloud ($)', key: 'cloud', width: 18 }, // P
    { header: 'Monthly Delta ($)', key: 'delta', width: 18 }, // Q
    { header: 'Confidence %', key: 'confidence', width: 13 }, // R
    { header: 'Complexity Pts', key: 'complexity', width: 14 }, // S
    { header: 'Risk Level', key: 'risk', width: 12 }, // T
    { header: 'Cycle Blocked', key: 'cycle', width: 14 }, // U
    { header: 'One-Time Migration ($)', key: 'migrationInv', width: 21 }, // V
    { header: 'Rationale Tags', key: 'rationale', width: 38 }, // W
    { header: 'Dependencies', key: 'deps', width: 22 }, // X
  ];
  styleHeaderRow(matrixSheet.getRow(1));

  analysis.assessments.forEach((a, idx) => {
    const rowIdx = idx + 2;
    const proj = finops.projectionById[a.workload.id];
    const row = matrixSheet.addRow({
      id: a.workload.id,
      name: a.workload.name,
      domain: a.workload.domain,
      env: a.workload.environment,
      os: a.workload.os,
      eol: a.workload.eolOs ? 'EOL' : 'Supported',
      compliance: a.workload.complianceTier,
      dbCoupling: a.workload.dbCoupling,
      vcpus: a.workload.vcpus,
      rsVcpus: proj?.rightSizedVcpus ?? a.workload.vcpus,
      ramGb: a.workload.ramGb,
      cpuUtil: a.workload.cpuUtilPct / 100,
      wave: a.waveIndex,
      onPrem: a.workload.monthlyOnPremCostUsd,
      disposition: a.disposition,
      cloud: proj?.steadyStateMonthlyCloudUsd ?? a.workload.monthlyOnPremCostUsd,
      delta: { formula: `N${rowIdx}-P${rowIdx}`, result: (proj?.monthlyDeltaUsd ?? 0) },
      confidence: a.confidencePct / 100,
      complexity: a.complexityPoints,
      risk: a.riskLevel,
      cycle: a.blockedByCycle ? 'BLOCKED' : 'Clear',
      migrationInv: proj?.totalMigrationInvestmentUsd ?? 0,
      rationale: a.rationaleTags.join('; '),
      deps: a.workload.dependencies.join('; '),
    });

    styleDataRow(row, idx % 2 === 1);

    row.getCell('L').numFmt = '0.0%';
    row.getCell('N').numFmt = '$#,##0';
    row.getCell('P').numFmt = '$#,##0';
    row.getCell('Q').numFmt = '$#,##0;[Red]($#,##0)';
    row.getCell('R').numFmt = '0.0%';
    row.getCell('V').numFmt = '$#,##0';

    const dispStyle = DISPOSITION_COLORS[a.disposition];
    row.getCell('O').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: dispStyle.bg },
    };
    row.getCell('O').font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: dispStyle.fg },
    };

    if (a.workload.eolOs) {
      row.getCell('F').font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFDC2626' },
      };
    }
    if (a.riskLevel === 'High') {
      row.getCell('T').font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFDC2626' },
      };
    }
    if (a.blockedByCycle) {
      row.getCell('U').font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFDC2626' },
      };
    }
  });

  if (workloadCount > 0) {
    const totalRowIdx = lastMatrixRow + 1;
    const totalRow = matrixSheet.addRow({
      id: 'TOTAL / AVG',
      name: `${workloadCount} Applications`,
      vcpus: { formula: `SUM(I2:I${lastMatrixRow})`, result: finops.rightSizingSummary.provisionedVcpus },
      rsVcpus: { formula: `SUM(J2:J${lastMatrixRow})`, result: finops.rightSizingSummary.rightSizedVcpus },
      ramGb: { formula: `SUM(K2:K${lastMatrixRow})`, result: finops.rightSizingSummary.provisionedRamGb },
      cpuUtil: { formula: `AVERAGE(L2:L${lastMatrixRow})`, result: 0.45 },
      onPrem: { formula: `SUM(N2:N${lastMatrixRow})`, result: finops.steadyStateMonthlyOnPremUsd },
      cloud: { formula: `SUM(P2:P${lastMatrixRow})`, result: finops.steadyStateMonthlyCloudUsd },
      delta: { formula: `SUM(Q2:Q${lastMatrixRow})`, result: finops.steadyStateMonthlySavingsUsd },
      confidence: { formula: `AVERAGE(R2:R${lastMatrixRow})`, result: 0.8 },
      complexity: {
        formula: `SUM(S2:S${lastMatrixRow})`,
        result: analysis.assessments.reduce((s, a) => s + a.complexityPoints, 0),
      },
      migrationInv: {
        formula: `SUM(V2:V${lastMatrixRow})`,
        result: finops.totalMigrationLaborUsd + finops.totalContingencyUsd,
      },
    });
    styleHeaderRow(totalRow, 'FFEEF2F6', 'FF0F172A');
    totalRow.getCell('L').numFmt = '0.0%';
    totalRow.getCell('N').numFmt = '$#,##0';
    totalRow.getCell('P').numFmt = '$#,##0';
    totalRow.getCell('Q').numFmt = '$#,##0;[Red]($#,##0)';
    totalRow.getCell('R').numFmt = '0.0%';
    totalRow.getCell('V').numFmt = '$#,##0';
    void totalRowIdx;
  }

  // =========================================================================
  // SHEET 3: Wave Plan
  // =========================================================================
  waveSheet.columns = [
    { header: 'Wave #', key: 'wave', width: 12 }, // A
    { header: 'Phase Label', key: 'label', width: 24 }, // B
    { header: 'Workload Count', key: 'count', width: 16 }, // C
    { header: 'Workloads in Wave', key: 'nodes', width: 42 }, // D
    { header: 'SCC Cycle Status', key: 'status', width: 20 }, // E
    { header: 'Complexity Points', key: 'complexity', width: 18 }, // F
    { header: 'Monthly On-Prem Exiting ($)', key: 'onPrem', width: 25 }, // G
    { header: 'Monthly Cloud Entering ($)', key: 'cloud', width: 25 }, // H
    { header: 'One-Time Migration Investment ($)', key: 'labor', width: 28 }, // I
  ];
  styleHeaderRow(waveSheet.getRow(1));

  analysis.graph.waves.forEach((wave, idx) => {
    const waveCloudMonthly = wave.nodeIds.reduce(
      (sum, id) => sum + (finops.projectionById[id]?.steadyStateMonthlyCloudUsd ?? 0),
      0
    );
    const waveMigrationInv = wave.nodeIds.reduce(
      (sum, id) => sum + (finops.projectionById[id]?.totalMigrationInvestmentUsd ?? 0),
      0
    );

    const row = waveSheet.addRow({
      wave: wave.waveIndex,
      label: wave.label,
      count: wave.nodeIds.length,
      nodes: wave.nodeIds.join(', '),
      status: wave.hasCycleNode ? 'SCC CYCLE BLOCKER' : 'Topological Clear',
      complexity: wave.totalComplexityPoints,
      onPrem: wave.totalMonthlyOnPremUsd,
      cloud: waveCloudMonthly,
      labor: waveMigrationInv,
    });
    styleDataRow(row, idx % 2 === 1);
    row.getCell('G').numFmt = '$#,##0';
    row.getCell('H').numFmt = '$#,##0';
    row.getCell('I').numFmt = '$#,##0';
    row.getCell('E').font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: wave.hasCycleNode ? 'FFDC2626' : 'FF047857' },
    };
  });

  if (analysis.graph.waves.length > 0) {
    const lastWaveRow = analysis.graph.waves.length + 1;
    const waveTotalRow = waveSheet.addRow({
      wave: 'TOTAL',
      label: `${analysis.graph.waves.length} Waves`,
      count: { formula: `SUM(C2:C${lastWaveRow})`, result: workloadCount },
      nodes: '',
      status: analysis.graph.hasCycle
        ? `${analysis.graph.cycleCount} Cycle(s) Detected`
        : 'All Dependencies Acyclic',
      complexity: {
        formula: `SUM(F2:F${lastWaveRow})`,
        result: analysis.graph.waves.reduce((s, w) => s + w.totalComplexityPoints, 0),
      },
      onPrem: {
        formula: `SUM(G2:G${lastWaveRow})`,
        result: finops.steadyStateMonthlyOnPremUsd,
      },
      cloud: {
        formula: `SUM(H2:H${lastWaveRow})`,
        result: finops.steadyStateMonthlyCloudUsd,
      },
      labor: {
        formula: `SUM(I2:I${lastWaveRow})`,
        result: finops.totalMigrationLaborUsd + finops.totalContingencyUsd,
      },
    });
    styleHeaderRow(waveTotalRow, 'FFEEF2F6', 'FF0F172A');
    waveTotalRow.getCell('G').numFmt = '$#,##0';
    waveTotalRow.getCell('H').numFmt = '$#,##0';
    waveTotalRow.getCell('I').numFmt = '$#,##0';
  }

  if (analysis.graph.hasCycle) {
    waveSheet.addRow([]);
    const diagHdr = waveSheet.addRow([
      'SCC ID',
      'Cyclic Nodes',
      'Remediation Guidance',
    ]);
    styleHeaderRow(diagHdr, 'FFDC2626', 'FFFFFFFF');
    for (const scc of analysis.graph.sccs) {
      const r = waveSheet.addRow([scc.id, scc.nodeIds.join(' -> '), scc.remediationHint]);
      styleDataRow(r);
    }
  }

  // =========================================================================
  // SHEET 4: 3-Year FinOps Cashflow
  // =========================================================================
  cashflowSheet.columns = [
    { header: 'Month', key: 'month', width: 10 }, // A
    { header: 'Wave Cutover Events', key: 'events', width: 22 }, // B
    { header: 'On-Prem Baseline ($)', key: 'onPrem', width: 20 }, // C
    { header: 'Cloud Run Cost ($)', key: 'cloudRun', width: 20 }, // D
    { header: 'Migration Labor ($)', key: 'labor', width: 20 }, // E
    { header: 'Total Cloud Scenario ($)', key: 'totalCloud', width: 23 }, // F
    { header: 'Cumulative On-Prem ($)', key: 'cumOnPrem', width: 23 }, // G
    { header: 'Cumulative Cloud ($)', key: 'cumCloud', width: 23 }, // H
    { header: 'Cumulative Net Savings ($)', key: 'cumNet', width: 25 }, // I
  ];
  styleHeaderRow(cashflowSheet.getRow(1));

  finops.monthlySeries.forEach((pt, idx) => {
    const rowIdx = idx + 2;
    const prevRowIdx = rowIdx - 1;
    const cumOnPremFormula =
      idx === 0 ? `C${rowIdx}` : `G${prevRowIdx}+C${rowIdx}`;
    const cumCloudFormula =
      idx === 0 ? `F${rowIdx}` : `H${prevRowIdx}+F${rowIdx}`;

    const row = cashflowSheet.addRow({
      month: pt.month,
      events: pt.waveEvents.join(', ') || '-',
      onPrem: pt.onPremMonthlyUsd,
      cloudRun: pt.cloudRunMonthlyUsd,
      labor: pt.migrationLaborMonthlyUsd,
      totalCloud: { formula: `D${rowIdx}+E${rowIdx}`, result: pt.totalCloudScenarioMonthlyUsd },
      cumOnPrem: { formula: cumOnPremFormula, result: pt.cumulativeOnPremUsd },
      cumCloud: { formula: cumCloudFormula, result: pt.cumulativeCloudScenarioUsd },
      cumNet: { formula: `G${rowIdx}-H${rowIdx}`, result: pt.cumulativeNetSavingsUsd },
    });

    styleDataRow(row, idx % 2 === 1);
    for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I']) {
      row.getCell(col).numFmt = '$#,##0;[Red]($#,##0)';
    }
    row.getCell('I').font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: pt.cumulativeNetSavingsUsd >= 0 ? 'FF047857' : 'FFB45309' },
    };
  });

  const cashflowTotalRow = cashflowSheet.addRow({
    month: '36-MO TOTAL',
    events: '3-Year Horizon',
    onPrem: { formula: `SUM(C2:C${cashflowLastMonthRow})`, result: finops.threeYearOnPremTcoUsd },
    cloudRun: {
      formula: `SUM(D2:D${cashflowLastMonthRow})`,
      result: finops.threeYearCloudTcoUsd - (finops.totalMigrationLaborUsd + finops.totalContingencyUsd),
    },
    labor: {
      formula: `SUM(E2:E${cashflowLastMonthRow})`,
      result: finops.totalMigrationLaborUsd + finops.totalContingencyUsd,
    },
    totalCloud: { formula: `SUM(F2:F${cashflowLastMonthRow})`, result: finops.threeYearCloudTcoUsd },
    cumOnPrem: { formula: `G${cashflowLastMonthRow}`, result: finops.threeYearOnPremTcoUsd },
    cumCloud: { formula: `H${cashflowLastMonthRow}`, result: finops.threeYearCloudTcoUsd },
    cumNet: { formula: `I${cashflowLastMonthRow}`, result: finops.threeYearNetSavingsUsd },
  });
  styleHeaderRow(cashflowTotalRow, 'FFEEF2F6', 'FF0F172A');
  for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I']) {
    cashflowTotalRow.getCell(col).numFmt = '$#,##0;[Red]($#,##0)';
  }

  // =========================================================================
  // SHEET 1: Executive Summary (linked via live Excel formulas)
  // =========================================================================
  summarySheet.columns = [
    { width: 38 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 32 },
  ];

  const titleRow = summarySheet.addRow([
    `StrataScale Cloud Migration & FinOps Assessment -- ${portfolioName}`,
  ]);
  summarySheet.mergeCells('A1:E1');
  titleRow.height = 30;
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  const metaRow = summarySheet.addRow([
    'Target Cloud Region',
    finops.region.name,
    'Target Utilization',
    `${finops.assumptions.targetUtilizationPct}%`,
    `Commitment Mix: ${finops.assumptions.commitmentMix.onDemandPct}% OD / ${finops.assumptions.commitmentMix.oneYearSavingsPct}% 1Y SP / ${finops.assumptions.commitmentMix.threeYearReservedPct}% 3Y RI`,
  ]);
  styleDataRow(metaRow, true);
  metaRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
  metaRow.getCell(3).font = { bold: true, size: 10, color: { argb: 'FF475569' } };

  summarySheet.addRow([]);

  const kpiHeader = summarySheet.addRow([
    'Executive Portfolio Metric',
    'Value',
    'Unit / Scope',
    'Formula / Basis',
    'Assessment Notes',
  ]);
  styleHeaderRow(kpiHeader, 'FF0369A1', 'FFFFFFFF');

  const kpiRows: Array<{
    metric: string;
    value: ExcelJS.CellValue;
    numFmt?: string;
    unit: string;
    basis: string;
    note: string;
  }> = [
    {
      metric: 'Total Assessed Workloads',
      value: { formula: `COUNTA('6R Workload Matrix'!A2:A${lastMatrixRow})`, result: workloadCount },
      numFmt: '#,##0',
      unit: 'Applications',
      basis: 'COUNTA Matrix',
      note: 'All active workloads in current assessment scope',
    },
    {
      metric: 'Current Monthly On-Premises Spend',
      value: { formula: `SUM('6R Workload Matrix'!N2:N${lastMatrixRow})`, result: finops.steadyStateMonthlyOnPremUsd },
      numFmt: '$#,##0',
      unit: 'USD / month',
      basis: 'SUM Matrix Col N',
      note: 'Baseline infrastructure, licensing, and facilities run-rate',
    },
    {
      metric: 'Steady-State Monthly Cloud Spend',
      value: { formula: `SUM('6R Workload Matrix'!P2:P${lastMatrixRow})`, result: finops.steadyStateMonthlyCloudUsd },
      numFmt: '$#,##0',
      unit: 'USD / month',
      basis: 'SUM Matrix Col P',
      note: 'Right-sized compute, storage, egress, SaaS & retained systems',
    },
    {
      metric: '3-Year On-Premises Baseline TCO',
      value: { formula: `'3-Year FinOps Cashflow'!C38`, result: finops.threeYearOnPremTcoUsd },
      numFmt: '$#,##0',
      unit: 'USD (36 mo)',
      basis: 'Cashflow 36-Mo Sum',
      note: 'Includes 3.5% annual hardware/licensing inflation after Year 1',
    },
    {
      metric: '3-Year Cloud Migration Scenario TCO',
      value: { formula: `'3-Year FinOps Cashflow'!F38`, result: finops.threeYearCloudTcoUsd },
      numFmt: '$#,##0',
      unit: 'USD (36 mo)',
      basis: 'Cashflow 36-Mo Sum',
      note: 'Includes wave-phased dual-run, cloud run-rate & migration labor',
    },
    {
      metric: '3-Year Net Financial Savings',
      value: { formula: `B8-B9`, result: finops.threeYearNetSavingsUsd },
      numFmt: '$#,##0;[Red]($#,##0)',
      unit: 'USD (36 mo)',
      basis: 'On-Prem TCO - Cloud TCO',
      note: 'Cumulative 36-month net TCO reduction',
    },
    {
      metric: '3-Year Net Savings Percentage',
      value: { formula: `IF(B8>0, B10/B8, 0)`, result: finops.threeYearSavingsPct / 100 },
      numFmt: '0.0%',
      unit: '% TCO Delta',
      basis: 'Net Savings / Baseline',
      note: 'Relative TCO efficiency gain over 36 months',
    },
    {
      metric: 'One-Time Migration Investment (incl. Contingency)',
      value: { formula: `SUM('6R Workload Matrix'!V2:V${lastMatrixRow})`, result: finops.totalMigrationLaborUsd + finops.totalContingencyUsd },
      numFmt: '$#,##0',
      unit: 'USD One-Time',
      basis: `${finops.assumptions.contingencyPct}% Contingency`,
      note: 'Phased wave migration engineering + compliance uplift',
    },
    {
      metric: 'Break-Even Month',
      value: finops.breakEvenMonth ? `Month ${finops.breakEvenMonth}` : '> 36 Months',
      unit: 'Payback Horizon',
      basis: 'Cumulative Cashflow',
      note: 'First month where cumulative cloud scenario TCO beats baseline',
    },
    {
      metric: 'Annual CO2e Emissions Reduction',
      value: finops.annualCo2eReductionTons,
      numFmt: '#,##0.0',
      unit: 'tCO2e / year',
      basis: `PUE ${finops.region.pue} vs 1.67`,
      note: `${finops.co2eReductionPct}% reduction vs legacy colocation baseline`,
    },
    {
      metric: 'End-of-Life (EOL) OS Risk Workloads',
      value: { formula: `COUNTIF('6R Workload Matrix'!F2:F${lastMatrixRow}, "EOL")`, result: analysis.eolCount },
      numFmt: '#,##0',
      unit: 'Applications',
      basis: 'COUNTIF EOL',
      note: 'Workloads requiring urgent OS exit or isolation',
    },
    {
      metric: 'Topological Dependency Cycle Status',
      value: analysis.graph.hasCycle
        ? `${analysis.graph.cycleCount} Cycle(s) / ${analysis.graph.cyclicNodeIds.length} Nodes`
        : '0 Cycles (Valid DAG)',
      unit: `${analysis.graph.waves.length} Waves`,
      basis: 'Tarjan SCC + Kahn',
      note: analysis.graph.hasCycle
        ? 'See Wave Plan sheet for SCC decoupling remediation'
        : 'Clean topological wave ordering verified',
    },
  ];

  kpiRows.forEach((item, idx) => {
    const r = summarySheet.addRow([item.metric, item.value, item.unit, item.basis, item.note]);
    styleDataRow(r, idx % 2 === 1);
    r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0369A1' } };
    if (item.numFmt) {
      r.getCell(2).numFmt = item.numFmt;
    }
  });

  summarySheet.addRow([]);

  const sixRHeader = summarySheet.addRow([
    '6R Disposition Strategy',
    'Workload Count',
    '% of Portfolio',
    'Current Monthly Spend ($)',
    'Projected Monthly Cloud ($)',
  ]);
  styleHeaderRow(sixRHeader, 'FFEEF2F6', 'FF0F172A');

  const dispositions: Disposition6R[] = [
    'Rehost',
    'Replatform',
    'Refactor',
    'Repurchase',
    'Retire',
    'Retain',
  ];
  const sixRStartRow = sixRHeader.number + 1;
  dispositions.forEach((disp, idx) => {
    const rIdx = sixRStartRow + idx;
    const countVal = analysis.dispositionCounts[disp];
    const currentSpend = analysis.assessments
      .filter((a) => a.disposition === disp)
      .reduce((s, a) => s + a.workload.monthlyOnPremCostUsd, 0);
    const cloudSpend = analysis.assessments
      .filter((a) => a.disposition === disp)
      .reduce(
        (s, a) =>
          s + (finops.projectionById[a.workload.id]?.steadyStateMonthlyCloudUsd ?? 0),
        0
      );

    const row = summarySheet.addRow([
      disp,
      {
        formula: `COUNTIF('6R Workload Matrix'!O2:O${lastMatrixRow}, "${disp}")`,
        result: countVal,
      },
      {
        formula: `IF($B$5>0, B${rIdx}/$B$5, 0)`,
        result: workloadCount > 0 ? countVal / workloadCount : 0,
      },
      {
        formula: `SUMIF('6R Workload Matrix'!O2:O${lastMatrixRow}, "${disp}", '6R Workload Matrix'!N2:N${lastMatrixRow})`,
        result: currentSpend,
      },
      {
        formula: `SUMIF('6R Workload Matrix'!O2:O${lastMatrixRow}, "${disp}", '6R Workload Matrix'!P2:P${lastMatrixRow})`,
        result: cloudSpend,
      },
    ]);
    styleDataRow(row, idx % 2 === 1);
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '0.0%';
    row.getCell(4).numFmt = '$#,##0';
    row.getCell(5).numFmt = '$#,##0';
  });

  const sixREndRow = sixRStartRow + dispositions.length - 1;
  const sixRTotalRow = summarySheet.addRow([
    'TOTAL PORTFOLIO',
    { formula: `SUM(B${sixRStartRow}:B${sixREndRow})`, result: workloadCount },
    { formula: `SUM(C${sixRStartRow}:C${sixREndRow})`, result: 1 },
    { formula: `SUM(D${sixRStartRow}:D${sixREndRow})`, result: finops.steadyStateMonthlyOnPremUsd },
    { formula: `SUM(E${sixRStartRow}:E${sixREndRow})`, result: finops.steadyStateMonthlyCloudUsd },
  ]);
  styleHeaderRow(sixRTotalRow, 'FF0F172A', 'FFFFFFFF');
  sixRTotalRow.getCell(2).numFmt = '#,##0';
  sixRTotalRow.getCell(3).numFmt = '0.0%';
  sixRTotalRow.getCell(4).numFmt = '$#,##0';
  sixRTotalRow.getCell(5).numFmt = '$#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
