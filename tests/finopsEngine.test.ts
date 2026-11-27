import { describe, expect, it } from 'vitest';
import { SEEDED_PORTFOLIOS } from '@/data/portfolios';
import {
  DEFAULT_FINOPS_ASSUMPTIONS,
  normalizeCommitmentMix,
  runFinopsSimulation,
} from '@/lib/finopsEngine';
import { analyzePortfolioMigration } from '@/lib/migrationEngine';

describe('FinOps TCO & Carbon-Aware Sizing Engine', () => {
  const retailAnalysis = analyzePortfolioMigration(SEEDED_PORTFOLIOS[0].workloads);

  it('produces 36-month cashflow series with positive net savings and realistic break-even', () => {
    const result = runFinopsSimulation(retailAnalysis, DEFAULT_FINOPS_ASSUMPTIONS);
    expect(result.monthlySeries).toHaveLength(36);
    expect(result.threeYearOnPremTcoUsd).toBeGreaterThan(0);
    expect(result.threeYearCloudTcoUsd).toBeGreaterThan(0);
    expect(result.threeYearNetSavingsUsd).toBe(
      result.threeYearOnPremTcoUsd - result.threeYearCloudTcoUsd
    );
    expect(result.threeYearNetSavingsUsd).toBeGreaterThan(0);
    expect(result.breakEvenMonth).not.toBeNull();
    expect(result.breakEvenMonth!).toBeGreaterThanOrEqual(4);
    expect(result.breakEvenMonth!).toBeLessThanOrEqual(30);
    expect(result.annualCo2eReductionTons).toBeGreaterThan(0);
  });

  it('lowers 3-year Cloud TCO and shortens payback when shifting from On-Demand to 3-Yr Reserved', () => {
    const onDemand = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      commitmentMix: {
        onDemandPct: 100,
        oneYearSavingsPct: 0,
        threeYearReservedPct: 0,
      },
    });

    const reservedHeavy = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      commitmentMix: {
        onDemandPct: 10,
        oneYearSavingsPct: 20,
        threeYearReservedPct: 70,
      },
    });

    expect(reservedHeavy.threeYearCloudTcoUsd).toBeLessThan(
      onDemand.threeYearCloudTcoUsd
    );
    expect(reservedHeavy.threeYearNetSavingsUsd).toBeGreaterThan(
      onDemand.threeYearNetSavingsUsd
    );
    if (onDemand.breakEvenMonth !== null && reservedHeavy.breakEvenMonth !== null) {
      expect(reservedHeavy.breakEvenMonth).toBeLessThanOrEqual(
        onDemand.breakEvenMonth
      );
    }
  });

  it('reduces right-sized vCPUs and cloud cost as target utilization rises from 45% to 80%', () => {
    const lowTarget = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      targetUtilizationPct: 45,
    });
    const highTarget = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      targetUtilizationPct: 80,
    });

    expect(highTarget.rightSizingSummary.rightSizedVcpus).toBeLessThan(
      lowTarget.rightSizingSummary.rightSizedVcpus
    );
    expect(highTarget.steadyStateMonthlyCloudUsd).toBeLessThan(
      lowTarget.steadyStateMonthlyCloudUsd
    );
  });

  it('models real regional PUE and grid carbon differences across Mumbai, Virginia, and Frankfurt', () => {
    const mumbai = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      targetRegion: 'ap-south-1',
    });
    const frankfurt = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      targetRegion: 'eu-central-1',
    });

    expect(frankfurt.annualCo2eCloudTons).toBeLessThan(mumbai.annualCo2eCloudTons);
    expect(frankfurt.annualCo2eReductionTons).toBeGreaterThan(
      mumbai.annualCo2eReductionTons
    );
    expect(frankfurt.threeYearCloudTcoUsd).toBeGreaterThan(
      mumbai.threeYearCloudTcoUsd
    );
  });

  it('scales contingency reserve monotonically and normalizes commitment mix to 100%', () => {
    const norm = normalizeCommitmentMix({
      onDemandPct: 10,
      oneYearSavingsPct: 20,
      threeYearReservedPct: 20,
    });
    expect(norm.onDemandPct + norm.oneYearSavingsPct + norm.threeYearReservedPct).toBe(
      100
    );

    const lowCont = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      contingencyPct: 5,
    });
    const highCont = runFinopsSimulation(retailAnalysis, {
      ...DEFAULT_FINOPS_ASSUMPTIONS,
      contingencyPct: 30,
    });
    expect(highCont.totalContingencyUsd).toBeGreaterThan(lowCont.totalContingencyUsd);
    expect(highCont.threeYearCloudTcoUsd).toBeGreaterThan(lowCont.threeYearCloudTcoUsd);
  });
});
