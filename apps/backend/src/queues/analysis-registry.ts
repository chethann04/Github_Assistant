import { IntelligenceService } from '../services/intelligence.service.js';
import { DependencyGraphService } from '../services/dependency-graph.service.js';
import { GitHubService } from '../services/github.service.js';
import { RAGService } from '../services/rag.service.js';
import prisma from '../config/prisma.js';

export type SupportedAnalysisType =
  | 'ARCHITECTURE'
  | 'DEPENDENCY_GRAPH'
  | 'DOCUMENTATION'
  | 'CODE_REVIEW'
  | 'SECURITY_AUDIT'
  | 'TEST_GENERATOR'
  | 'COMPARE_REPOS'
  | 'IMPACT_ANALYSIS'
  | 'HEALTH_SCORE'
  | 'CODE_SEARCH'
  | 'COMMIT_ANALYSIS'
  | 'FILES_ANALYSIS';

export interface ProgressCallback {
  (progress: number, currentStage: string): Promise<void>;
}

export interface AnalysisExecutionContext {
  jobId: string;
  repositoryId: string;
  sessionId: string;
  type: string;
  targetParam?: string | null;
  params?: any;
  commitSha?: string;
  signal: AbortSignal;
  onProgress: ProgressCallback;
}

export interface AnalysisExecutor {
  (context: AnalysisExecutionContext): Promise<any>;
}

/**
 * Normalizes input type string to standard uppercase enum.
 */
export function normalizeAnalysisType(rawType: string): SupportedAnalysisType {
  const t = (rawType || '').trim().toUpperCase().replace(/-/g, '_');
  switch (t) {
    case 'ARCHITECTURE':
    case 'ARCH':
      return 'ARCHITECTURE';
    case 'DEPENDENCY_GRAPH':
    case 'DEPENDENCY':
    case 'DEPS':
      return 'DEPENDENCY_GRAPH';
    case 'DOCUMENTATION':
    case 'DOCS':
    case 'DOC':
      return 'DOCUMENTATION';
    case 'CODE_REVIEW':
    case 'BUGS':
    case 'BUG_DETECTOR':
      return 'CODE_REVIEW';
    case 'SECURITY_AUDIT':
    case 'SECURITY':
      return 'SECURITY_AUDIT';
    case 'TEST_GENERATOR':
    case 'TESTS':
    case 'TEST':
      return 'TEST_GENERATOR';
    case 'COMPARE_REPOS':
    case 'COMPARE':
      return 'COMPARE_REPOS';
    case 'IMPACT_ANALYSIS':
    case 'IMPACT':
      return 'IMPACT_ANALYSIS';
    case 'HEALTH_SCORE':
    case 'HEALTH':
      return 'HEALTH_SCORE';
    case 'CODE_SEARCH':
    case 'SEARCH':
      return 'CODE_SEARCH';
    case 'COMMIT_ANALYSIS':
    case 'COMMITS':
      return 'COMMIT_ANALYSIS';
    case 'FILES_ANALYSIS':
    case 'FILES':
      return 'FILES_ANALYSIS';
    default:
      return t as SupportedAnalysisType;
  }
}

/**
 * Registry of all background analysis executors with granular stage reporting.
 */
export class AnalysisJobRegistry {
  private static executors = new Map<SupportedAnalysisType, AnalysisExecutor>();

  public static register(type: SupportedAnalysisType, executor: AnalysisExecutor): void {
    this.executors.set(type, executor);
  }

  public static getExecutor(type: string): AnalysisExecutor | undefined {
    const normalized = normalizeAnalysisType(type);
    return this.executors.get(normalized);
  }

