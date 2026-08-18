import { GitMapEdge, RelationshipType } from './gitmap.types.js';

export interface ParsedCodeFile {
  imports: string[];
  exports: string[];
  externalDependencies: string[];
  edges: GitMapEdge[];
  apiEndpoints: string[];
  databaseModels: string[];
  todosCount: number;
  fixmesCount: number;
  linesOfCode: number;
}

export class GitMapParser {
  /**
   * Parse a file's content and extract structural relationships
   */
  public static parseFile(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>
  ): ParsedCodeFile {
    const lines = content.split('\n');
    const linesOfCode = lines.length;

    let todosCount = 0;
    let fixmesCount = 0;

    for (const line of lines) {
      if (/\bTODO\b/i.test(line)) todosCount++;
      if (/\bFIXME\b/i.test(line)) fixmesCount++;
    }

    const imports: string[] = [];
    const exports: string[] = [];
    const externalDependencies: string[] = [];
    const edges: GitMapEdge[] = [];
    const apiEndpoints: string[] = [];
    const databaseModels: string[] = [];

    const lowerPath = currentFilePath.toLowerCase();

    // 1. TypeScript & JavaScript parsing
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(lowerPath)) {
      this.parseJavaScriptTypeScript(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        exports,
        externalDependencies,
        edges,
        apiEndpoints,
        databaseModels
      );
    }
    // 2. Python parsing
    else if (/\.py$/i.test(lowerPath)) {
      this.parsePython(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        exports,
        externalDependencies,
        edges,
        apiEndpoints,
        databaseModels
      );
    }
    // 3. Go parsing
    else if (/\.go$/i.test(lowerPath)) {
      this.parseGo(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        externalDependencies,
        edges
      );
    }
    // 4. Java parsing
    else if (/\.java$/i.test(lowerPath)) {
      this.parseJava(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        externalDependencies,
        edges
      );
    }
    // 5. C/C++ parsing
    else if (/\.(c|cpp|cc|h|hpp)$/i.test(lowerPath)) {
      this.parseC(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        edges
      );
    }
    // 6. Rust parsing
    else if (/\.rs$/i.test(lowerPath)) {
      this.parseRust(
        currentFilePath,
        content,
        allFilesSet,
        imports,
        externalDependencies,
        edges
      );
    }

