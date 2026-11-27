import type {
  CashflowMonthPoint,
  CloudRegionId,
  CommitmentMix,
  Disposition6R,
  FinopsAssumptions,
  FinopsSimulationResult,
  PortfolioMigrationAnalysis,
  RegionProfile,
  WorkloadFinopsProjection,
} from '@/types/stratascale';

export const REGION_PROFILES: Record<CloudRegionId, RegionProfile> = {
  'ap-south-1': {
    id: 'ap-south-1',
    name: 'ap-south-1 (Mumbai)',
    city: 'Mumbai',
    costMultiplier: 1.04,
    pue: 1.38,
    gridCarbonKgPerKwh: 0.708,
    egressRatePerGbUsd: 0.109,
  },
  'us-east-1': {
    id: 'us-east-1',
    name: 'us-east-1 (N. Virginia)',
    city: 'Virginia',
    costMultiplier: 1.0,
    pue: 1.15,
    gridCarbonKgPerKwh: 0.379,
    egressRatePerGbUsd: 0.09,
  },
  'eu-central-1': {
    id: 'eu-central-1',
    name: 'eu-central-1 (Frankfurt)',
    city: 'Frankfurt',
    costMultiplier: 1.12,
    pue: 1.18,
    gridCarbonKgPerKwh: 0.311,
    egressRatePerGbUsd: 0.09,
  },
};

export const DEFAULT_FINOPS_ASSUMPTIONS: FinopsAssumptions = {
  commitmentMix: {
    onDemandPct: 20,
    oneYearSavingsPct: 40,
    threeYearReservedPct: 40,
  },
  targetUtilizationPct: 65,
  targetRegion: 'us-east-1',
  contingencyPct: 15,
};

const BASE_VCPU_MONTHLY_USD = 240;
const BASE_RAM_GB_MONTHLY_USD = 28;
const BASE_STORAGE_GB_MONTHLY_USD = 0.14;

const ON_PREM_PUE = 1.67;
const ON_PREM_GRID_CARBON_KG_PER_KWH = 0.56;
const HOURS_PER_YEAR = 8760;

const ARCH_EFFICIENCY_BY_DISPOSITION: Record<Disposition6R, number> = {
  Rehost: 1.0,
  Replatform: 0.86,
  Refactor: 0.72,
  Repurchase: 0.78,
  Retire: 0,
  Retain: 1.0,
};

