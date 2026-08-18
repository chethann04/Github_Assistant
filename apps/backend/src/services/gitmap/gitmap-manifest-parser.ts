import { GitMapDependency } from './gitmap.types.js';

export class GitMapManifestParser {
  public static parseManifest(filePath: string, content: string): GitMapDependency[] {
    const fileName = filePath.split('/').pop() || '';
    const deps: GitMapDependency[] = [];

    try {
      if (fileName === 'package.json') {
        const json = JSON.parse(content);
        if (json.dependencies) {
          for (const [name, version] of Object.entries(json.dependencies)) {
            deps.push({
              name,
              version: String(version),
              type: 'runtime',
              sourceManifest: filePath,
              usedByFiles: [],
              category: this.categorizeNpmPackage(name),
            });
          }
        }
        if (json.devDependencies) {
          for (const [name, version] of Object.entries(json.devDependencies)) {
            deps.push({
              name,
              version: String(version),
              type: 'dev',
              sourceManifest: filePath,
              usedByFiles: [],
              category: this.categorizeNpmPackage(name),
            });
          }
        }
      } else if (fileName === 'requirements.txt') {
        const lines = content.split('\n');
        for (const line of lines) {
          const clean = line.trim().split('#')[0].trim();
          if (!clean || clean.startsWith('-')) continue;
          const match = clean.match(/^([a-zA-Z0-9_\-.]+)(?:([=><~!^].*))?$/);
          if (match) {
            deps.push({
              name: match[1],
              version: match[2]?.replace(/^[=><~!^]+/, '') || 'latest',
              type: 'runtime',
              sourceManifest: filePath,
              usedByFiles: [],
              category: this.categorizePythonPackage(match[1]),
            });
          }
        }
      } else if (fileName === 'go.mod') {
        const requireBlockRegex = /require\s*\(([\s\S]*?)\)/g;
        for (const m of content.matchAll(requireBlockRegex)) {
          const lines = (m[1] || '').split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              deps.push({
                name: parts[0],
                version: parts[1],
                type: 'runtime',
                sourceManifest: filePath,
                usedByFiles: [],
                category: 'OTHER',
              });
            }
          }
        }
      } else if (fileName === 'Cargo.toml') {
        const inDepsRegex = /\[dependencies\]([\s\S]*?)(?:\[|$)/g;
        for (const m of content.matchAll(inDepsRegex)) {
          const lines = (m[1] || '').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const eq = trimmed.split('=');
              if (eq.length >= 2) {
                deps.push({
                  name: eq[0].trim(),
                  version: eq[1].replace(/["']/g, '').trim(),
                  type: 'runtime',
                  sourceManifest: filePath,
                  usedByFiles: [],
                  category: 'OTHER',
                });
              }
            }
          }
        }
      }
    } catch {
      // ignore JSON parse errors in invalid manifest
    }

    return deps;
  }

  private static categorizeNpmPackage(name: string): GitMapDependency['category'] {
    const lower = name.toLowerCase();
    if (lower.includes('react') || lower.includes('vue') || lower.includes('svelte') || lower.includes('next') || lower.includes('tailwind') || lower.includes('lucide')) {
      return 'UI';
    }
    if (lower.includes('prisma') || lower.includes('pg') || lower.includes('mysql') || lower.includes('mongo') || lower.includes('redis') || lower.includes('typeorm') || lower.includes('sequelize') || lower.includes('drizzle')) {
      return 'DATABASE';
    }
    if (lower.includes('jwt') || lower.includes('bcrypt') || lower.includes('auth') || lower.includes('passport') || lower.includes('crypto') || lower.includes('helmet')) {
      return 'SECURITY';
    }
    if (lower.includes('openai') || lower.includes('gemini') || lower.includes('langchain') || lower.includes('anthropic') || lower.includes('chroma') || lower.includes('vector')) {
      return 'AI';
    }
    if (lower.includes('jest') || lower.includes('vitest') || lower.includes('mocha') || lower.includes('cypress') || lower.includes('playwright')) {
      return 'TESTING';
    }
    if (lower.includes('express') || lower.includes('fastify') || lower.includes('nest') || lower.includes('koa') || lower.includes('hono')) {
      return 'FRAMEWORK';
    }
    return 'UTILITY';
  }

  private static categorizePythonPackage(name: string): GitMapDependency['category'] {
    const lower = name.toLowerCase();
    if (lower.includes('django') || lower.includes('flask') || lower.includes('fastapi') || lower.includes('tornado')) {
      return 'FRAMEWORK';
    }
    if (lower.includes('sql') || lower.includes('psycopg') || lower.includes('pymongo') || lower.includes('redis') || lower.includes('sqlalchemy')) {
      return 'DATABASE';
    }
    if (lower.includes('openai') || lower.includes('torch') || lower.includes('tensorflow') || lower.includes('transformers') || lower.includes('langchain') || lower.includes('chroma')) {
      return 'AI';
    }
    if (lower.includes('pytest') || lower.includes('unittest') || lower.includes('mock')) {
      return 'TESTING';
    }
    if (lower.includes('jwt') || lower.includes('bcrypt') || lower.includes('cryptography') || lower.includes('passlib')) {
      return 'SECURITY';
    }
    return 'UTILITY';
  }
}
