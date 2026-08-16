import axios from 'axios';
import { config } from '../config/env.js';
import { sanitizeUnicodeText } from '../utils/sanitizer.js';

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  description: string;
  defaultBranch: string;
  latestCommit: string;
  language: string;
  stars: number;
  forks: number;
  topics: string[];
  visibility: string;
}

export interface RepoFile {
  path: string;
  size: number;
  sha: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  avatarUrl?: string;
  url: string;
  filesChanged?: string[];
}

// Extensions we want to index
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rb', '.php', '.swift', '.kt', '.scala', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.proto',
  '.md', '.markdown', '.json', '.yaml', '.yml', '.toml', '.xml',
  '.tf', '.hcl', '.dockerfile',
]);

export const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif', '.avif',
]);

const IGNORED_DIRECTORIES = [
  'node_modules/', 'dist/', 'build/', '.next/', '.git/', '.github/',
  'vendor/', 'coverage/', '__pycache__/', '.venv/', 'venv/', 'target/',
  'bin/', 'obj/', '.idea/', '.vscode/', '.cache/', '.parcel-cache/',
  'out/', '.output/', '__snapshots__/', 'tmp/', 'temp/',
];

const IGNORED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  'Pipfile.lock', 'poetry.lock', 'composer.lock', 'go.sum',
  'bun.lockb', 'shrinkwrap.json',
]);

// Files likely to contain secrets — strictly skipped before indexing
const SECRET_FILE_PATTERNS = [
  /\.env($|\..+$)/i,
  /secrets?\.(json|ya?ml)$/i,
  /credentials?\.(json|ya?ml)$/i,
  /service[-_]?account.*\.json$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
  /\.jks$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /id_dsa/i,
  /id_ecdsa/i,
  /\.npmrc$/i,
  /\.dockercfg$/i,
  /\.netrc$/i,
];

const MAX_FILE_SIZE = 400 * 1024; // 400KB

