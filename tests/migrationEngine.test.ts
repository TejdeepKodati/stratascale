import { describe, expect, it } from 'vitest';
import { clonePortfolioWorkloads, SEEDED_PORTFOLIOS } from '@/data/portfolios';
import {
  analyzeDependencyGraph,
  analyzePortfolioMigration,
  scoreWorkload6R,
} from '@/lib/migrationEngine';
import type { Workload } from '@/types/stratascale';

function makeWorkload(overrides: Partial<Workload> = {}): Workload {
  return {
    id: 'TST-01',
    name: 'Test Workload',
    domain: 'Core',
    environment: 'Production',
    os: 'Ubuntu 22.04 LTS',
    eolOs: false,
    complianceTier: 'Standard',
    criticality: 'Tier-2',
    vcpus: 16,
    ramGb: 64,
    storageTb: 2.0,
    cpuUtilPct: 45,
    ramUtilPct: 50,
    monthlyEgressGb: 200,
    dbCoupling: 'Loose',
    hasSaasEquivalent: false,
    cloudReadinessScore: 60,
    businessValueScore: 60,
    regulatoryResidencyLock: false,
    decommissionCandidate: false,
    monthlyOnPremCostUsd: 10000,
    dependencies: [],
    ...overrides,
  };
}

describe('6R Multi-Criteria Disposition Scorer', () => {
  it('classifies decommissionCandidate workloads as Retire', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        decommissionCandidate: true,
        businessValueScore: 15,
        cpuUtilPct: 6,
        ramUtilPct: 12,
      })
    );
    expect(res.disposition).toBe('Retire');
    expect(res.confidencePct).toBeGreaterThanOrEqual(75);
    expect(res.rationaleTags).toContain('Decommission Flagged');
  });

  it('classifies regulatoryResidencyLock + Mainframe workloads as Retain', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        regulatoryResidencyLock: true,
        dbCoupling: 'Mainframe',
        cloudReadinessScore: 16,
        complianceTier: 'PCI-DSS',
      })
    );
    expect(res.disposition).toBe('Retain');
    expect(res.rationaleTags).toContain('Residency / Latency Lock');
  });

  it('classifies commercial SaaS candidates as Repurchase', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        hasSaasEquivalent: true,
        businessValueScore: 38,
        dbCoupling: 'Loose',
      })
    );
    expect(res.disposition).toBe('Repurchase');
    expect(res.rationaleTags).toContain('Commercial SaaS Fit');
  });

  it('classifies high-readiness stateless core IP workloads as Refactor', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        cloudReadinessScore: 88,
        businessValueScore: 92,
        dbCoupling: 'None',
        cpuUtilPct: 70,
      })
    );
    expect(res.disposition).toBe('Refactor');
    expect(res.rationaleTags).toContain('Cloud-Native Ready');
  });

  it('classifies EOL OS tight-DB legacy systems as Rehost', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        os: 'Windows Server 2012 R2',
        eolOs: true,
        dbCoupling: 'Tight',
        cloudReadinessScore: 30,
        criticality: 'Tier-1',
      })
    );
    expect(res.disposition).toBe('Rehost');
    expect(res.riskLevel).toBe('High');
  });

  it('classifies moderate-readiness loose-DB workloads as Replatform', () => {
    const res = scoreWorkload6R(
      makeWorkload({
        cloudReadinessScore: 62,
        businessValueScore: 70,
        dbCoupling: 'Loose',
        cpuUtilPct: 38,
      })
    );
    expect(res.disposition).toBe('Replatform');
  });
});

describe('Kahn Topological Sort + Tarjan SCC Cycle Detection', () => {
  it('assigns strictly increasing wave indices along every directed prerequisite edge', () => {
    for (const seed of SEEDED_PORTFOLIOS) {
      const analysis = analyzePortfolioMigration(seed.workloads);
      expect(analysis.graph.hasCycle).toBe(false);
      expect(analysis.graph.rawKahnProcessedCount).toBe(seed.workloads.length);
      expect(analysis.graph.danglingDependencies).toHaveLength(0);

      for (const edge of analysis.graph.allEdges) {
        const fromWave = analysis.graph.waveByNodeId[edge.from];
        const toWave = analysis.graph.waveByNodeId[edge.to];
        expect(fromWave).toBeLessThan(toWave);
      }
    }
  });

  it('detects seeded cycle test injections cleanly across all 3 enterprise portfolios', () => {
    for (const seed of SEEDED_PORTFOLIOS) {
      const cyclicWorkloads = clonePortfolioWorkloads(
        seed.workloads,
        seed.cycleTestEdges,
        true
      );
      const analysis = analyzePortfolioMigration(cyclicWorkloads);
      expect(analysis.graph.hasCycle).toBe(true);
      expect(analysis.graph.cycleCount).toBeGreaterThanOrEqual(1);
      expect(analysis.graph.cyclicNodeIds.length).toBeGreaterThanOrEqual(2);
      expect(analysis.graph.rawKahnProcessedCount).toBeLessThan(
        cyclicWorkloads.length
      );
    }
  });

  it('detects multi-node SCC cycles and marks transitive downstream nodes blocked', () => {
    const workloads: Workload[] = [
      makeWorkload({ id: 'A', dependencies: ['C'] }),
      makeWorkload({ id: 'B', dependencies: ['A'] }),
      makeWorkload({ id: 'C', dependencies: ['B'] }),
      makeWorkload({ id: 'D', dependencies: ['C'] }),
      makeWorkload({ id: 'E', dependencies: [] }),
    ];

    const analysis = analyzePortfolioMigration(workloads);
    expect(analysis.graph.hasCycle).toBe(true);
    expect(analysis.graph.cycleCount).toBe(1);
    expect(analysis.graph.cyclicNodeIds).toEqual(['A', 'B', 'C']);
    expect(analysis.graph.cyclicEdges).toHaveLength(3);
    expect(analysis.assessmentById['D'].blockedByCycle).toBe(true);
    expect(analysis.assessmentById['E'].blockedByCycle).toBe(false);
    expect(analysis.assessmentById['E'].waveIndex).toBe(1);
  });

  it('detects self-loops and reports dangling dependencies safely', () => {
    const workloads: Workload[] = [
      makeWorkload({ id: 'SELF-1', dependencies: ['SELF-1', 'MISSING-99'] }),
    ];
    const graph = analyzeDependencyGraph(workloads);
    expect(graph.hasCycle).toBe(true);
    expect(graph.cyclicNodeIds).toEqual(['SELF-1']);
    expect(graph.danglingDependencies).toEqual([
      { workloadId: 'SELF-1', missingDependencyId: 'MISSING-99' },
    ]);
  });
});
