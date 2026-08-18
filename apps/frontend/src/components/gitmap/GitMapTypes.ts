export type ModuleCategory =
  | 'FRONTEND'
  | 'BACKEND'
  | 'API'
  | 'DATABASE'
  | 'AUTH'
  | 'AI'
  | 'SERVICES'
  | 'COMPONENTS'
  | 'UTILS'
  | 'CONFIG'
  | 'TESTS'
  | 'DOCS'
  | 'INFRA'
  | 'SCRIPTS';

export type RelationshipType =
  | 'IMPORTS'
  | 'EXPORTS'
  | 'CALLS'
  | 'USES'
  | 'API_CALL'
  | 'DEPENDS_ON'
  | 'READS_FROM'
  | 'WRITES_TO'
  | 'CONTAINS';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type GitMapViewMode =
  | 'architecture' // Modules & system-level connections
  | 'files'        // All files and internal imports
  | 'deps'         // External packages and dependencies
  | 'git'          // Commit frequency and hotspots
  | 'contributors' // Contributor ownership & distribution
  | 'impact';      // Blast radius simulation

export interface GitMapNode {
  id: string;
  name: string;
  path: string;
  directory: string;
  moduleId: string;
  moduleName: string;
  category: ModuleCategory;
  language: string;
  linesOfCode: number;
  sizeBytes: number;
  isEntryPoint: boolean;
  isTest: boolean;
  isConfig: boolean;
  inDegree: number;
  outDegree: number;
  centralityScore: number;
  importanceScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  commitCount: number;
  lastModifiedDate?: string;
  topContributor?: string;
  contributorCount: number;
  contributors: Array<{ name: string; commits: number; percentage: number }>;
  isHotspot: boolean;
  imports: string[];
  exports: string[];
  apiEndpoints?: string[];
  databaseModels?: string[];
  summary?: string;
}

export interface GitMapEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  specifier?: string;
  isInternal: boolean;
  confidence?: 'CONFIRMED' | 'INFERRED';
  description?: string;
}

export interface GitMapModule {
  id: string;
  name: string;
  category: ModuleCategory;
  directory: string;
  description: string;
  fileCount: number;
  totalLines: number;
  isCore: boolean;
  importanceScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  files: string[];
  topContributors: Array<{ name: string; commits: number; percentage: number }>;
  busFactorRisk: 'HIGH' | 'MODERATE' | 'BALANCED';
  summary?: string;
}

export interface GitMapDependency {
  name: string;
  version?: string;
  type: 'runtime' | 'dev' | 'peer' | 'transitive';
  sourceManifest: string;
  usedByFiles: string[];
  category?: 'FRAMEWORK' | 'DATABASE' | 'SECURITY' | 'UTILITY' | 'AI' | 'TESTING' | 'UI' | 'OTHER';
}

export interface GitContributorStats {
  name: string;
  email?: string;
  commits: number;
  percentage: number;
  primaryModules: string[];
  activeFilesCount: number;
  lastActive?: string;
}

export interface GitActivityData {
  totalCommitsAnalyzed: number;
  hotspots: Array<{
    filePath: string;
    commitCount: number;
    churnScore: number;
    contributorsCount: number;
    lastModified: string;
  }>;
  recentChanges: Array<{
    filePath: string;
    lastModified: string;
    lastCommitMessage?: string;
    lastAuthor?: string;
  }>;
  longUnmodifiedFiles: Array<{
    filePath: string;
    lastModified: string;
  }>;
  contributorConcentrationRisk: Array<{
    moduleName: string;
    primaryContributor: string;
    percentage: number;
    risk: 'HIGH' | 'MODERATE';
    recommendation: string;
  }>;
}

export interface TechnicalDebtIndicators {
  todoCount: number;
  fixmeCount: number;
  largeFilesCount: number;
  potentiallyUnreferencedFilesCount: number;
  outdatedDependenciesCount: number;
  highRiskModulesCount: number;
  items: Array<{
    type: 'TODO_FIXME' | 'LARGE_FILE' | 'UNREFERENCED' | 'HIGH_CHURN' | 'COMPLEXITY';
    filePath: string;
    title: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export interface HealthBreakdown {
  overallScore: number;
  structureScore: number;
  documentationScore: number;
  testingScore: number;
  dependencyHealthScore: number;
  ownershipDistributionScore: number;
  notes: string[];
}

export interface OnboardingStep {
  step: number;
  title: string;
  path: string;
  type: 'ENTRY_POINT' | 'CORE_BUSINESS' | 'API_LAYER' | 'DATABASE_LAYER' | 'CONFIGURATION';
  whatItDoes: string;
  whyItMatters: string;
  connectsTo: string[];
}

export interface ArchitectureFlowStep {
  order: number;
  component: string;
  nodeId?: string;
  action: string;
  target: string;
  targetNodeId?: string;
  description: string;
}

export interface HowItWorksResponse {
  query: string;
  overview: string;
  executionPath: ArchitectureFlowStep[];
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  involvedModules: string[];
  keyFiles: Array<{ path: string; role: string }>;
}

export interface ImpactAnalysisResponse {
  targetNodeId: string;
  targetName: string;
  targetCategory: ModuleCategory;
  impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  directDependentsCount: number;
  indirectDependentsCount: number;
  affectedModulesCount: number;
  affectedModules: string[];
  directDependents: Array<{
    id: string;
    path: string;
    relationship: string;
    confidence: 'CONFIRMED' | 'INFERRED';
  }>;
  indirectDependents: Array<{
    id: string;
    path: string;
    depth: number;
  }>;
  aiExplanation: string;
  riskMitigationRecommendations: string[];
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
}

export interface GitMapGraphPayload {
  repositoryId: string;
  commitSha: string;
  generatedAt: string;
  stats: {
    totalFiles: number;
    totalModules: number;
    totalLines: number;
    totalRelationships: number;
    totalDependencies: number;
    totalContributors: number;
    highRiskFilesCount: number;
  };
  modules: GitMapModule[];
  nodes: GitMapNode[];
  edges: GitMapEdge[];
  dependencies: GitMapDependency[];
  gitActivity: GitActivityData;
  contributors: GitContributorStats[];
  health: HealthBreakdown;
  technicalDebt: TechnicalDebtIndicators;
  overviewSummary?: string;
  onboardingGuide?: OnboardingStep[];
}