  public static isSupported(type: string): boolean {
    const normalized = normalizeAnalysisType(type);
    return this.executors.has(normalized);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER CORE ANALYSIS EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

// 1. SECURITY AUDIT
AnalysisJobRegistry.register('SECURITY_AUDIT', async ({ repositoryId, targetParam, onProgress, signal }) => {
  await onProgress(10, 'Loading repository file tree');
  if (signal.aborted) return null;

  await onProgress(25, 'Scanning dependencies & configuration');
  if (signal.aborted) return null;

  await onProgress(45, 'Scanning secrets & hardcoded keys');
  if (signal.aborted) return null;

  await onProgress(65, 'Analyzing injection & authentication risks');
  if (signal.aborted) return null;

  await onProgress(85, 'Running AI verification with OWASP rules');
  if (signal.aborted) return null;

  const forceRescan = Boolean(targetParam === 'force' || targetParam === 'true');
  const findings = await IntelligenceService.scanSecurity(repositoryId, forceRescan);
  if (signal.aborted) return null;

  await onProgress(95, 'Synthesizing remediation report');
  return findings;
});

// 2. CODE REVIEW / BUGS
AnalysisJobRegistry.register('CODE_REVIEW', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(15, 'Loading repository code chunks');
  if (signal.aborted) return null;

  await onProgress(40, 'Retrieving adaptive semantic context');
  if (signal.aborted) return null;

  await onProgress(65, 'Analyzing defects, logic errors & anti-patterns');
  if (signal.aborted) return null;

  const bugs = await IntelligenceService.detectBugs(repositoryId);
  if (signal.aborted) return null;

  await onProgress(90, 'Synthesizing code fixes and diffs');
  return bugs;
});

// 3. ARCHITECTURE SYNTHESIS
AnalysisJobRegistry.register('ARCHITECTURE', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(15, 'Mapping repository files & component hierarchy');
  if (signal.aborted) return null;

  await onProgress(45, 'Extracting cross-module dependencies & data flows');
  if (signal.aborted) return null;

  await onProgress(75, 'Synthesizing Mermaid flowchart & architectural summary');
  if (signal.aborted) return null;

  const architecture = await IntelligenceService.generateArchitecture(repositoryId);
  if (signal.aborted) return null;

  await onProgress(95, 'Finalizing system design analysis');
  return { architecture };
});

// 4. DOCUMENTATION GENERATOR
AnalysisJobRegistry.register('DOCUMENTATION', async ({ repositoryId, targetParam, onProgress, signal }) => {
  const docType = (targetParam as 'readme' | 'api' | 'docstrings') || 'readme';
  await onProgress(20, `Loading code context for ${docType.toUpperCase()}`);
  if (signal.aborted) return null;

  await onProgress(50, 'Analyzing exported APIs and module contracts');
  if (signal.aborted) return null;

  await onProgress(80, 'Drafting structured technical documentation');
  if (signal.aborted) return null;

  const docs = await IntelligenceService.generateDocs(repositoryId, docType);
  if (signal.aborted) return null;

  return { docs, docType };
});

// 5. DEPENDENCY GRAPH
AnalysisJobRegistry.register('DEPENDENCY_GRAPH', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(25, 'Scanning import & export statements across files');
  if (signal.aborted) return null;

  await onProgress(65, 'Constructing graph nodes and edge topology');
  if (signal.aborted) return null;

  const graph = await DependencyGraphService.buildGraph(repositoryId);
  if (signal.aborted) return null;

  await onProgress(90, 'Calculating complexity and circular dependencies');
  return graph;
});

// 6. TEST GENERATOR
AnalysisJobRegistry.register('TEST_GENERATOR', async ({ repositoryId, targetParam, params, onProgress, signal }) => {
  const filePath = params?.filePath || targetParam?.split(':')[0] || 'src/index.ts';
  const framework = params?.framework || targetParam?.split(':')[1] || 'vitest';

  await onProgress(25, `Inspecting exported functions and types in ${filePath}`);
  if (signal.aborted) return null;

  await onProgress(65, `Synthesizing ${framework} test suite with edge cases`);
  if (signal.aborted) return null;

  const testSuite = await IntelligenceService.generateTests(repositoryId, filePath, framework);
  if (signal.aborted) return null;

  return { testSuite, filePath, framework };
});

