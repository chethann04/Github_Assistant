import {
  GitMapNode,
  GitMapEdge,
  GitMapModule,
  RiskLevel,
  HealthBreakdown,
  TechnicalDebtIndicators,
} from './gitmap.types.js';

export class GitMapScorer {
  /**
   * Compute inDegree, outDegree, centrality, importance, and risk score for every file node
   */
  public static computeScores(
    nodes: GitMapNode[],
    edges: GitMapEdge[]
  ): {
    nodes: GitMapNode[];
    technicalDebt: TechnicalDebtIndicators;
  } {
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();

    for (const edge of edges) {
      if (edge.isInternal) {
        outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
        inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
      }
    }

    const maxInDegree = Math.max(1, ...Array.from(inDegreeMap.values()));
    const maxOutDegree = Math.max(1, ...Array.from(outDegreeMap.values()));

    let totalTodos = 0;
    let totalFixmes = 0;
    let largeFilesCount = 0;
    let unreferencedCount = 0;

    const debtItems: TechnicalDebtIndicators['items'] = [];

    const updatedNodes: GitMapNode[] = nodes.map((node) => {
      const inDeg = inDegreeMap.get(node.id) || 0;
      const outDeg = outDegreeMap.get(node.id) || 0;

      // 1. Centrality score (0 - 100)
      const centralityScore = Math.min(
        100,
        Math.round((inDeg / maxInDegree) * 70 + (outDeg / maxOutDegree) * 30)
      );

      // 2. Importance score (0 - 100)
      let importanceScore = 20;
      importanceScore += Math.min(45, inDeg * 6); // More files depend on this
      importanceScore += Math.min(15, outDeg * 2); // Connects to other systems
      if (node.isEntryPoint) importanceScore += 15;
      if (node.category === 'AUTH' || node.category === 'DATABASE' || node.category === 'API') {
        importanceScore += 10;
      }
      importanceScore = Math.min(100, Math.max(10, importanceScore));

      // 3. Risk score calculation
      let riskScore = 15;
      const riskReasons: string[] = [];

      // High dependency centrality
      if (inDeg >= 4) {
        riskScore += 25;
        riskReasons.push(`High dependency blast radius (${inDeg} dependent files).`);
      } else if (inDeg >= 2) {
        riskScore += 12;
        riskReasons.push(`Imported by ${inDeg} files across the system.`);
      }

      // High change frequency
      if (node.isHotspot || node.commitCount >= 4) {
        riskScore += 20;
        riskReasons.push(`High change frequency (${node.commitCount} recent commits).`);
      }

      // Large file size / complexity
      if (node.linesOfCode >= 500) {
        riskScore += 20;
        largeFilesCount++;
        riskReasons.push(`Large file (${node.linesOfCode} lines of code).`);
        debtItems.push({
          type: 'LARGE_FILE',
          filePath: node.id,
          title: `Large File: ${node.name}`,
          description: `${node.linesOfCode} lines of code. High structural complexity.`,
          severity: node.linesOfCode >= 800 ? 'HIGH' : 'MEDIUM',
        });
      } else if (node.linesOfCode >= 300) {
        riskScore += 10;
      }

      // Critical category
      if (node.category === 'AUTH') {
        riskScore += 15;
        riskReasons.push('Handles security, authentication, or token verification.');
      } else if (node.category === 'DATABASE') {
        riskScore += 10;
        riskReasons.push('Manages database state or persistence schemas.');
      }

      // Unreferenced code file (potential dead code)
      if (inDeg === 0 && !node.isEntryPoint && !node.isTest && !node.isConfig && node.category !== 'SCRIPTS' && node.category !== 'DOCS') {
        unreferencedCount++;
        debtItems.push({
          type: 'UNREFERENCED',
          filePath: node.id,
          title: `Potentially Unreferenced File: ${node.name}`,
          description: 'No internal files import or reference this file.',
          severity: 'LOW',
        });
      }

      riskScore = Math.min(100, Math.max(5, riskScore));

      let riskLevel: RiskLevel = 'LOW';
      if (riskScore >= 75) riskLevel = 'CRITICAL';
      else if (riskScore >= 55) riskLevel = 'HIGH';
      else if (riskScore >= 35) riskLevel = 'MEDIUM';

      return {
        ...node,
        inDegree: inDeg,
        outDegree: outDeg,
        centralityScore,
        importanceScore,
        riskScore,
        riskLevel,
        riskReasons,
      };
    });

    const highRiskModulesCount = updatedNodes.filter((n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH').length;

    const technicalDebt: TechnicalDebtIndicators = {
      todoCount: totalTodos,
      fixmeCount: totalFixmes,
      largeFilesCount,
      potentiallyUnreferencedFilesCount: unreferencedCount,
      outdatedDependenciesCount: 0,
      highRiskModulesCount,
      items: debtItems.slice(0, 15),
    };

    return {
      nodes: updatedNodes,
      technicalDebt,
    };
  }

  /**
   * Aggregate module-level metrics & calculate overall repository health scorecard
   */
  public static computeModuleAndHealthMetrics(
    modules: GitMapModule[],
    nodes: GitMapNode[],
    technicalDebt: TechnicalDebtIndicators
  ): {
    modules: GitMapModule[];
    health: HealthBreakdown;
  } {
    const updatedModules = modules.map((mod) => {
      const modNodes = nodes.filter((n) => n.moduleId === mod.id || mod.files.includes(n.id));
      if (modNodes.length === 0) return mod;

      const avgImportance = Math.round(
        modNodes.reduce((acc, curr) => acc + curr.importanceScore, 0) / modNodes.length
      );
      const maxRisk = Math.max(...modNodes.map((n) => n.riskScore));
      const riskFactors: string[] = [];

      if (maxRisk >= 70) {
        riskFactors.push(`Contains high-risk file with high dependency coupling.`);
      }
      if (mod.busFactorRisk === 'HIGH') {
        riskFactors.push(`High contribution concentration by a single contributor.`);
      }

      let riskLevel: RiskLevel = 'LOW';
      if (maxRisk >= 75) riskLevel = 'CRITICAL';
      else if (maxRisk >= 55) riskLevel = 'HIGH';
      else if (maxRisk >= 35) riskLevel = 'MEDIUM';

      return {
        ...mod,
        fileCount: modNodes.length,
        totalLines: modNodes.reduce((acc, curr) => acc + curr.linesOfCode, 0),
        importanceScore: avgImportance,
        riskScore: maxRisk,
        riskLevel,
        riskFactors,
      };
    });

    // Compute Health Scores
    const codeNodes = nodes.filter((n) => !n.isTest && !n.isConfig && n.category !== 'DOCS');
    const testNodes = nodes.filter((n) => n.isTest);
    const docNodes = nodes.filter((n) => n.category === 'DOCS');

    // 1. Structure Score
    const highRiskRatio = codeNodes.length > 0
      ? codeNodes.filter((n) => n.riskLevel === 'CRITICAL').length / codeNodes.length
      : 0;
    const structureScore = Math.max(30, Math.round(95 - highRiskRatio * 70 - technicalDebt.largeFilesCount * 2));

    // 2. Documentation Score
    const hasReadme = nodes.some((n) => n.name.toLowerCase().startsWith('readme'));
    const docScore = Math.min(100, Math.max(30, (hasReadme ? 60 : 20) + Math.min(40, docNodes.length * 15)));

    // 3. Testing Score
    const testRatio = codeNodes.length > 0 ? testNodes.length / codeNodes.length : 0;
    const testingScore = testNodes.length === 0 ? 35 : Math.min(100, Math.round(50 + testRatio * 100));

    // 4. Dependency Health
    const depHealth = Math.max(40, 90 - technicalDebt.outdatedDependenciesCount * 5);

    // 5. Ownership Distribution
    const hasBusRisk = updatedModules.some((m) => m.busFactorRisk === 'HIGH');
    const ownershipScore = hasBusRisk ? 68 : 88;

    const overallScore = Math.round(
      structureScore * 0.3 +
      docScore * 0.2 +
      testingScore * 0.2 +
      depHealth * 0.15 +
      ownershipScore * 0.15
    );

    const notes: string[] = [];
    if (testingScore <= 50) notes.push('Test coverage indicators are low or test suites are minimal.');
    if (docScore <= 60) notes.push('Documentation coverage is limited.');
    if (hasBusRisk) notes.push('Some core modules have high contributor concentration.');
    if (notes.length === 0) notes.push('Repository architecture has healthy modularity and balanced metrics.');

    const health: HealthBreakdown = {
      overallScore,
      structureScore,
      documentationScore: docScore,
      testingScore,
      dependencyHealthScore: depHealth,
      ownershipDistributionScore: ownershipScore,
      notes,
    };

    return {
      modules: updatedModules,
      health,
    };
  }
}