const MIGRATION_LABOR_PER_POINT_USD: Record<Disposition6R, number> = {
  Rehost: 3200,
  Replatform: 4600,
  Refactor: 6900,
  Repurchase: 4200,
  Retire: 1800,
  Retain: 900,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCommitmentMix(mix: CommitmentMix): CommitmentMix {
  const od = Math.max(0, mix.onDemandPct);
  const y1 = Math.max(0, mix.oneYearSavingsPct);
  const y3 = Math.max(0, mix.threeYearReservedPct);
  const sum = od + y1 + y3;
  if (sum <= 0) {
    return { onDemandPct: 100, oneYearSavingsPct: 0, threeYearReservedPct: 0 };
  }
  const normOd = Math.round((od / sum) * 100);
  const normY1 = Math.round((y1 / sum) * 100);
  const normY3 = 100 - normOd - normY1;
  return {
    onDemandPct: normOd,
    oneYearSavingsPct: normY1,
    threeYearReservedPct: Math.max(0, normY3),
  };
}

export function getBlendedCommitmentMultiplier(mix: CommitmentMix): number {
  const normalized = normalizeCommitmentMix(mix);
  return (
    (normalized.onDemandPct * 1.0 +
      normalized.oneYearSavingsPct * 0.68 +
      normalized.threeYearReservedPct * 0.44) /
    100
  );
}

/**
 * Simulates workload-level right-sizing, regional carbon footprint, and 36-month
 * wave-phased TCO cashflows using topological migration waves and 6R dispositions.
 */
export function runFinopsSimulation(
  analysis: PortfolioMigrationAnalysis,
  rawAssumptions: FinopsAssumptions
): FinopsSimulationResult {
  const normalizedMix = normalizeCommitmentMix(rawAssumptions.commitmentMix);
  const targetUtil = clamp(rawAssumptions.targetUtilizationPct, 40, 85);
  const contingencyPct = clamp(rawAssumptions.contingencyPct, 0, 50);
  const region = REGION_PROFILES[rawAssumptions.targetRegion] ?? REGION_PROFILES['us-east-1'];

  const assumptions: FinopsAssumptions = {
    commitmentMix: normalizedMix,
    targetUtilizationPct: targetUtil,
    targetRegion: region.id,
    contingencyPct,
  };

  const commitmentDiscount = getBlendedCommitmentMultiplier(normalizedMix);
  const maxWave = Math.max(1, analysis.graph.waves.length);
  // Spread wave cutovers cleanly across months 2..12 so migration labor & break-even are realistic
  const monthsPerWave = maxWave <= 3 ? 3 : maxWave <= 5 ? 2 : 1.5;

  let provisionedVcpus = 0;
  let rightSizedVcpusTotal = 0;
  let provisionedRamGb = 0;
  let rightSizedRamGbTotal = 0;

  const workloadProjections: WorkloadFinopsProjection[] = analysis.assessments.map((item) => {
    const w = item.workload;
    const disposition = item.disposition;
    const cutoverMonth = Math.min(
      14,
      Math.max(2, Math.round(item.waveIndex * monthsPerWave))
    );

    provisionedVcpus += w.vcpus;
    provisionedRamGb += w.ramGb;

    // Right-sizing computation
    let rightSizedVcpus = w.vcpus;
    let rightSizedRamGb = w.ramGb;
    if (disposition === 'Retire') {
      rightSizedVcpus = 0;
      rightSizedRamGb = 0;
    } else if (disposition === 'Rehost' || disposition === 'Replatform' || disposition === 'Refactor') {
      const cpuScale = clamp(w.cpuUtilPct / targetUtil, 0.35, 1.1);
      const ramScale = clamp(w.ramUtilPct / Math.min(88, targetUtil + 8), 0.4, 1.1);
      rightSizedVcpus = Math.max(2, Math.round(w.vcpus * cpuScale));
      rightSizedRamGb = Math.max(4, Math.round(w.ramGb * ramScale));
    }

    rightSizedVcpusTotal += rightSizedVcpus;
    rightSizedRamGbTotal += rightSizedRamGb;

    // Monthly cloud run-rate by 6R strategy
    let monthlyCloudComputeUsd = 0;
    let monthlyCloudStorageUsd = 0;
    let monthlyCloudEgressUsd = 0;
    let monthlySaasUsd = 0;
    let monthlyRetainedOnPremUsd = 0;

    if (disposition === 'Retire') {
      // Zero steady-state cloud compute/storage after archival
    } else if (disposition === 'Retain') {
      monthlyRetainedOnPremUsd = w.monthlyOnPremCostUsd;
    } else if (disposition === 'Repurchase') {
      monthlySaasUsd = Math.round(w.monthlyOnPremCostUsd * 0.78 * region.costMultiplier * 0.98);
      monthlyCloudEgressUsd = Math.round(w.monthlyEgressGb * 0.3 * region.egressRatePerGbUsd);
    } else {
      const archEff = ARCH_EFFICIENCY_BY_DISPOSITION[disposition];
      const rawCompute =
        rightSizedVcpus * BASE_VCPU_MONTHLY_USD + rightSizedRamGb * BASE_RAM_GB_MONTHLY_USD;
      monthlyCloudComputeUsd = Math.round(
        rawCompute * region.costMultiplier * archEff * commitmentDiscount
      );

      const storageEfficiency =
        disposition === 'Refactor' ? 0.72 : disposition === 'Replatform' ? 0.85 : 0.95;
      monthlyCloudStorageUsd = Math.round(
        w.storageTb * 1024 * BASE_STORAGE_GB_MONTHLY_USD * storageEfficiency * region.costMultiplier
      );
      monthlyCloudEgressUsd = Math.round(w.monthlyEgressGb * region.egressRatePerGbUsd);
    }

    const steadyStateMonthlyCloudUsd =
      monthlyCloudComputeUsd +
      monthlyCloudStorageUsd +
      monthlyCloudEgressUsd +
      monthlySaasUsd +
      monthlyRetainedOnPremUsd;

    // One-time migration labor & contingency
    const baseLabor = item.complexityPoints * MIGRATION_LABOR_PER_POINT_USD[disposition];
    const complianceAdder =
      w.complianceTier === 'PCI-DSS' || w.complianceTier === 'HIPAA' ? 1.15 : 1.0;
    const oneTimeMigrationLaborUsd = Math.round(baseLabor * complianceAdder);
    const contingencyUsd = Math.round(oneTimeMigrationLaborUsd * (contingencyPct / 100));
    const totalMigrationInvestmentUsd = oneTimeMigrationLaborUsd + contingencyUsd;

    // Carbon footprint (annual tCO2e)
    // Legacy physical servers draw ~55% static idle power + 45% dynamic CPU power
    const onPremLoadFactor = 0.55 + 0.45 * (w.cpuUtilPct / 100);
    const onPremKw =
      ((w.vcpus * 14.5 * onPremLoadFactor + w.ramGb * 0.45 + w.storageTb * 2.2) / 1000) *
      ON_PREM_PUE;
    const annualOnPremCo2eTons =
      (onPremKw * HOURS_PER_YEAR * ON_PREM_GRID_CARBON_KG_PER_KWH) / 1000;

    let annualCloudCo2eTons = annualOnPremCo2eTons;
    if (disposition === 'Retire') {
      annualCloudCo2eTons = 0;
    } else if (disposition === 'Retain') {
      annualCloudCo2eTons = annualOnPremCo2eTons;
    } else if (disposition === 'Repurchase') {
      // Multi-tenant SaaS runs on hyperscale infrastructure with high consolidation
      const saasKw =
        ((Math.max(1, rightSizedVcpus * 0.55) * 9.0 + w.ramGb * 0.22 + w.storageTb * 1.4) /
          1000) *
        region.pue;
      annualCloudCo2eTons = (saasKw * HOURS_PER_YEAR * region.gridCarbonKgPerKwh) / 1000;
    } else {
      const archPowerEff =
        disposition === 'Refactor' ? 0.78 : disposition === 'Replatform' ? 0.88 : 0.96;
      const cloudLoadFactor = 0.32 + 0.68 * (targetUtil / 100);
      const cloudKw =
        ((rightSizedVcpus * 9.5 * cloudLoadFactor * archPowerEff +
          rightSizedRamGb * 0.3 +
          w.storageTb * 1.4) /
          1000) *
        region.pue;
      annualCloudCo2eTons = (cloudKw * HOURS_PER_YEAR * region.gridCarbonKgPerKwh) / 1000;
    }

    return {
      workloadId: w.id,
      disposition,
      waveIndex: item.waveIndex,
      cutoverMonth,
      rightSizedVcpus,
      rightSizedRamGb,
      monthlyOnPremUsd: w.monthlyOnPremCostUsd,
      monthlyCloudComputeUsd,
      monthlyCloudStorageUsd,
      monthlyCloudEgressUsd,
      monthlySaasUsd,
      monthlyRetainedOnPremUsd,
      steadyStateMonthlyCloudUsd,
      monthlyDeltaUsd: w.monthlyOnPremCostUsd - steadyStateMonthlyCloudUsd,
      oneTimeMigrationLaborUsd,
      contingencyUsd,
      totalMigrationInvestmentUsd,
      annualOnPremCo2eTons,
      annualCloudCo2eTons,
    };
  });

  const projectionById: Record<string, WorkloadFinopsProjection> = {};
  for (const proj of workloadProjections) {
    projectionById[proj.workloadId] = proj;
  }

  // 36-Month wave-phased cashflow ledger
  const monthlySeries: CashflowMonthPoint[] = [];
  let cumulativeOnPremUsd = 0;
  let cumulativeCloudScenarioUsd = 0;
  let breakEvenMonth: number | null = null;

  let totalCompute3Yr = 0;
  let totalStorage3Yr = 0;
  let totalEgress3Yr = 0;
  let totalSaas3Yr = 0;
  let totalRetainedOnPrem3Yr = 0;
  let totalLaborAndContingency3Yr = 0;

  // Pre-compute wave cutover events per month
  const waveEventsByMonth = new Map<number, Set<string>>();
  for (const proj of workloadProjections) {
    const set = waveEventsByMonth.get(proj.cutoverMonth) ?? new Set<string>();
    set.add(`Wave ${proj.waveIndex}`);
    waveEventsByMonth.set(proj.cutoverMonth, set);
  }

  for (let month = 1; month <= 36; month++) {
    // Realistic 3.5% annual on-prem maintenance/hardware inflation after Year 1
    const annualEscalation = month > 24 ? 1.071 : month > 12 ? 1.035 : 1.0;

    let onPremMonthlyUsd = 0;
    let cloudRunMonthlyUsd = 0;
    let migrationLaborMonthlyUsd = 0;

    for (const proj of workloadProjections) {
      const escalatedOnPrem = Math.round(proj.monthlyOnPremUsd * annualEscalation);
      onPremMonthlyUsd += escalatedOnPrem;

      // Before cutover month: still running on-prem inside the cloud scenario
      if (month < proj.cutoverMonth) {
        cloudRunMonthlyUsd += escalatedOnPrem;
        if (proj.disposition === 'Retain') {
          totalRetainedOnPrem3Yr += escalatedOnPrem;
        }
      } else {
        if (proj.disposition === 'Retain') {
          cloudRunMonthlyUsd += escalatedOnPrem;
          totalRetainedOnPrem3Yr += escalatedOnPrem;
        } else {
          cloudRunMonthlyUsd += proj.steadyStateMonthlyCloudUsd;
          totalCompute3Yr += proj.monthlyCloudComputeUsd;
          totalStorage3Yr += proj.monthlyCloudStorageUsd;
          totalEgress3Yr += proj.monthlyCloudEgressUsd;
          totalSaas3Yr += proj.monthlySaasUsd;
        }
      }

      // Phased migration labor spent across cutoverMonth - 1 and cutoverMonth
      const laborStart = Math.max(1, proj.cutoverMonth - 1);
      if (month === laborStart && month === proj.cutoverMonth) {
        migrationLaborMonthlyUsd += proj.totalMigrationInvestmentUsd;
        totalLaborAndContingency3Yr += proj.totalMigrationInvestmentUsd;
      } else if (month === laborStart) {
        const half = Math.round(proj.totalMigrationInvestmentUsd * 0.55);
        migrationLaborMonthlyUsd += half;
        totalLaborAndContingency3Yr += half;
      } else if (month === proj.cutoverMonth) {
        const rem = proj.totalMigrationInvestmentUsd - Math.round(proj.totalMigrationInvestmentUsd * 0.55);
        migrationLaborMonthlyUsd += rem;
        totalLaborAndContingency3Yr += rem;
      }
    }

    const totalCloudScenarioMonthlyUsd = cloudRunMonthlyUsd + migrationLaborMonthlyUsd;
    cumulativeOnPremUsd += onPremMonthlyUsd;
    cumulativeCloudScenarioUsd += totalCloudScenarioMonthlyUsd;
    const cumulativeNetSavingsUsd = cumulativeOnPremUsd - cumulativeCloudScenarioUsd;

    if (breakEvenMonth === null && month >= 2 && cumulativeNetSavingsUsd >= 0) {
      breakEvenMonth = month;
    }

    monthlySeries.push({
      month,
      waveEvents: Array.from(waveEventsByMonth.get(month) ?? []).sort(),
      onPremMonthlyUsd,
      cloudRunMonthlyUsd,
      migrationLaborMonthlyUsd,
      totalCloudScenarioMonthlyUsd,
      cumulativeOnPremUsd,
      cumulativeCloudScenarioUsd,
      cumulativeNetSavingsUsd,
    });
  }

  const steadyStateMonthlyOnPremUsd = workloadProjections.reduce(
    (sum, p) => sum + p.monthlyOnPremUsd,
    0
  );
  const steadyStateMonthlyCloudUsd = workloadProjections.reduce(
    (sum, p) => sum + p.steadyStateMonthlyCloudUsd,
    0
  );
  const steadyStateMonthlySavingsUsd =
    steadyStateMonthlyOnPremUsd - steadyStateMonthlyCloudUsd;

  const threeYearOnPremTcoUsd = cumulativeOnPremUsd;
  const threeYearCloudTcoUsd = cumulativeCloudScenarioUsd;
  const threeYearNetSavingsUsd = threeYearOnPremTcoUsd - threeYearCloudTcoUsd;
  const threeYearSavingsPct =
    threeYearOnPremTcoUsd > 0
      ? Math.round((threeYearNetSavingsUsd / threeYearOnPremTcoUsd) * 1000) / 10
      : 0;

  const totalMigrationLaborUsd = workloadProjections.reduce(
    (sum, p) => sum + p.oneTimeMigrationLaborUsd,
    0
  );
  const totalContingencyUsd = workloadProjections.reduce(
    (sum, p) => sum + p.contingencyUsd,
    0
  );

  const annualCo2eBaselineTons =
    Math.round(
      workloadProjections.reduce((sum, p) => sum + p.annualOnPremCo2eTons, 0) * 10
    ) / 10;
  const annualCo2eCloudTons =
    Math.round(
      workloadProjections.reduce((sum, p) => sum + p.annualCloudCo2eTons, 0) * 10
    ) / 10;
  const annualCo2eReductionTons =
    Math.round((annualCo2eBaselineTons - annualCo2eCloudTons) * 10) / 10;
  const co2eReductionPct =
    annualCo2eBaselineTons > 0
      ? Math.round((annualCo2eReductionTons / annualCo2eBaselineTons) * 1000) / 10
      : 0;

  const vcpuReductionPct =
    provisionedVcpus > 0
      ? Math.round(((provisionedVcpus - rightSizedVcpusTotal) / provisionedVcpus) * 1000) / 10
      : 0;

  return {
    assumptions,
    region,
    workloadProjections,
    projectionById,
    monthlySeries,
    steadyStateMonthlyOnPremUsd,
    steadyStateMonthlyCloudUsd,
    steadyStateMonthlySavingsUsd,
    threeYearOnPremTcoUsd,
    threeYearCloudTcoUsd,
    threeYearNetSavingsUsd,
    threeYearSavingsPct,
    breakEvenMonth,
    totalMigrationLaborUsd,
    totalContingencyUsd,
    annualCo2eBaselineTons,
    annualCo2eCloudTons,
    annualCo2eReductionTons,
    co2eReductionPct,
    costBreakdown3Yr: {
      computeUsd: totalCompute3Yr,
      storageUsd: totalStorage3Yr,
      egressUsd: totalEgress3Yr,
      saasUsd: totalSaas3Yr,
      retainedOnPremUsd: totalRetainedOnPrem3Yr,
      migrationLaborAndContingencyUsd: totalLaborAndContingency3Yr,
    },
    rightSizingSummary: {
      provisionedVcpus,
      rightSizedVcpus: rightSizedVcpusTotal,
      vcpuReductionPct,
      provisionedRamGb,
      rightSizedRamGb: rightSizedRamGbTotal,
    },
  };
}
