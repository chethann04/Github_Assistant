import prisma from '../../config/prisma.js';
import { GitHubService } from '../github.service.js';
import { GitMapClassifier } from './gitmap-classifier.js';
import { GitMapParser } from './gitmap-parser.js';
import { GitMapManifestParser } from './gitmap-manifest-parser.js';
import { GitMapGitAnalyzer } from './gitmap-git-analyzer.js';
import { GitMapGraphBuilder } from './gitmap-graph-builder.js';
import { GitMapAIService } from './gitmap-ai.service.js';
import {
  GitMapGraphPayload,
  GitMapModule,
  GitMapNode,
  GitMapEdge,
  GitMapDependency,
  ModuleCategory,
} from './gitmap.types.js';

export class GitMapAnalyzerService {
  private static memoryCache = new Map<string, { payload: GitMapGraphPayload; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Get cached or existing analysis for a repository
   */
  public static async getAnalysis(repoId: string): Promise<GitMapGraphPayload | null> {
    const cached = this.memoryCache.get(repoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const record = await (prisma as any).gitMapAnalysis.findFirst({
      where: { repositoryId: repoId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || !record.modulesData || !record.nodesData) {
      return null;
    }

    const payload: GitMapGraphPayload = {
      repositoryId: record.repositoryId,
      commitSha: record.commitSha || 'latest',
      generatedAt: record.updatedAt.toISOString(),
      stats: {
        totalFiles: record.totalFiles,
        totalModules: record.totalModules,
        totalLines: record.totalLines,
        totalRelationships: (record.edgesData as any[])?.length || 0,
        totalDependencies: (record.dependenciesData as any[])?.length || 0,
        totalContributors: (record.contributorsData as any[])?.length || 0,
        highRiskFilesCount: (record.technicalDebt as any)?.highRiskModulesCount || 0,
      },
      modules: record.modulesData as any,
      nodes: record.nodesData as any,
      edges: record.edgesData as any,
      dependencies: record.dependenciesData as any,
      gitActivity: record.gitActivityData as any,
      contributors: record.contributorsData as any,
      health: record.healthBreakdown as any,
      technicalDebt: record.technicalDebt as any,
      overviewSummary: record.overviewSummary || undefined,
      onboardingGuide: record.onboardingGuide as any,
    };

    this.memoryCache.set(repoId, { payload, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return payload;
  }

  /**
   * Run Stage A deterministic analysis (Fast, No LLM)
   */
  public static async runAnalysis(repoId: string, sessionId: string, force = false): Promise<GitMapGraphPayload> {
    if (force) {
      this.memoryCache.delete(repoId);
    } else {
      const existing = await this.getAnalysis(repoId);
      if (existing) return existing;
    }

    const repo = await prisma.repository.findFirst({
      where: { id: repoId, sessionId },
    });

    if (!repo) {
      throw new Error('Repository not found or access denied');
    }

    const commitSha = repo.latestCommit || repo.defaultBranch || 'main';

    // 1. Create or update GitMapAnalysis record in PENDING state
    const analysisRecord = await (prisma as any).gitMapAnalysis.create({
      data: {
        sessionId,
        repositoryId: repo.id,
        commitSha,
        status: 'ANALYZING',
        progress: 10,
        currentStage: 'Discovering repository structure and files',
        startedAt: new Date(),
      },
    });

    try {
      // 2. Fetch full file tree
      const rawTree = await GitHubService.fetchRepoFileTree(repo.owner, repo.name, commitSha);
      const allFilesSet = new Set(rawTree.map((f) => f.path));

      // Filter non-essential / lockfiles
      const targetFiles = rawTree.filter((f) => {
        const lower = f.path.toLowerCase();
        return (
          !lower.includes('node_modules/') &&
          !lower.includes('.git/') &&
          !lower.includes('dist/') &&
          !lower.includes('build/') &&
          !lower.includes('.next/') &&
          !lower.endsWith('.lock') &&
          !lower.endsWith('-lock.json')
        );
      });

      // 3. Classify all files and cluster into modules
      const rawNodes: GitMapNode[] = [];
      const moduleMap = new Map<string, GitMapModule>();
      const manifestFiles: string[] = [];

      for (const file of targetFiles) {
        const classification = GitMapClassifier.classifyFile(file.path);
        const fileName = file.path.split('/').pop() || file.path;
        const directory = file.path.split('/').slice(0, -1).join('/') || 'root';

        if (
          fileName === 'package.json' ||
          fileName === 'requirements.txt' ||
          fileName === 'pyproject.toml' ||
          fileName === 'go.mod' ||
          fileName === 'Cargo.toml'
        ) {
          manifestFiles.push(file.path);
        }

        // Register module
        if (!moduleMap.has(classification.moduleKey)) {
          moduleMap.set(classification.moduleKey, {
            id: classification.moduleKey,
            name: classification.moduleName,
            category: classification.category,
            directory,
            description: `${classification.moduleName} functional layer`,
            fileCount: 0,
            totalLines: 0,
            isCore: classification.category === 'AUTH' || classification.category === 'API' || classification.category === 'DATABASE',
            importanceScore: 50,
            riskScore: 30,
            riskLevel: 'LOW',
            riskFactors: [],
            files: [],
            topContributors: [],
            busFactorRisk: 'BALANCED',
          });
        }

        const mod = moduleMap.get(classification.moduleKey)!;
        mod.files.push(file.path);
        mod.fileCount++;

        rawNodes.push({
          id: file.path,
          name: fileName,
          path: file.path,
          directory,
          moduleId: classification.moduleKey,
          moduleName: classification.moduleName,
          category: classification.category,
          language: classification.language,
          linesOfCode: 0, // will be updated if content sampled
          sizeBytes: file.size || 0,
          isEntryPoint: classification.isEntryPoint,
          isTest: classification.isTest,
          isConfig: classification.isConfig,
          inDegree: 0,
          outDegree: 0,
          centralityScore: 0,
          importanceScore: 50,
          riskScore: 20,
          riskLevel: 'LOW',
          riskReasons: [],
          commitCount: 1,
          contributorCount: 1,
          contributors: [],
          isHotspot: false,
          imports: [],
          exports: [],
        });
      }

      // 4. Sample and parse code files for static relationships (Up to 200 files in batches)
      const rawEdges: GitMapEdge[] = [];
      const codeFilesToParse = targetFiles
        .filter((f) => /\.(ts|tsx|js|jsx|py|go|java|c|cpp|h|hpp|rs)$/i.test(f.path))
        .slice(0, 200);

      const BATCH_SIZE = 15;
      for (let i = 0; i < codeFilesToParse.length; i += BATCH_SIZE) {
        const batch = codeFilesToParse.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (f) => {
            try {
              const content = await GitHubService.fetchRawFileContent(repo.owner, repo.name, commitSha, f.path);
              if (!content) return;

              const parsed = GitMapParser.parseFile(f.path, content, allFilesSet);
              const node = rawNodes.find((n) => n.id === f.path);
              if (node) {
                node.linesOfCode = parsed.linesOfCode;
                node.imports = parsed.imports;
                node.exports = parsed.exports;
                node.apiEndpoints = parsed.apiEndpoints;
                node.databaseModels = parsed.databaseModels;
              }

              for (const edge of parsed.edges) {
                rawEdges.push(edge);
              }
            } catch {
              // ignore single file parse failure
            }
          })
        );
      }

      // 5. Parse manifest dependencies
      const dependencies: GitMapDependency[] = [];
      await Promise.allSettled(
        manifestFiles.map(async (mPath) => {
          try {
            const mContent = await GitHubService.fetchRawFileContent(repo.owner, repo.name, commitSha, mPath);
            if (mContent) {
              const parsedDeps = GitMapManifestParser.parseManifest(mPath, mContent);
              dependencies.push(...parsedDeps);
            }
          } catch {}
        })
      );

      // 6. Collect Git history and contributor activity
      const { fileMetricsMap, activityData, contributorStats } = await GitMapGitAnalyzer.analyzeGitHistory(
        repo.owner,
        repo.name
      );

      // Attach Git metrics to nodes
      for (const node of rawNodes) {
        const metrics = fileMetricsMap.get(node.id);
        if (metrics) {
          node.commitCount = metrics.commitCount;
          node.lastModifiedDate = metrics.lastModified;
          node.topContributor = metrics.topContributor;
          node.contributorCount = metrics.contributorCount;
          node.contributors = metrics.contributors;
          node.isHotspot = metrics.isHotspot;
        }
      }

      // Check module-level contributor concentration
      for (const mod of moduleMap.values()) {
        const modContributors = new Map<string, number>();
        let modCommits = 0;

        for (const fPath of mod.files) {
          const m = fileMetricsMap.get(fPath);
          if (m) {
            for (const c of m.contributors) {
              modContributors.set(c.name, (modContributors.get(c.name) || 0) + c.commits);
              modCommits += c.commits;
            }
          }
        }

        if (modCommits > 0) {
          const sorted = Array.from(modContributors.entries())
            .map(([cName, cCount]) => ({
              name: cName,
              commits: cCount,
              percentage: Math.round((cCount / modCommits) * 100),
            }))
            .sort((a, b) => b.commits - a.commits);

          mod.topContributors = sorted.slice(0, 3);
          if (sorted[0]?.percentage >= 80) {
            mod.busFactorRisk = 'HIGH';
          } else if (sorted[0]?.percentage >= 60) {
            mod.busFactorRisk = 'MODERATE';
          }
        }
      }

      // 7. Construct unified deterministic graph payload
      const graphPayload = GitMapGraphBuilder.buildGraph({
        repositoryId: repo.id,
        commitSha,
        modules: Array.from(moduleMap.values()),
        rawNodes,
        rawEdges,
        dependencies,
        gitActivity: activityData,
        contributorStats,
      });

      // 8. Update database record to COMPLETED state
      await (prisma as any).gitMapAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStage: 'Deterministic architecture map ready',
          totalFiles: graphPayload.stats.totalFiles,
          totalModules: graphPayload.stats.totalModules,
          totalLines: graphPayload.stats.totalLines,
          healthScore: graphPayload.health.overallScore,
          healthBreakdown: graphPayload.health as any,
          technicalDebt: graphPayload.technicalDebt as any,
          modulesData: graphPayload.modules as any,
          nodesData: graphPayload.nodes as any,
          edgesData: graphPayload.edges as any,
          dependenciesData: graphPayload.dependencies as any,
          gitActivityData: graphPayload.gitActivity as any,
          contributorsData: graphPayload.contributors as any,
          completedAt: new Date(),
        },
      });

      this.memoryCache.set(repo.id, { payload: graphPayload, expiresAt: Date.now() + this.CACHE_TTL_MS });

      // 9. Launch Stage B AI enrichment in the background (Non-blocking!)
      setImmediate(() => {
        GitMapAIService.enrichAnalysis(analysisRecord.id, repo.id, graphPayload).catch((err) => {
          console.warn('[GitMapAnalyzerService] Background AI enrichment notice:', err.message);
        });
      });

      return graphPayload;
    } catch (err: any) {
      console.error('[GitMapAnalyzerService] Analysis failed:', err);
      await (prisma as any).gitMapAnalysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
        },
      }).catch(() => {});
      throw err;
    }
  }
}