// 7. IMPACT ANALYSIS
AnalysisJobRegistry.register('IMPACT_ANALYSIS', async ({ repositoryId, targetParam, params, onProgress, signal }) => {
  const filePath = params?.filePath || targetParam || 'src/index.ts';

  await onProgress(25, `Analyzing dependencies and imports for ${filePath}`);
  if (signal.aborted) return null;

  await onProgress(60, 'Tracing callers, consumers and blast radius');
  if (signal.aborted) return null;

  const impact = await IntelligenceService.analyzeImpact(repositoryId, filePath);
  if (signal.aborted) return null;

  return impact;
});

// 8. HEALTH SCORE
AnalysisJobRegistry.register('HEALTH_SCORE', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(20, 'Inspecting repository activity and maintenance metrics');
  if (signal.aborted) return null;

  await onProgress(60, 'Evaluating test coverage, documentation & security posture');
  if (signal.aborted) return null;

  const health = await IntelligenceService.calculateHealthScore(repositoryId);
  if (signal.aborted) return null;

  return health;
});

// 9. COMPARE REPOSITORIES
AnalysisJobRegistry.register('COMPARE_REPOS', async ({ repositoryId, targetParam, params, onProgress, signal }) => {
  const targetRepoId = params?.targetRepoId || targetParam;
  if (!targetRepoId) throw new Error('Target repository ID is required for comparison.');

  await onProgress(20, 'Loading comparison metadata for both repositories');
  if (signal.aborted) return null;

  const [repo1, repo2] = await Promise.all([
    prisma.repository.findUnique({ where: { id: repositoryId } }),
    prisma.repository.findUnique({ where: { id: targetRepoId } }),
  ]);

  if (!repo1 || !repo2) throw new Error('One or both repositories not found.');

  await onProgress(50, `Calculating health score for ${repo1.name}`);
  const health1 = await IntelligenceService.calculateHealthScore(repo1.id);
  if (signal.aborted) return null;

  await onProgress(80, `Calculating health score for ${repo2.name}`);
  const health2 = await IntelligenceService.calculateHealthScore(repo2.id);
  if (signal.aborted) return null;

  return {
    repo1: {
      id: repo1.id,
      name: repo1.name,
      owner: repo1.owner,
      language: repo1.language,
      stars: repo1.stars,
      forks: repo1.forks,
      health: health1,
    },
    repo2: {
      id: repo2.id,
      name: repo2.name,
      owner: repo2.owner,
      language: repo2.language,
      stars: repo2.stars,
      forks: repo2.forks,
      health: health2,
    },
  };
});

// 10. COMMIT ANALYSIS
AnalysisJobRegistry.register('COMMIT_ANALYSIS', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(20, 'Fetching commit logs from repository');
  if (signal.aborted) return null;

  const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repo) throw new Error('Repository not found.');

  await onProgress(60, 'Analyzing commit velocity, contributors, and churn');
  if (signal.aborted) return null;

  const data = await IntelligenceService.fetchCommitHistory(repo.owner, repo.name);
  return data;
});

// 11. FILES ANALYSIS
AnalysisJobRegistry.register('FILES_ANALYSIS', async ({ repositoryId, onProgress, signal }) => {
  await onProgress(30, 'Listing indexed files and tree structure');
  if (signal.aborted) return null;

  const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repo) throw new Error('Repository not found.');

  const files = await GitHubService.fetchRepoFileTree(
    repo.owner,
    repo.name,
    repo.latestCommit || repo.defaultBranch || 'main'
  );
  return { files, total: files.length };
});

// 12. CODE SEARCH
AnalysisJobRegistry.register('CODE_SEARCH', async ({ repositoryId, targetParam, params, onProgress, signal }) => {
  const query = params?.query || targetParam || '';
  await onProgress(30, `Searching indexed chunks for "${query}"`);
  if (signal.aborted) return null;

  const { citations } = await RAGService.retrieveContext(query, repositoryId, 10);
  return { results: citations || [], query };
});
