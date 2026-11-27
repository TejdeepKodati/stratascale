export type Disposition6R =
  | 'Rehost'
  | 'Replatform'
  | 'Refactor'
  | 'Repurchase'
  | 'Retire'
  | 'Retain';

export type ComplianceTier = 'PCI-DSS' | 'HIPAA' | 'ISO-27001' | 'SOC2' | 'Standard';

export type CriticalityTier = 'Tier-1' | 'Tier-2' | 'Tier-3';

export type DbCouplingLevel = 'None' | 'Loose' | 'Tight' | 'Mainframe';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type CloudRegionId = 'ap-south-1' | 'us-east-1' | 'eu-central-1';

export type WorkspaceView = 'matrix' | 'dag' | 'finops' | 'ingestion';

export interface Workload {
  id: string;
  name: string;
  domain: string;
  environment: 'Production' | 'Staging' | 'DR';
  os: string;
  eolOs: boolean;
  complianceTier: ComplianceTier;
  criticality: CriticalityTier;
  vcpus: number;
  ramGb: number;
  storageTb: number;
  cpuUtilPct: number;
  ramUtilPct: number;
  monthlyEgressGb: number;
  dbCoupling: DbCouplingLevel;
  hasSaasEquivalent: boolean;
  cloudReadinessScore: number;
  businessValueScore: number;
  regulatoryResidencyLock: boolean;
  decommissionCandidate: boolean;
  monthlyOnPremCostUsd: number;
  /** Upstream prerequisite workload IDs that must migrate before or alongside this workload. */
  dependencies: string[];
  notes?: string;
}

export interface PortfolioSeed {
  id: string;
  name: string;
  sector: string;
  description: string;
  workloads: Workload[];
  /** Optional synthetic circular edges used by the UI cycle-detection test toggle. */
  cycleTestEdges: Array<{ workloadId: string; addDependencyId: string }>;
  cycleTestDescription: string;
}

export interface StrategyScoreBreakdown {
  Rehost: number;
  Replatform: number;
  Refactor: number;
  Repurchase: number;
  Retire: number;
  Retain: number;
}

export interface WorkloadAssessment {
  workload: Workload;
  disposition: Disposition6R;
  confidencePct: number;
  complexityPoints: number;
  riskLevel: RiskLevel;
  rationaleTags: string[];
  scores: StrategyScoreBreakdown;
  waveIndex: number;
  blockedByCycle: boolean;
  sccId: string | null;
  upstreamIds: string[];
  downstreamIds: string[];
}

export interface SccComponent {
  id: string;
  nodeIds: string[];
  isCycle: boolean;
  remediationHint: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  isCyclic: boolean;
}

export interface WaveGroup {
  waveIndex: number;
  label: string;
  nodeIds: string[];
  hasCycleNode: boolean;
  totalComplexityPoints: number;
  totalMonthlyOnPremUsd: number;
}

export interface DependencyGraphAnalysis {
  hasCycle: boolean;
  cycleCount: number;
  cyclicNodeIds: string[];
  cyclicEdges: DependencyEdge[];
  allEdges: DependencyEdge[];
  sccs: SccComponent[];
  waves: WaveGroup[];
  waveByNodeId: Record<string, number>;
  sccByNodeId: Record<string, string | null>;
  danglingDependencies: Array<{ workloadId: string; missingDependencyId: string }>;
  rawKahnProcessedCount: number;
  totalNodes: number;
}

export interface PortfolioMigrationAnalysis {
  assessments: WorkloadAssessment[];
  assessmentById: Record<string, WorkloadAssessment>;
  graph: DependencyGraphAnalysis;
  dispositionCounts: Record<Disposition6R, number>;
  eolCount: number;
  highRiskCount: number;
  totalMonthlyOnPremUsd: number;
}

export interface CommitmentMix {
  onDemandPct: number;
  oneYearSavingsPct: number;
  threeYearReservedPct: number;
}

export interface FinopsAssumptions {
  commitmentMix: CommitmentMix;
  targetUtilizationPct: number;
  targetRegion: CloudRegionId;
  contingencyPct: number;
}