    return {
      imports: Array.from(new Set(imports)),
      exports: Array.from(new Set(exports)),
      externalDependencies: Array.from(new Set(externalDependencies)),
      edges,
      apiEndpoints: Array.from(new Set(apiEndpoints)),
      databaseModels: Array.from(new Set(databaseModels)),
      todosCount,
      fixmesCount,
      linesOfCode,
    };
  }

  // =========================================================================
  // JavaScript & TypeScript Language Parser
  // =========================================================================
  private static parseJavaScriptTypeScript(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    exportsList: string[],
    externalDependencies: string[],
    edges: GitMapEdge[],
    apiEndpoints: string[],
    databaseModels: string[]
  ) {
    // 1. Match imports & dynamic imports
    const importPatterns = [
      /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of importPatterns) {
      for (const match of content.matchAll(pattern)) {
        const specifier = match[1];
        if (!specifier) continue;
        imports.push(specifier);

        if (specifier.startsWith('.')) {
          // Relative import -> internal file edge
          const resolvedTarget = this.resolveRelativeImport(currentFilePath, specifier, allFilesSet);
          if (resolvedTarget && resolvedTarget !== currentFilePath) {
            edges.push({
              id: `${currentFilePath}->${resolvedTarget}:IMPORTS`,
              source: currentFilePath,
              target: resolvedTarget,
              type: 'IMPORTS',
              specifier,
              isInternal: true,
              confidence: 'CONFIRMED',
            });
          }
        } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
          // Path alias import -> internal file edge
          const resolvedTarget = this.resolveAliasImport(currentFilePath, specifier, allFilesSet);
          if (resolvedTarget && resolvedTarget !== currentFilePath) {
            edges.push({
              id: `${currentFilePath}->${resolvedTarget}:IMPORTS`,
              source: currentFilePath,
              target: resolvedTarget,
              type: 'IMPORTS',
              specifier,
              isInternal: true,
              confidence: 'CONFIRMED',
            });
          }
        } else if (!specifier.startsWith('http') && !specifier.startsWith('node:')) {
          // Package import
          const pkgName = specifier.startsWith('@')
            ? specifier.split('/').slice(0, 2).join('/')
            : specifier.split('/')[0];
          externalDependencies.push(pkgName);
        }
      }
    }

    // 2. Match exports
    const exportMatches = [
      ...content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([a-zA-Z0-9_$]+)/g),
      ...content.matchAll(/export\s+\{\s*([^}]+)\s*\}/g),
    ];

    for (const m of exportMatches) {
      if (m[1]) {
        const names = m[1].split(',').map((n) => n.trim().split(' as ')[0].trim());
        exportsList.push(...names);
      }
    }

    // 3. API route detection (express, next.js, fastify)
    const apiRoutePatterns = [
      /(?:router|app)\.(get|post|put|delete|patch|options)\s*\(\s*['"]([^'"]+)['"]/gi,
      /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\b/g,
    ];

    for (const p of apiRoutePatterns) {
      for (const m of content.matchAll(p)) {
        const method = (m[1] || 'API').toUpperCase();
        const route = m[2] || 'handler';
        apiEndpoints.push(`${method} ${route}`);
      }
    }

    // 4. Database model interaction detection (Prisma, Mongoose, TypeORM)
    const dbModelPatterns = [
      /prisma\.([a-zA-Z0-9_]+)\.(findMany|findUnique|findFirst|create|update|delete|upsert)/g,
      /model\s+([a-zA-Z0-9_]+)\s*\{/g,
    ];

    let hasDbInteraction = false;
    for (const p of dbModelPatterns) {
      for (const m of content.matchAll(p)) {
        if (m[1]) {
          databaseModels.push(m[1]);
          hasDbInteraction = true;
        }
      }
    }

    // If file interacts with Prisma DB, connect to schema.prisma
    if (hasDbInteraction) {
      const schemaFile = Array.from(allFilesSet).find((f) => f.endsWith('schema.prisma') || f.includes('schema.prisma'));
      if (schemaFile && schemaFile !== currentFilePath) {
        edges.push({
          id: `${currentFilePath}->${schemaFile}:DEPENDS_ON`,
          source: currentFilePath,
          target: schemaFile,
          type: 'DEPENDS_ON',
          specifier: 'schema.prisma',
          isInternal: true,
          confidence: 'CONFIRMED',
          description: 'Interacts with database models',
        });
      }
    }
  }

  // =========================================================================
  // Python Language Parser
  // =========================================================================
  private static parsePython(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    exportsList: string[],
    externalDependencies: string[],
    edges: GitMapEdge[],
    apiEndpoints: string[],
    databaseModels: string[]
  ) {
    const pyImportPatterns = [
      /^(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_,\s*]+))/gm,
      /^(?:import\s+([a-zA-Z0-9_.,\s]+))/gm,
    ];

    for (const p of pyImportPatterns) {
      for (const m of content.matchAll(p)) {
        const moduleSpecifier = m[1] || '';
        if (moduleSpecifier) {
          imports.push(moduleSpecifier);

          if (moduleSpecifier.startsWith('.')) {
            const resolved = this.resolvePythonRelative(currentFilePath, moduleSpecifier, allFilesSet);
            if (resolved) {
              edges.push({
                id: `${currentFilePath}->${resolved}:IMPORTS`,
                source: currentFilePath,
                target: resolved,
                type: 'IMPORTS',
                specifier: moduleSpecifier,
                isInternal: true,
                confidence: 'CONFIRMED',
              });
            }
          } else {
            const rootPkg = moduleSpecifier.split('.')[0];
            externalDependencies.push(rootPkg);
          }
        }
      }
    }

    // Python API endpoints (FastAPI, Flask)
    const pyApiPatterns = [
      /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
    ];
    for (const p of pyApiPatterns) {
      for (const m of content.matchAll(p)) {
        apiEndpoints.push(`${m[1].toUpperCase()} ${m[2]}`);
      }
    }
  }

  // =========================================================================
  // Go Language Parser
  // =========================================================================
  private static parseGo(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    externalDependencies: string[],
    edges: GitMapEdge[]
  ) {
    const goImportRegex = /import\s*\(([\s\S]*?)\)|import\s+['"]([^'"]+)['"]/g;
    for (const m of content.matchAll(goImportRegex)) {
      const block = m[1] || m[2];
      if (!block) continue;
      const specifiers = block.match(/['"]([^'"]+)['"]/g) || [];
      for (const s of specifiers) {
        const clean = s.replace(/['"]/g, '');
        imports.push(clean);
        externalDependencies.push(clean.split('/').pop() || clean);
      }
    }
  }

  // =========================================================================
  // Java Language Parser
  // =========================================================================
  private static parseJava(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    externalDependencies: string[],
    edges: GitMapEdge[]
  ) {
    const javaImportRegex = /^import\s+(?:static\s+)?([a-zA-Z0-9_.]+);/gm;
    for (const m of content.matchAll(javaImportRegex)) {
      if (m[1]) {
        imports.push(m[1]);
        const parts = m[1].split('.');
        if (parts.length >= 2) {
          externalDependencies.push(`${parts[0]}.${parts[1]}`);
        }
      }
    }
  }

  // =========================================================================
  // C / C++ Language Parser
  // =========================================================================
  private static parseC(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    edges: GitMapEdge[]
  ) {
    const cIncludeRegex = /#include\s+["<]([^">]+)[">]/g;
    for (const m of content.matchAll(cIncludeRegex)) {
      const header = m[1];
      if (!header) continue;
      imports.push(header);

      // Check if this header exists in workspace
      for (const f of allFilesSet) {
        if (f.endsWith(`/${header}`) || f === header) {
          edges.push({
            id: `${currentFilePath}->${f}:IMPORTS`,
            source: currentFilePath,
            target: f,
            type: 'IMPORTS',
            specifier: header,
            isInternal: true,
            confidence: 'CONFIRMED',
          });
          break;
        }
      }
    }
  }

  // =========================================================================
  // Rust Language Parser
  // =========================================================================
  private static parseRust(
    currentFilePath: string,
    content: string,
    allFilesSet: Set<string>,
    imports: string[],
    externalDependencies: string[],
    edges: GitMapEdge[]
  ) {
    const rustUseRegex = /^use\s+([a-zA-Z0-9_:]+)/gm;
    for (const m of content.matchAll(rustUseRegex)) {
      if (m[1]) {
        imports.push(m[1]);
        const rootCrate = m[1].split('::')[0];
        if (rootCrate && rootCrate !== 'crate' && rootCrate !== 'super' && rootCrate !== 'self') {
          externalDependencies.push(rootCrate);
        }
      }
    }
  }

  // =========================================================================
  // Path Resolution Helpers
  // =========================================================================
  private static resolveRelativeImport(
    currentFilePath: string,
    relativeSpecifier: string,
    allFilesSet: Set<string>
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
      if (allFilesSet.has(cand)) return cand;
    }

    // Fuzzy matching
    for (const f of allFilesSet) {
      if (
        f === `${cleanBase}.ts` ||
        f === `${cleanBase}.tsx` ||
        f === `${cleanBase}.js` ||
        f.endsWith(`/${cleanBase.split('/').pop()}.ts`) ||
        f.endsWith(`/${cleanBase.split('/').pop()}.tsx`)
      ) {
        return f;
      }
    }

    return null;
  }

  private static resolveAliasImport(
    currentFilePath: string,
    aliasSpecifier: string,
    allFilesSet: Set<string>
  ): string | null {
    // Strip leading @/ or ~/
    const stripped = aliasSpecifier.replace(/^[@~]\//, '');
    const cleanBase = stripped.replace(/\.(js|ts|jsx|tsx|mjs|cjs)$/, '');

    // Determine current package prefix (e.g. apps/frontend, apps/backend)
    const pathParts = currentFilePath.split('/');
    const packagePrefix = pathParts.length >= 2 && (pathParts[0] === 'apps' || pathParts[0] === 'packages')
      ? `${pathParts[0]}/${pathParts[1]}`
      : '';

    const candidates = [
      packagePrefix ? `${packagePrefix}/src/${cleanBase}.ts` : '',
      packagePrefix ? `${packagePrefix}/src/${cleanBase}.tsx` : '',
      packagePrefix ? `${packagePrefix}/src/${cleanBase}.js` : '',
      packagePrefix ? `${packagePrefix}/src/${cleanBase}/index.ts` : '',
      packagePrefix ? `${packagePrefix}/src/${cleanBase}/index.tsx` : '',
      packagePrefix ? `${packagePrefix}/${cleanBase}.ts` : '',
      packagePrefix ? `${packagePrefix}/${cleanBase}.tsx` : '',
      `src/${cleanBase}.ts`,
      `src/${cleanBase}.tsx`,
      `src/${cleanBase}.js`,
      `src/${cleanBase}/index.ts`,
      `src/${cleanBase}/index.tsx`,
      `${cleanBase}.ts`,
      `${cleanBase}.tsx`,
      `${cleanBase}.js`,
      `${cleanBase}/index.ts`,
      `${cleanBase}/index.tsx`,
    ].filter(Boolean);

    for (const cand of candidates) {
      if (allFilesSet.has(cand)) return cand;
    }

    // Direct match against allFilesSet
    for (const f of allFilesSet) {
      if (f.endsWith(`/${cleanBase}.ts`) || f.endsWith(`/${cleanBase}.tsx`) || f.endsWith(`/${cleanBase}/index.tsx`) || f.endsWith(`/${cleanBase}/index.ts`)) {
        return f;
      }
    }

    return null;
  }

  private static resolvePythonRelative(
    currentFilePath: string,
    specifier: string,
    allFilesSet: Set<string>
  ): string | null {
    const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
    const cleanMod = specifier.replace(/^\.+/, '').replace(/\./g, '/');
    const cand = `${currentDir}/${cleanMod}.py`;
    if (allFilesSet.has(cand)) return cand;
    return null;
  }
}
