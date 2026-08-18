import { ModuleCategory } from './gitmap.types.js';

export interface FileClassification {
  category: ModuleCategory;
  moduleKey: string;
  moduleName: string;
  isEntryPoint: boolean;
  isTest: boolean;
  isConfig: boolean;
  language: string;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.proto': 'Protocol Buffers',
  '.md': 'Markdown',
  '.markdown': 'Markdown',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.tf': 'Terraform',
  '.dockerfile': 'Dockerfile',
  '.sh': 'Shell Script',
  '.bash': 'Bash Script',
};

export class GitMapClassifier {
  public static detectLanguage(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    if (fileName.toLowerCase() === 'dockerfile' || fileName.toLowerCase().startsWith('dockerfile.')) {
      return 'Dockerfile';
    }
    const dotIdx = fileName.lastIndexOf('.');
    if (dotIdx === -1) return 'Plaintext';
    const ext = fileName.substring(dotIdx).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] || 'Code';
  }

  public static classifyFile(filePath: string, contentSnippet: string = ''): FileClassification {
    const lowerPath = filePath.toLowerCase();
    const parts = lowerPath.split('/');
    const fileName = parts[parts.length - 1] || '';
    const language = this.detectLanguage(filePath);

    // 1. Tests
    const isTest =
      /(?:^|[\\/._-])(tests?|__tests__|specs?)(?:[\\/._-]|$)/i.test(lowerPath) ||
      /\.(test|spec)\.[a-z0-9]+$/i.test(fileName) ||
      fileName.startsWith('test_') ||
      fileName.endsWith('_test.go');

    // 2. Config & Tooling
    const isConfig =
      fileName === 'package.json' ||
      fileName === 'tsconfig.json' ||
      fileName.includes('tsconfig') ||
      fileName.includes('vite.config') ||
      fileName.includes('next.config') ||
      fileName.includes('tailwind.config') ||
      fileName.includes('postcss.config') ||
      fileName.includes('eslint') ||
      fileName.includes('prettier') ||
      fileName.includes('webpack') ||
      fileName.includes('babel.config') ||
      fileName.includes('jest.config') ||
      fileName.includes('vitest.config') ||
      fileName.startsWith('.env') ||
      fileName.startsWith('.gitignore') ||
      fileName.startsWith('.npmrc') ||
      fileName.endsWith('.config.js') ||
      fileName.endsWith('.config.ts') ||
      fileName.endsWith('.config.mjs') ||
      fileName.endsWith('.config.cjs') ||
      fileName.endsWith('.yml') ||
      fileName.endsWith('.yaml') ||
      fileName.endsWith('.toml');

    // 3. Entry point
    const isEntryPoint =
      fileName === 'index.ts' ||
      fileName === 'index.js' ||
      fileName === 'main.ts' ||
      fileName === 'main.js' ||
      fileName === 'main.py' ||
      fileName === 'main.go' ||
      fileName === 'main.rs' ||
      fileName === 'server.ts' ||
      fileName === 'server.js' ||
      fileName === 'app.ts' ||
      fileName === 'app.js' ||
      fileName === 'app.tsx' ||
      fileName === 'page.tsx' ||
      fileName === 'layout.tsx' ||
      fileName === 'application.java';

    // 1. Documentation
    if (
      lowerPath.endsWith('.md') ||
      lowerPath.endsWith('.markdown') ||
      lowerPath.endsWith('.txt') ||
      /(?:^|\/)(docs|documentation|wiki)\//i.test(lowerPath)
    ) {
      return {
        category: 'DOCS',
        moduleKey: 'module-docs',
        moduleName: 'Documentation & Guides',
        isEntryPoint: false,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 2. Tests
    if (isTest) {
      return {
        category: 'TESTS',
        moduleKey: 'module-tests',
        moduleName: 'Test Suites & Verification',
        isEntryPoint: false,
        isTest: true,
        isConfig: false,
        language,
      };
    }

    // 3. Infrastructure & DevOps
    if (
      lowerPath.includes('.github/workflows') ||
      /(?:^|\/)(docker|k8s|kubernetes|terraform|helm|deploy|infra)\//i.test(lowerPath) ||
      fileName.startsWith('dockerfile') ||
      fileName.includes('docker-compose') ||
      fileName.endsWith('.tf') ||
      fileName.endsWith('.hcl')
    ) {
      return {
        category: 'INFRA',
        moduleKey: 'module-infra',
        moduleName: 'Infrastructure & CI/CD',
        isEntryPoint: false,
        isTest: false,
        isConfig: true,
        language,
      };
    }

    // 4. Scripts & Automation
    if (
      /(?:^|\/)(scripts|bin|cli)\//i.test(lowerPath) ||
      fileName.endsWith('.sh') ||
      fileName.endsWith('.bash') ||
      fileName.endsWith('.ps1') ||
      /(?:^|[\\/._-])(seed|migrate|build-scripts?)\.[a-z0-9]+$/i.test(lowerPath)
    ) {
      return {
        category: 'SCRIPTS',
        moduleKey: 'module-scripts',
        moduleName: 'Build Scripts & Utilities',
        isEntryPoint: false,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 5. Authentication & Security (strict matching)
    if (
      /(?:^|[\\/._-])(auth|oauth|jwt|passport|session|rbac|guard|permission|permissions)(?:[\\/._-]|$)/i.test(lowerPath) ||
      /jsonwebtoken|bcrypt|next-auth|passport/i.test(contentSnippet)
    ) {
      const isBackend = lowerPath.includes('backend') || lowerPath.includes('server');
      return {
        category: 'AUTH',
        moduleKey: isBackend ? 'module-backend-auth' : 'module-auth',
        moduleName: 'Authentication & Security',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 6. AI, LLM & Intelligence (strict token/boundary matching)
    if (
      /(?:^|[\\/._-])(ai|llm|rag|vector|embedding|embeddings|gemini|openai|anthropic|claude|langchain|qdrant|chroma|pinecone|pgvector|agent|agents)(?:[\\/._-]|$)/i.test(lowerPath) ||
      /(@google\/genai|openai|langchain|@anthropic-ai)/i.test(contentSnippet)
    ) {
      return {
        category: 'AI',
        moduleKey: 'module-ai',
        moduleName: 'AI & Intelligence Engine',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 7. Database & Persistence Layer (strict token matching)
    if (
      fileName === 'schema.prisma' ||
      /(?:^|[\\/._-])(prisma|models?|entities|database|repositories|repository|migrations?|drizzle|typeorm|sequelize|mongoose)(?:[\\/._-]|$)/i.test(lowerPath) ||
      fileName.endsWith('.sql') ||
      /(?:^|\/)db\//i.test(lowerPath) ||
      /prisma\.|@prisma\/client|typeorm|sequelize|drizzle-orm/i.test(contentSnippet)
    ) {
      return {
        category: 'DATABASE',
        moduleKey: 'module-database',
        moduleName: 'Database & Data Models',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 8. API Routes & Controllers
    if (
      /(?:^|[\\/._-])(routes?|controllers?|endpoints?|handlers?|router)(?:[\\/._-]|$)/i.test(lowerPath) ||
      /(?:^|\/)api\//i.test(lowerPath) ||
      /controller\.(ts|js)$/i.test(fileName) ||
      /Router\(\)|@Get\(|@Post\(|fastify\.get/i.test(contentSnippet)
    ) {
      const isBackend = lowerPath.includes('backend') || lowerPath.includes('server');
      return {
        category: 'API',
        moduleKey: isBackend ? 'module-backend-routes' : 'module-api-routes',
        moduleName: isBackend ? 'Backend API Routes' : 'API Routes & Endpoints',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 9. Core Backend Services & Business Logic
    if (
      /(?:^|[\\/._-])(services?|queues?|workers?|jobs?|middleware|core)(?:[\\/._-]|$)/i.test(lowerPath) ||
      lowerPath.includes('apps/backend') ||
      lowerPath.includes('packages/backend') ||
      lowerPath.includes('/server/')
    ) {
      return {
        category: 'SERVICES',
        moduleKey: 'module-backend-services',
        moduleName: 'Backend Core Services',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 10. Frontend Components & UI
    if (
      /(?:^|[\\/._-])(components?|views?|pages?|hooks?|styles?|layouts?|widgets?)(?:[\\/._-]|$)/i.test(lowerPath) ||
      /(?:^|\/)app\//i.test(lowerPath) ||
      lowerPath.includes('apps/frontend') ||
      lowerPath.includes('packages/frontend') ||
      /\.(tsx|jsx|vue|svelte|css|scss|sass)$/i.test(fileName)
    ) {
      const isComponent = /(?:^|[\\/._-])components?(?:[\\/._-]|$)/i.test(lowerPath);
      return {
        category: 'FRONTEND',
        moduleKey: isComponent ? 'module-frontend-components' : 'module-frontend-app',
        moduleName: isComponent ? 'Frontend Components' : 'Frontend App & Pages',
        isEntryPoint,
        isTest: false,
        isConfig: false,
        language,
      };
    }

    // 11. Configuration
    if (isConfig) {
      return {
        category: 'CONFIG',
        moduleKey: 'module-config',
        moduleName: 'Project Configuration',
        isEntryPoint: false,
        isTest: false,
        isConfig: true,
        language,
      };
    }

    // 12. Utilities & Shared Helpers (Default code fallback)
    return {
      category: 'UTILS',
      moduleKey: 'module-utils',
      moduleName: 'Shared Utilities & Helpers',
      isEntryPoint,
      isTest: false,
      isConfig: false,
      language,
    };
  }
}
