import type {
  DependencyEdge,
  DependencyGraphAnalysis,
  Disposition6R,
  PortfolioMigrationAnalysis,
  RiskLevel,
  SccComponent,
  StrategyScoreBreakdown,
  WaveGroup,
  Workload,
  WorkloadAssessment,
} from '@/types/stratascale';

const DISPOSITIONS: Disposition6R[] = [
  'Rehost',
  'Replatform',
  'Refactor',
  'Repurchase',
  'Retire',
  'Retain',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface Scored6RResult {
  disposition: Disposition6R;
  confidencePct: number;
  complexityPoints: number;
  riskLevel: RiskLevel;
  rationaleTags: string[];
  scores: StrategyScoreBreakdown;
}

/**
 * Multi-criteria weighted 6R disposition scorer.
 * Evaluates cloud readiness, business value, EOL OS exposure, DB coupling,
 * SaaS availability, residency locks, and decommission status deterministically.
 */
export function scoreWorkload6R(w: Workload): Scored6RResult {
  let rehost = 28;
  let replatform = 30;
  let refactor = w.cloudReadinessScore * 0.45 + w.businessValueScore * 0.35;
  let repurchase = 12;
  let retire = 8;
  let retain = 10;

  // Retire signals
  if (w.decommissionCandidate) {
    retire += 76;
  }
  if (w.businessValueScore < 28) {
    retire += 16;
  }
  if (w.cpuUtilPct < 15 && w.ramUtilPct < 20) {
    retire += 12;
  }

  // Retain signals
  if (w.regulatoryResidencyLock) {
    retain += 58;
  }
  if (w.dbCoupling === 'Mainframe') {
    retain += 24;
  }
  if (w.cloudReadinessScore < 25) {
    retain += 14;
  }
  if (
    w.regulatoryResidencyLock &&
    (w.complianceTier === 'PCI-DSS' ||
      w.complianceTier === 'HIPAA' ||
      w.complianceTier === 'ISO-27001')
  ) {
    retain += 10;
  }

  // Repurchase signals
  if (w.hasSaasEquivalent) {
    repurchase += 56;
    if (w.businessValueScore < 55) repurchase += 16;
    if (w.dbCoupling === 'None' || w.dbCoupling === 'Loose') repurchase += 10;
    if (w.eolOs) repurchase += 6;
  }

  // Rehost signals (rapid lift-and-shift for EOL OS, tight coupling, low cloud readiness)
  if (w.eolOs) {
    rehost += 24;
  }
  if (w.dbCoupling === 'Tight') {
    rehost += 18;
  } else if (w.dbCoupling === 'Mainframe') {
    rehost += 10;
  }
  if (w.cloudReadinessScore < 44) {
    rehost += 14;
  } else if (w.cloudReadinessScore <= 60) {
    rehost += 6;
  }
  if (w.criticality === 'Tier-1') {
    rehost += 8;
  }

  // Replatform signals (managed DB / containerization balance)
  if (w.cloudReadinessScore >= 45) {
    replatform += 16;
  }
  if (w.cloudReadinessScore >= 52 && w.cloudReadinessScore < 80) {
    replatform += 12;
  }
  if (w.dbCoupling === 'Loose') {
    replatform += 22;
  } else if (w.dbCoupling === 'Tight') {
    replatform += 14;
  } else if (w.dbCoupling === 'None') {
    replatform += 6;
  }
  if (w.eolOs && w.cloudReadinessScore >= 45) {
    replatform += 12;
  }
  if (w.businessValueScore >= 50) {
    replatform += 10;
  }
  if (w.cpuUtilPct < 50) {
    replatform += 8;
  }

  // Refactor signals (cloud-native re-architecture)
  if (w.dbCoupling === 'None') {
    refactor += 20;
  } else if (w.dbCoupling === 'Loose') {
    refactor += 10;
  } else if (w.dbCoupling === 'Tight') {
    refactor -= 14;
  } else if (w.dbCoupling === 'Mainframe') {
    refactor -= 28;
  }
  if (w.cpuUtilPct >= 55) {
    refactor += 8;
  }
  if (w.eolOs) {
    refactor -= 8;
  }
  if (w.regulatoryResidencyLock) {
    refactor -= 25;
    replatform -= 18;
    rehost -= 16;
  }
  if (w.decommissionCandidate) {
    rehost -= 15;
    replatform -= 18;
    refactor -= 20;
  }

  const scores: StrategyScoreBreakdown = {
    Rehost: Math.round(clamp(rehost, 0, 100)),
    Replatform: Math.round(clamp(replatform, 0, 100)),
    Refactor: Math.round(clamp(refactor, 0, 100)),
    Repurchase: Math.round(clamp(repurchase, 0, 100)),
    Retire: Math.round(clamp(retire, 0, 100)),
    Retain: Math.round(clamp(retain, 0, 100)),
  };

  const ranked = [...DISPOSITIONS].sort((a, b) => scores[b] - scores[a]);
  const disposition = ranked[0];
  const topScore = scores[ranked[0]];
  const runnerUpScore = scores[ranked[1]];

  const confidencePct = clamp(
    Math.round(54 + (topScore - runnerUpScore) * 1.45),
    55,
    98
  );

  // Complexity points (1..21)
  const basePointsByDisposition: Record<Disposition6R, number> = {
    Retire: 2,
    Retain: 2,
    Repurchase: 5,
    Rehost: 5,
    Replatform: 8,
    Refactor: 13,
  };
  let complexity = basePointsByDisposition[disposition];
  if (w.dbCoupling === 'Tight') complexity += 3;
  if (w.dbCoupling === 'Mainframe') complexity += 5;
  if (w.eolOs) complexity += 2;
  if (w.complianceTier === 'PCI-DSS' || w.complianceTier === 'HIPAA') complexity += 2;
  else if (w.complianceTier === 'ISO-27001') complexity += 1;
  complexity = clamp(complexity, 1, 21);

  // Risk assessment
  let riskScore = 0;
  if (w.eolOs) riskScore += 2;
  if (w.dbCoupling === 'Tight') riskScore += 1;
  if (w.dbCoupling === 'Mainframe') riskScore += 2;
  if (w.criticality === 'Tier-1') riskScore += 1;
  if (w.complianceTier === 'PCI-DSS' || w.complianceTier === 'HIPAA') riskScore += 1;
  if (disposition === 'Refactor' && w.criticality === 'Tier-1') riskScore += 1;
  if (w.dependencies.length >= 3) riskScore += 1;

  const riskLevel: RiskLevel =
    riskScore >= 4 ? 'High' : riskScore >= 2 ? 'Medium' : 'Low';

  // Rationale tags explaining winning strategy
  const rationaleTags: string[] = [];
  if (w.decommissionCandidate) rationaleTags.push('Decommission Flagged');
  if (w.regulatoryResidencyLock) rationaleTags.push('Residency / Latency Lock');
  if (w.hasSaasEquivalent && disposition === 'Repurchase')
    rationaleTags.push('Commercial SaaS Fit');
  if (w.eolOs) rationaleTags.push('EOL OS Mitigation');
  if (w.dbCoupling === 'Tight' || w.dbCoupling === 'Mainframe')
    rationaleTags.push(`${w.dbCoupling} DB Coupling`);
  if (w.cloudReadinessScore >= 75 && disposition === 'Refactor')
    rationaleTags.push('Cloud-Native Ready');
  if (w.businessValueScore >= 80 && disposition === 'Refactor')
    rationaleTags.push('Core IP Differentiation');
  if (disposition === 'Replatform' && w.dbCoupling === 'Loose')
    rationaleTags.push('Managed PaaS / RDS Fit');
  if (w.cpuUtilPct < 35 && disposition !== 'Retire')
    rationaleTags.push('Right-Sizing Opportunity');
  if (w.complianceTier !== 'Standard') rationaleTags.push(w.complianceTier);

  return {
    disposition,
    confidencePct,
    complexityPoints: complexity,
    riskLevel,
    rationaleTags: rationaleTags.slice(0, 4),
    scores,
  };
}

/**
 * Resolves application dependency DAG using Tarjan's Strongly Connected Components (SCC)
 * for exact cycle detection and Kahn's level-by-level topological sort over the condensed DAG
 * for deterministic migration wave assignment.
 */
export function analyzeDependencyGraph(
  workloads: Workload[],
  complexityById?: Record<string, number>
): DependencyGraphAnalysis {
  const nodeIds = workloads.map((w) => w.id);
  const idSet = new Set(nodeIds);
  const workloadById = new Map(workloads.map((w) => [w.id, w]));

  // Directed graph: edge u -> v means u must precede v (v depends on u)
  const adjacency = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    adjacency.set(id, new Set<string>());
  }

  const danglingDependencies: Array<{ workloadId: string; missingDependencyId: string }> = [];
  const rawEdges: Array<{ from: string; to: string }> = [];
  const edgeDedup = new Set<string>();

  for (const w of workloads) {
    for (const depId of w.dependencies) {
      if (!idSet.has(depId)) {
        danglingDependencies.push({ workloadId: w.id, missingDependencyId: depId });
        continue;
      }
      const key = `${depId}=>${w.id}`;
      if (!edgeDedup.has(key)) {
        edgeDedup.add(key);
        adjacency.get(depId)?.add(w.id);
        rawEdges.push({ from: depId, to: w.id });
      }
    }
  }

  // 1. Raw Kahn's topological pass to detect obstruction directly
  const rawInDegree = new Map<string, number>();
  for (const id of nodeIds) rawInDegree.set(id, 0);
  for (const edge of rawEdges) {
    rawInDegree.set(edge.to, (rawInDegree.get(edge.to) ?? 0) + 1);
  }
  const rawQueue: string[] = [];
  for (const id of nodeIds) {
    if ((rawInDegree.get(id) ?? 0) === 0) rawQueue.push(id);
  }
  let rawKahnProcessedCount = 0;
  let head = 0;
  while (head < rawQueue.length) {
    const curr = rawQueue[head++];
    rawKahnProcessedCount++;
    for (const next of adjacency.get(curr) ?? []) {
      const nextDeg = (rawInDegree.get(next) ?? 0) - 1;
      rawInDegree.set(next, nextDeg);
      if (nextDeg === 0) rawQueue.push(next);
    }
  }

  // 2. Tarjan's Strongly Connected Components (SCC)
  let currentIndex = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const rawSccs: string[][] = [];

  function strongConnect(v: string) {
    indices.set(v, currentIndex);
    lowlink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = Array.from(adjacency.get(v) ?? []).sort();
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let member = '';
      do {
        member = stack.pop()!;
        onStack.delete(member);
        scc.push(member);
      } while (member !== v);
      rawSccs.push(scc.sort());
    }
  }

  for (const id of [...nodeIds].sort()) {
    if (!indices.has(id)) {
      strongConnect(id);
    }
  }

  const sccIdByNode = new Map<string, string>();
  const cyclicSccs: SccComponent[] = [];
  const cyclicNodeSet = new Set<string>();
  const sccByNodeId: Record<string, string | null> = {};

  let sccCounter = 1;
  for (const members of rawSccs) {
    const hasSelfLoop =
      members.length === 1 && (adjacency.get(members[0])?.has(members[0]) ?? false);
    const isCycle = members.length > 1 || hasSelfLoop;
    const sccId = isCycle ? `SCC-${sccCounter++}` : `UNIT-${members[0]}`;

    for (const m of members) {
      sccIdByNode.set(m, sccId);
      if (isCycle) {
        cyclicNodeSet.add(m);
        sccByNodeId[m] = sccId;
      } else {
        sccByNodeId[m] = null;
      }
    }

    if (isCycle) {
      cyclicSccs.push({
        id: sccId,
        nodeIds: members,
        isCycle: true,
        remediationHint:
          members.length === 1
            ? `Remove self-referential dependency on ${members[0]} before wave scheduling.`
            : `Decouple circular dependency across ${members.join(', ')} via async event bridge or shared schema extraction.`,
      });
    }
  }

  const allEdges: DependencyEdge[] = rawEdges.map((e) => {
    const sameCycle =
      cyclicNodeSet.has(e.from) &&
      cyclicNodeSet.has(e.to) &&
      sccIdByNode.get(e.from) === sccIdByNode.get(e.to);
    return {
      from: e.from,
      to: e.to,
      isCyclic: sameCycle,
    };
  });
  const cyclicEdges = allEdges.filter((e) => e.isCyclic);

  // 3. Build Condensation DAG over SCCs and run Kahn's level-by-level topological sort
  const sccMembersMap = new Map<string, string[]>();
  for (const [nodeId, sccId] of sccIdByNode.entries()) {
    const list = sccMembersMap.get(sccId) ?? [];
    list.push(nodeId);
    sccMembersMap.set(sccId, list);
  }

  const sccIds = Array.from(sccMembersMap.keys()).sort();
  const sccAdj = new Map<string, Set<string>>();
  const sccInDegree = new Map<string, number>();
  for (const sccId of sccIds) {
    sccAdj.set(sccId, new Set<string>());
    sccInDegree.set(sccId, 0);
  }

  for (const edge of rawEdges) {
    const fromScc = sccIdByNode.get(edge.from)!;
    const toScc = sccIdByNode.get(edge.to)!;
    if (fromScc !== toScc && !sccAdj.get(fromScc)!.has(toScc)) {
      sccAdj.get(fromScc)!.add(toScc);
      sccInDegree.set(toScc, (sccInDegree.get(toScc) ?? 0) + 1);
    }
  }

  let currentWaveSccs = sccIds.filter((id) => (sccInDegree.get(id) ?? 0) === 0);
  const waveByNodeId: Record<string, number> = {};
  const waves: WaveGroup[] = [];
  let waveNum = 1;

  while (currentWaveSccs.length > 0) {
    const nextWaveSet = new Set<string>();
    const waveNodeIds: string[] = [];

    for (const sccId of currentWaveSccs.sort()) {
      const members = sccMembersMap.get(sccId) ?? [];
      for (const m of members) {
        waveNodeIds.push(m);
        waveByNodeId[m] = waveNum;
      }

      for (const neighborScc of sccAdj.get(sccId) ?? []) {
        const deg = (sccInDegree.get(neighborScc) ?? 0) - 1;
        sccInDegree.set(neighborScc, deg);
        if (deg === 0) {
          nextWaveSet.add(neighborScc);
        }
      }
    }

    waveNodeIds.sort();
    const hasCycleNode = waveNodeIds.some((id) => cyclicNodeSet.has(id));
    const totalComplexityPoints = waveNodeIds.reduce(
      (sum, id) => sum + (complexityById?.[id] ?? 5),
      0
    );
    const totalMonthlyOnPremUsd = waveNodeIds.reduce(
      (sum, id) => sum + (workloadById.get(id)?.monthlyOnPremCostUsd ?? 0),
      0
    );

    waves.push({
      waveIndex: waveNum,
      label: hasCycleNode ? `Wave ${waveNum} (Cycle Blocked)` : `Wave ${waveNum}`,
      nodeIds: waveNodeIds,
      hasCycleNode,
      totalComplexityPoints,
      totalMonthlyOnPremUsd,
    });

    currentWaveSccs = Array.from(nextWaveSet);
    waveNum++;
  }

  return {
    hasCycle: cyclicSccs.length > 0,
    cycleCount: cyclicSccs.length,
    cyclicNodeIds: Array.from(cyclicNodeSet).sort(),
    cyclicEdges,
    allEdges,
    sccs: cyclicSccs,
    waves,
    waveByNodeId,
    sccByNodeId,
    danglingDependencies,
    rawKahnProcessedCount,
    totalNodes: workloads.length,
  };
}