export class GitHubService {
  private static getHeaders() {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Knowledge-Assistant/2.0',
    };
    if (config.githubToken) {
      headers['Authorization'] = `token ${config.githubToken}`;
    }
    return headers;
  }

  public static parseRepoUrl(url: string): { owner: string; name: string } {
    const cleanUrl = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
    const match = cleanUrl.match(/(?:github\.com\/|git@github\.com:)?([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: "${url}". Expected format: https://github.com/owner/repo`);
    }
    return { owner: match[1], name: match[2] };
  }

  public static async fetchRepoMetadata(owner: string, name: string): Promise<RepoInfo> {
    const apiUrl = `https://api.github.com/repos/${owner}/${name}`;
    try {
      const response = await axios.get(apiUrl, { headers: this.getHeaders(), timeout: 15000 });
      const data = response.data;
      const defaultBranch = data.default_branch || 'main';

      let latestCommit = '';
      try {
        const commitRes = await axios.get(
          `https://api.github.com/repos/${owner}/${name}/commits/${defaultBranch}`,
          { headers: this.getHeaders(), timeout: 10000 }
        );
        latestCommit = commitRes.data.sha;
      } catch {
        latestCommit = defaultBranch;
      }

      return {
        owner: data.owner?.login || owner,
        name: data.name || name,
        url: data.html_url || `https://github.com/${owner}/${name}`,
        description: data.description || '',
        defaultBranch,
        latestCommit,
        language: data.language || 'Unknown',
        stars: data.stargazers_count || 0,
        forks: data.forks_count || 0,
        topics: Array.isArray(data.topics) ? data.topics : [],
        visibility: data.visibility || 'public',
      };
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new Error(`Repository ${owner}/${name} not found or is private. Check the URL and permissions.`);
      }
      if (err.response?.status === 403) {
        const rateLimitReset = err.response.headers['x-ratelimit-reset'];
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'soon';
        throw new Error(`GitHub API rate limit exceeded. Limit resets at ${resetTime}. Consider adding a GITHUB_TOKEN.`);
      }
      throw new Error(`GitHub API error: ${err.message}`);
    }
  }

  public static async fetchRepoFileTree(owner: string, name: string, commitSha: string): Promise<RepoFile[]> {
    const apiUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${commitSha}?recursive=1`;
    try {
      const response = await axios.get(apiUrl, { headers: this.getHeaders(), timeout: 30000 });
      const tree = response.data.tree || [];

      const codeFiles: RepoFile[] = [];

      for (const item of tree) {
        if (item.type !== 'blob') continue;
        const filePath = item.path as string;

        // Skip ignored directories
        if (IGNORED_DIRECTORIES.some((dir) => filePath.startsWith(dir) || filePath.includes(`/${dir}`))) continue;

        // Skip secret files
        if (SECRET_FILE_PATTERNS.some((pattern) => pattern.test(filePath))) continue;

        const fileName = filePath.split('/').pop() || '';
        if (IGNORED_FILES.has(fileName)) continue;

        // Extract extension
        const dotIdx = fileName.lastIndexOf('.');
        const ext = dotIdx !== -1 ? fileName.substring(dotIdx).toLowerCase() : '';

        // Skip image files explicitly with log
        if (IMAGE_EXTENSIONS.has(ext)) {
          console.log(`[Embedding] Skipping image file: ${filePath} Reason: NVIDIA text embedding endpoint does not support image inputs`);
          continue;
        }

        // Check extension
        if (!ALLOWED_EXTENSIONS.has(ext) && !fileName.toLowerCase().startsWith('dockerfile')) continue;

        // Skip large files
        if (item.size && item.size > MAX_FILE_SIZE) {
          console.log(`[GitHubService] Skipping large file: ${filePath} (${Math.round(item.size / 1024)}KB)`);
          continue;
        }

        codeFiles.push({ path: filePath, size: item.size || 0, sha: item.sha });
      }

      return codeFiles;
    } catch (err: any) {
      if (err.response?.status === 409) {
        throw new Error(`Repository ${owner}/${name} is empty or has no commits yet.`);
      }
      throw new Error(`Failed to fetch file tree for ${owner}/${name}: ${err.message}`);
    }
  }

  public static async fetchRawFileContent(
    owner: string,
    name: string,
    commitSha: string,
    filePath: string
  ): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${commitSha}/${filePath}`;
    try {
      const response = await axios.get(rawUrl, {
        responseType: 'text',
        transformResponse: [(data) => data],
        timeout: 15000,
      });
      const content = typeof response.data === 'string' ? response.data : String(response.data);

      // Basic check for binary content
      if (this.isBinaryContent(content)) {
        throw new Error(`File appears to be binary: ${filePath}`);
      }

      return sanitizeUnicodeText(content, filePath);
    } catch (err: any) {
      if (err.message.includes('binary')) throw err;

      // Fallback to GitHub API
      try {
        const blobUrl = `https://api.github.com/repos/${owner}/${name}/contents/${filePath}?ref=${commitSha}`;
        const res = await axios.get(blobUrl, { headers: this.getHeaders(), timeout: 10000 });
        if (res.data?.content) {
          const raw = Buffer.from(res.data.content, 'base64').toString('utf-8');
          if (this.isBinaryContent(raw)) {
            throw new Error(`File appears to be binary: ${filePath}`);
          }
          return sanitizeUnicodeText(raw, filePath);
        }
      } catch {
        // ignore
      }
      throw new Error(`Failed to fetch content for ${filePath}: ${err.message}`);
    }
  }

  public static async fetchCommits(
    owner: string,
    name: string,
    perPage: number = 20
  ): Promise<CommitInfo[]> {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${name}/commits?per_page=${perPage}`,
        { headers: this.getHeaders(), timeout: 15000 }
      );

      return response.data.map((c: any) => ({
        sha: c.sha,
        message: c.commit.message.split('\n')[0],
        author: c.commit.author?.name || c.author?.login || 'Unknown',
        date: c.commit.author?.date || new Date().toISOString(),
        avatarUrl: c.author?.avatar_url,
        url: c.html_url,
      }));
    } catch (err: any) {
      console.warn(`[GitHubService] Failed to fetch commits: ${err.message}`);
      return [];
    }
  }

  public static async fetchCommitDetail(
    owner: string,
    name: string,
    sha: string
  ): Promise<{ commit: CommitInfo; filesChanged: string[] }> {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${name}/commits/${sha}`,
        { headers: this.getHeaders(), timeout: 15000 }
      );
      const data = response.data;
      return {
        commit: {
          sha: data.sha,
          message: data.commit.message,
          author: data.commit.author?.name || 'Unknown',
          date: data.commit.author?.date || '',
          avatarUrl: data.author?.avatar_url,
          url: data.html_url,
        },
        filesChanged: (data.files || []).map((f: any) => f.filename),
      };
    } catch (err: any) {
      throw new Error(`Failed to fetch commit ${sha}: ${err.message}`);
    }
  }

  /**
   * Heuristic check for binary file content
   */
  private static isBinaryContent(content: string): boolean {
    // Check for null bytes which indicate binary
    if (content.includes('\0')) return true;
    // Check ratio of non-printable characters
    const sample = content.slice(0, 1000);
    let nonPrintable = 0;
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code < 8 || (code > 13 && code < 32)) nonPrintable++;
    }
    return nonPrintable / sample.length > 0.1;
  }
}
