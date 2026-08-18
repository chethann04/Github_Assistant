import {
  GitMapNode,
  GitMapEdge,
  GitMapModule,
  GitMapDependency,
  GitActivityData,
  GitContributorStats,
  GitMapGraphPayload,
} from './gitmap.types.js';
import { GitMapScorer } from './gitmap-scorer.js';

export class GitMapGraphBuilder {
  public static buildGraph(params: {
    repositoryId: string;
    commitSha: string;
    modules: GitMapModule[];
    rawNodes: GitMapNode[];
    rawEdges: GitMapEdge[];
    dependencies: GitMapDependency[];
    gitActivity: GitActivityData;
    contributorStats: GitContributorStats[];
  }): GitMapGraphPayload {
    const {
      repositoryId,
      commitSha,
      modules,
      rawNodes,
      rawEdges,
      dependencies,
      gitActivity,
      contributorStats,
    } = params;

    // 1. Compute deterministic scores (centrality, importance, risk, debt)
    const { nodes: scoredNodes, technicalDebt } = GitMapScorer.computeScores(rawNodes, rawEdges);

    // 2. Compute module-level scores and health metrics
    const { modules: scoredModules, health } = GitMapScorer.computeModuleAndHealthMetrics(
      modules,
      scoredNodes,
      technicalDebt
    );

    // 3. Deduplicate edges and generate module-level cross edges
    const edgeMap = new Map<string, GitMapEdge>();
    for (const e of rawEdges) {
      edgeMap.set(`${e.source}->${e.target}:${e.type}`, e);
    }

    // Build cross-module edges
    const moduleEdgeMap = new Map<string, GitMapEdge>();
    for (const e of rawEdges) {
      const sourceNode = scoredNodes.find((n) => n.id === e.source);
      const targetNode = scoredNodes.find((n) => n.id === e.target);

      if (sourceNode && targetNode && sourceNode.moduleId !== targetNode.moduleId) {
        const modKey = `${sourceNode.moduleId}->${targetNode.moduleId}:DEPENDS_ON`;
        if (!moduleEdgeMap.has(modKey)) {
          moduleEdgeMap.set(modKey, {
            id: modKey,
            source: sourceNode.moduleId,
            target: targetNode.moduleId,
            type: 'DEPENDS_ON',
            isInternal: true,
            confidence: 'CONFIRMED',
            description: `${sourceNode.moduleName} depends on ${targetNode.moduleName}`,
          });
        }
      }
    }

    const allEdges = [...Array.from(edgeMap.values()), ...Array.from(moduleEdgeMap.values())];

    const totalLines = scoredNodes.reduce((sum, n) => sum + n.linesOfCode, 0);
    const highRiskFilesCount = scoredNodes.filter((n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH').length;

    const payload: GitMapGraphPayload = {
      repositoryId,
      commitSha,
      generatedAt: new Date().toISOString(),
      stats: {
        totalFiles: scoredNodes.length,
        totalModules: scoredModules.length,
        totalLines,
        totalRelationships: allEdges.length,
        totalDependencies: dependencies.length,
        totalContributors: contributorStats.length,
        highRiskFilesCount,
      },
      modules: scoredModules,
      nodes: scoredNodes,
      edges: allEdges,
      dependencies,
      gitActivity,
      contributors: contributorStats,
      health,
      technicalDebt,
    };

    return payload;
  }
}