export interface RegionProfile {
  id: CloudRegionId;
  name: string;
  city: string;
  costMultiplier: number;
  pue: number;
  gridCarbonKgPerKwh: number;
  egressRatePerGbUsd: number;
}

export interface WorkloadFinopsProjection {
  workloadId: string;
  disposition: Disposition6R;
  waveIndex: number;
  cutoverMonth: number;
  rightSizedVcpus: number;
  rightSizedRamGb: number;
  monthlyOnPremUsd: number;
  monthlyCloudComputeUsd: number;
  monthlyCloudStorageUsd: number;
  monthlyCloudEgressUsd: number;
  monthlySaasUsd: number;
  monthlyRetainedOnPremUsd: number;
  steadyStateMonthlyCloudUsd: number;
  monthlyDeltaUsd: number;
  oneTimeMigrationLaborUsd: number;
  contingencyUsd: number;
  totalMigrationInvestmentUsd: number;
  annualOnPremCo2eTons: number;
  annualCloudCo2eTons: number;
}

export interface CashflowMonthPoint {
  month: number;
  waveEvents: string[];
  onPremMonthlyUsd: number;
  cloudRunMonthlyUsd: number;
  migrationLaborMonthlyUsd: number;
  totalCloudScenarioMonthlyUsd: number;
  cumulativeOnPremUsd: number;
  cumulativeCloudScenarioUsd: number;
  cumulativeNetSavingsUsd: number;
}

export interface FinopsSimulationResult {
  assumptions: FinopsAssumptions;
  region: RegionProfile;
  workloadProjections: WorkloadFinopsProjection[];
  projectionById: Record<string, WorkloadFinopsProjection>;
  monthlySeries: CashflowMonthPoint[];
  steadyStateMonthlyOnPremUsd: number;
  steadyStateMonthlyCloudUsd: number;
  steadyStateMonthlySavingsUsd: number;
  threeYearOnPremTcoUsd: number;
  threeYearCloudTcoUsd: number;
  threeYearNetSavingsUsd: number;
  threeYearSavingsPct: number;
  breakEvenMonth: number | null;
  totalMigrationLaborUsd: number;
  totalContingencyUsd: number;
  annualCo2eBaselineTons: number;
  annualCo2eCloudTons: number;
  annualCo2eReductionTons: number;
  co2eReductionPct: number;
  costBreakdown3Yr: {
    computeUsd: number;
    storageUsd: number;
    egressUsd: number;
    saasUsd: number;
    retainedOnPremUsd: number;
    migrationLaborAndContingencyUsd: number;
  };
  rightSizingSummary: {
    provisionedVcpus: number;
    rightSizedVcpus: number;
    vcpuReductionPct: number;
    provisionedRamGb: number;
    rightSizedRamGb: number;
  };
}

export type CanonicalWorkloadField =
  | 'id'
  | 'name'
  | 'domain'
  | 'environment'
  | 'os'
  | 'eolOs'
  | 'complianceTier'
  | 'criticality'
  | 'vcpus'
  | 'ramGb'
  | 'storageTb'
  | 'cpuUtilPct'
  | 'ramUtilPct'
  | 'monthlyEgressGb'
  | 'dbCoupling'
  | 'hasSaasEquivalent'
  | 'cloudReadinessScore'
  | 'businessValueScore'
  | 'regulatoryResidencyLock'
  | 'decommissionCandidate'
  | 'monthlyOnPremCostUsd'
  | 'dependencies'
  | 'notes';

export type ColumnMapping = Partial<Record<CanonicalWorkloadField, string>>;

export interface IngestionResult {
  workloads: Workload[];
  detectedHeaders: string[];
  appliedMapping: ColumnMapping;
  rawRowCount: number;
  warnings: string[];
  errors: string[];
  rawRows?: Array<Record<string, string>>;
}

export interface ExportRequestPayload {
  portfolioName: string;
  workloads: Workload[];
  assumptions: FinopsAssumptions;
}
