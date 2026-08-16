import prisma from '../config/prisma.js';
import { GitHubService } from './github.service.js';
import { AnalysisCacheService } from './analysis-cache.service.js';

export interface DependencyNode {
  id: string; // filePath
  label: string; // basename
  directory: string;
  inDegree: number; // number of files importing this
  outDegree: number; // number of files this imports
}

export interface DependencyEdge {
  source: string; // importer
  target: string; // imported
  specifier: string;
}

export interface FileDependencyDetails {
  filePath: string;
  imports: Array<{ filePath: string; specifier: string; isInternal: boolean }>;
  importedBy: Array<{ filePath: string; specifier: string }>;
  externalPackages: string[];
}

export interface DependencyGraphData {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  summary: {
    totalFiles: number;
    totalDependencies: number;
    mostImportedFiles: Array<{ filePath: string; count: number }>;
    externalPackages: string[];
  };
}

export class DependencyGraphService {
  /**
   * Build complete static dependency graph for a repository
   */
  public static async buildGraph(repoId: string): Promise<DependencyGraphData> {
    const repo = await prisma.repository.findUnique({ where: { id: repoId } });
    if (!repo) throw new Error('Repository not found');

    const commitSha = repo.latestCommit || repo.defaultBranch || 'HEAD';
    const cached = AnalysisCacheService.get<DependencyGraphData>(repoId, commitSha, 'DEPENDENCY_GRAPH' as any);
    if (cached) return cached;

    // 1. Fetch file tree
    const fileTree = await GitHubService.fetchRepoFileTree(repo.owner, repo.name, commitSha);
    const codeFiles = fileTree.filter(
      (f) =>
        /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs|rb|php)$/i.test(f.path) &&
        !f.path.includes('node_modules/') &&
        !f.path.includes('.git/') &&
        !f.path.includes('dist/') &&
        !f.path.includes('build/')
    );

    const filePathsSet = new Set(codeFiles.map((f) => f.path));
    const edges: DependencyEdge[] = [];
    const externalPackagesSet = new Set<string>();

    // 2. Fetch contents and parse imports (batch limit to top 60 files for speed)
    const sampledFiles = codeFiles.slice(0, 80);

    await Promise.allSettled(
      sampledFiles.map(async (file) => {
        try {
          const content = await GitHubService.fetchRawFileContent(repo.owner, repo.name, commitSha, file.path);
          if (!content) return;

          const parsed = this.extractImports(file.path, content, filePathsSet);
          for (const edge of parsed.internalEdges) {
            edges.push(edge);
          }
          for (const pkg of parsed.externalPackages) {
            externalPackagesSet.add(pkg);
          }
        } catch {}
      })
    );

    // 3. Compute in/out degrees for nodes
    const inDegrees: Record<string, number> = {};
    const outDegrees: Record<string, number> = {};

    for (const edge of edges) {
      outDegrees[edge.source] = (outDegrees[edge.source] || 0) + 1;
      inDegrees[edge.target] = (inDegrees[edge.target] || 0) + 1;
    }

    const nodes: DependencyNode[] = sampledFiles.map((f) => ({
      id: f.path,
      label: f.path.split('/').pop() || f.path,
      directory: f.path.split('/').slice(0, -1).join('/') || 'root',
      inDegree: inDegrees[f.path] || 0,
      outDegree: outDegrees[f.path] || 0,
    }));

    const mostImportedFiles = Object.entries(inDegrees)
      .map(([filePath, count]) => ({ filePath, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const result: DependencyGraphData = {
      nodes,
      edges,
      summary: {
        totalFiles: nodes.length,
        totalDependencies: edges.length,
        mostImportedFiles,
        externalPackages: Array.from(externalPackagesSet).sort(),
      },
    };

    AnalysisCacheService.set(repoId, commitSha, 'DEPENDENCY_GRAPH' as any, result);
    return result;
  }

  /**
   * Get specific file dependencies (Who imports this? What does this import?)
   */
  public static async getFileDetails(repoId: string, targetFilePath: string): Promise<FileDependencyDetails> {
    const graph = await this.buildGraph(repoId);

    const imports: Array<{ filePath: string; specifier: string; isInternal: boolean }> = [];
    const importedBy: Array<{ filePath: string; specifier: string }> = [];

    for (const edge of graph.edges) {
      if (edge.source === targetFilePath) {
        imports.push({
          filePath: edge.target,
          specifier: edge.specifier,
          isInternal: true,
        });
      }
      if (edge.target === targetFilePath) {
        importedBy.push({
          filePath: edge.source,
          specifier: edge.specifier,
        });
      }
    }

    return {
      filePath: targetFilePath,
      imports,
      importedBy,
      externalPackages: graph.summary.externalPackages,
    };
  }

  /**
   * Static import extraction regexes for multi-language repositories
   */
  private static extractImports(
    currentFilePath: string,
    content: string,
    allFiles: Set<string>
  ): { internalEdges: DependencyEdge[]; externalPackages: string[] } {
    const internalEdges: DependencyEdge[] = [];
    const externalPackages: string[] = [];

    // TS/JS regexes: import ... from '...', require('...'), export ... from '...'
    const tsJsMatches = [
      ...content.matchAll(/(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g),
      ...content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ];

    for (const m of tsJsMatches) {
      const specifier = m[1];
      if (!specifier) continue;

      if (specifier.startsWith('.')) {
        // Relative internal import
        const resolved = this.resolveRelativePath(currentFilePath, specifier, allFiles);
        if (resolved) {
          internalEdges.push({
            source: currentFilePath,
            target: resolved,
            specifier,
          });
        }
      } else if (!specifier.startsWith('http') && !specifier.startsWith('@/')) {
        // External package
        const pkgName = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        externalPackages.push(pkgName);
      }
    }

    // Python regexes: import xyz, from xyz import abc
    const pyMatches = [
      ...content.matchAll(/^(?:from|import)\s+([a-zA-Z0-9_.]+)/gm),
    ];

    for (const m of pyMatches) {
      const specifier = m[1];
      if (specifier) {
        externalPackages.push(specifier.split('.')[0]);
      }
    }

    return { internalEdges, externalPackages };
  }

  /**
   * Resolves relative path (e.g. `./github.service.js` or `../config/prisma`) to indexed workspace path
   */
  private static resolveRelativePath(
    currentFilePath: string,
    relativeSpecifier: string,
    allFiles: Set<string>
  ): string | null {
    const currentDir = currentFilePath.split('/').slice(0, -1);
    const parts = relativeSpecifier.split('/');

    const resolvedParts = [...currentDir];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }

    const basePath = resolvedParts.join('/');
    const cleanBase = basePath.replace(/\.(js|ts|jsx|tsx|mjs|cjs)$/, '');

    const candidates = [
      basePath,
      `${cleanBase}.ts`,
      `${cleanBase}.tsx`,
      `${cleanBase}.js`,
      `${cleanBase}.jsx`,
      `${cleanBase}/index.ts`,
      `${cleanBase}/index.tsx`,
      `${cleanBase}/index.js`,
    ];

    for (const cand of candidates) {
      if (allFiles.has(cand)) return cand;
    }

    // Fuzzy fallback
    for (const f of allFiles) {
      if (f.endsWith(`${cleanBase}.ts`) || f.endsWith(`${cleanBase}.tsx`) || f.endsWith(`${cleanBase}.js`)) {
        return f;
      }
    }

    return null;
  }
}