/**
 * Full portfolio migration evaluation: runs 6R multi-criteria scoring and
 * topological dependency resolution together into unified WorkloadAssessment records.
 */
export function analyzePortfolioMigration(
  workloads: Workload[]
): PortfolioMigrationAnalysis {
  const scoredById = new Map<string, Scored6RResult>();
  const complexityById: Record<string, number> = {};

  for (const w of workloads) {
    const scored = scoreWorkload6R(w);
    scoredById.set(w.id, scored);
    complexityById[w.id] = scored.complexityPoints;
  }

  const graph = analyzeDependencyGraph(workloads, complexityById);
  const cyclicSet = new Set(graph.cyclicNodeIds);

  const downstreamMap = new Map<string, string[]>();
  const upstreamMap = new Map<string, string[]>();
  for (const w of workloads) {
    downstreamMap.set(w.id, []);
    upstreamMap.set(w.id, []);
  }
  for (const edge of graph.allEdges) {
    downstreamMap.get(edge.from)?.push(edge.to);
    upstreamMap.get(edge.to)?.push(edge.from);
  }

  // Mark transitive downstream nodes of cycles as blocked too
  const blockedSet = new Set<string>(cyclicSet);
  const bfsQueue = Array.from(cyclicSet);
  let idx = 0;
  while (idx < bfsQueue.length) {
    const curr = bfsQueue[idx++];
    for (const child of downstreamMap.get(curr) ?? []) {
      if (!blockedSet.has(child)) {
        blockedSet.add(child);
        bfsQueue.push(child);
      }
    }
  }

  const dispositionCounts: Record<Disposition6R, number> = {
    Rehost: 0,
    Replatform: 0,
    Refactor: 0,
    Repurchase: 0,
    Retire: 0,
    Retain: 0,
  };

  let eolCount = 0;
  let highRiskCount = 0;
  let totalMonthlyOnPremUsd = 0;

  const assessments: WorkloadAssessment[] = workloads.map((w) => {
    const scored = scoredById.get(w.id)!;
    dispositionCounts[scored.disposition]++;
    if (w.eolOs) eolCount++;
    if (scored.riskLevel === 'High' || cyclicSet.has(w.id)) highRiskCount++;
    totalMonthlyOnPremUsd += w.monthlyOnPremCostUsd;

    return {
      workload: w,
      disposition: scored.disposition,
      confidencePct: scored.confidencePct,
      complexityPoints: scored.complexityPoints,
      riskLevel: cyclicSet.has(w.id) ? 'High' : scored.riskLevel,
      rationaleTags: cyclicSet.has(w.id)
        ? ['Cycle Blocker', ...scored.rationaleTags].slice(0, 4)
        : scored.rationaleTags,
      scores: scored.scores,
      waveIndex: graph.waveByNodeId[w.id] ?? 1,
      blockedByCycle: blockedSet.has(w.id),
      sccId: graph.sccByNodeId[w.id] ?? null,
      upstreamIds: (upstreamMap.get(w.id) ?? []).sort(),
      downstreamIds: (downstreamMap.get(w.id) ?? []).sort(),
    };
  });

  const assessmentById: Record<string, WorkloadAssessment> = {};
  for (const a of assessments) {
    assessmentById[a.workload.id] = a;
  }

  return {
    assessments,
    assessmentById,
    graph,
    dispositionCounts,
    eolCount,
    highRiskCount,
    totalMonthlyOnPremUsd,
  };
}
