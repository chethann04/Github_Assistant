import { sanitizeUnicodeText } from '../utils/sanitizer.js';

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: 'function' | 'class' | 'interface' | 'module' | 'block' | 'doc';
  name?: string;
  content: string;
  language: string;
}

/**
 * Redact sensitive high-entropy credentials, private keys, and tokens from code content
 */
export function maskSensitiveData(code: string): string {
  if (!code) return '';

  return code
    // Redact PEM/RSA private keys
    .replace(/-----BEGIN [A-Z\s]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    // Redact GitHub personal access tokens
    .replace(/\bghp_[a-zA-Z0-9]{36}\b/g, 'ghp_[REDACTED]')
    .replace(/\bgithub_pat_[a-zA-Z0-9_]{82}\b/g, 'github_pat_[REDACTED]')
    // Redact OpenAI / generic API keys
    .replace(/\bsk-[a-zA-Z0-9_-]{20,}\b/g, 'sk-[REDACTED_KEY]')
    // Redact AWS access keys
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[REDACTED]')
    // Redact generic high-entropy key assignments
    .replace(
      /(API_KEY|SECRET_KEY|GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY|PRIVATE_KEY|DATABASE_URL|PASSWORD)\s*[:=]\s*["'][^"'\n]{8,}["']/gi,
      '$1 = "[REDACTED_SECRET]"'
    )
    // Redact inline data:image URIs and literal data:image prefixes to prevent triggering multimodal VLM errors in text embedding models
    .replace(/data:image(?:\/[^"'\s)>]+|(?:\/)?|\b)/gi, '[IMAGE_DATA_URI]');
}

/**
 * Maximum lines per chunk. Chunks exceeding this are split into overlapping sub-windows
 * so that no single vector covers more than MAX_CHUNK_LINES physical lines.
 */
const MAX_CHUNK_LINES = 80;

/**
 * Overlap lines between sub-windows when a logical chunk is oversized.
 * This keeps context continuity at sub-chunk boundaries.
 */
const SUB_CHUNK_OVERLAP = 15;

export class ChunkerService {
  private static detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      mjs: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      sql: 'sql',
    };
    return map[ext] || 'plaintext';
  }

  /**
   * Split a logical chunk into overlapping sub-windows when it exceeds MAX_CHUNK_LINES.
   * All line numbers reference the ORIGINAL physical source file — not the chunk-local lines.
   */
  private static splitOversizedChunk(
    filePath: string,
    language: string,
    chunkType: CodeChunk['chunkType'],
    name: string | undefined,
    fileLines: string[],
    startIdx: number, // 0-based index into fileLines where this logical chunk starts
    endIdx: number    // 0-based exclusive end index
  ): CodeChunk[] {
    const results: CodeChunk[] = [];
    const step = MAX_CHUNK_LINES - SUB_CHUNK_OVERLAP;

    for (let s = startIdx; s < endIdx; s += step) {
      const e = Math.min(s + MAX_CHUNK_LINES, endIdx);
      const subLines = fileLines.slice(s, e);
      if (subLines.join('').trim().length < 10) continue;
      results.push({
        filePath,
        startLine: s + 1,       // 1-based physical line number
        endLine: e,             // 1-based inclusive physical line number
        chunkType,
        name,
        language,
        content: subLines.join('\n'),
      });
      if (e >= endIdx) break;
    }
    return results;
  }

  /**
   * Chunks a source file by logical units (functions, classes, arrow functions, etc.)
   * with guaranteed physical line number accuracy.
   *
   * Key properties:
   * - Detects boundaries at ANY indentation level (handles nested arrow functions in JSX).
   * - Enforces MAX_CHUNK_LINES per chunk. Oversized logical chunks are split into
   *   overlapping sub-windows while preserving physical startLine/endLine.
   * - chunk.content always equals fileLines.slice(startLine-1, endLine).join('\n').
   *   No generated headers are ever injected into chunk content.
   */
  public static chunkFile(filePath: string, content: string): CodeChunk[] {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif', '.avif'].includes(ext)) {
      console.log(`[Embedding] Skipping image file: ${filePath} Reason: NVIDIA text embedding endpoint does not support image inputs`);
      return [];
    }

    const language = this.detectLanguage(filePath);
    const cleanedText = sanitizeUnicodeText(content, filePath);
    const sanitizedContent = maskSensitiveData(cleanedText);

    // Normalize CRLF → LF before splitting so line indices are consistent
    const fileLines = sanitizedContent.replace(/\r\n/g, '\n').split('\n');
    const totalLines = fileLines.length;

    if (totalLines === 0 || sanitizedContent.trim().length === 0) {
      return [];
    }

    // Small files: keep as single module chunk
    if (totalLines <= 60) {
      return [
        {
          filePath,
          startLine: 1,
          endLine: totalLines,
          chunkType: 'module',
          name: filePath.split('/').pop(),
          language,
          content: fileLines.join('\n'),
        },
      ];
    }

    // ---------------------------------------------------------------
    // Boundary detection regex.
    // Uses ^\s* so it matches at ANY indentation level, covering:
    //   - Top-level: export default function Foo() {
    //   - Nested arrow functions: const handleClick = () => {
    //   - Class/interface declarations
    //   - Python defs, Go funcs, Rust fns, etc.
    // ---------------------------------------------------------------
    const boundaryRegex =
      /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\*?\s+([a-zA-Z0-9_$]+)|class\s+([a-zA-Z0-9_$]+)|interface\s+([a-zA-Z0-9_$]+)|type\s+([a-zA-Z0-9_$]+)\s*=|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?function|def\s+([a-zA-Z0-9_]+)|func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(|fn\s+([a-zA-Z0-9_]+)|pub\s+(?:fn|struct|enum|impl)\s+([a-zA-Z0-9_]+))/;

    const logicalBoundaries: Array<{ startIdx: number; name?: string; type: CodeChunk['chunkType'] }> = [];

    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];
      const match = line.match(boundaryRegex);
      if (!match) continue;

      const detectedName = match.slice(1).find((n) => Boolean(n));
      let detectedType: CodeChunk['chunkType'] = 'function';
      if (line.includes('class ')) detectedType = 'class';
      else if (line.includes('interface ')) detectedType = 'interface';
      else if (line.match(/^\s*type\s+/)) detectedType = 'interface';

      logicalBoundaries.push({ startIdx: i, name: detectedName, type: detectedType });
    }

    // If no boundaries detected at all (flat file, large JSON, markdown, etc.),
    // fall back to sliding window with accurate physical line numbers.
    if (logicalBoundaries.length === 0) {
      return this.slidingWindowChunks(filePath, language, fileLines);
    }

    // Build final chunks from boundaries
    const chunks: CodeChunk[] = [];

    for (let b = 0; b < logicalBoundaries.length; b++) {
      const boundary = logicalBoundaries[b];
      const nextBoundaryIdx =
        b + 1 < logicalBoundaries.length ? logicalBoundaries[b + 1].startIdx : totalLines;

      const startIdx = boundary.startIdx;
      const endIdx = nextBoundaryIdx;

      // Skip trivially small boundary sections
      const sectionLines = fileLines.slice(startIdx, endIdx);
      if (sectionLines.join('').trim().length < 10) continue;

      const lineCount = endIdx - startIdx;

      if (lineCount <= MAX_CHUNK_LINES) {
        // Fits within limit: emit as single chunk
        chunks.push({
          filePath,
          startLine: startIdx + 1,
          endLine: endIdx,
          chunkType: boundary.type,
          name: boundary.name,
          language,
          content: sectionLines.join('\n'),
        });
      } else {
        // Oversized: split into overlapping sub-windows
        const subChunks = this.splitOversizedChunk(
          filePath,
          language,
          boundary.type,
          boundary.name,
          fileLines,
          startIdx,
          endIdx
        );
        chunks.push(...subChunks);
      }
    }

    // Handle any leading lines before first boundary
    if (logicalBoundaries.length > 0 && logicalBoundaries[0].startIdx > 0) {
      const leadLines = fileLines.slice(0, logicalBoundaries[0].startIdx);
      if (leadLines.join('').trim().length > 10) {
        chunks.unshift({
          filePath,
          startLine: 1,
          endLine: logicalBoundaries[0].startIdx,
          chunkType: 'block',
          name: undefined,
          language,
          content: leadLines.join('\n'),
        });
      }
    }

    return chunks;
  }

  /**
   * Sliding window fallback for files with no detectable logical structure.
   * All startLine/endLine values are 1-based physical line numbers.
   */
  private static slidingWindowChunks(
    filePath: string,
    language: string,
    fileLines: string[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const windowSize = 60;
    const stepSize = 45;

    for (let i = 0; i < fileLines.length; i += stepSize) {
      const end = Math.min(i + windowSize, fileLines.length);
      const chunkLines = fileLines.slice(i, end);
      if (chunkLines.join('').trim().length < 10) {
        if (end >= fileLines.length) break;
        continue;
      }
      chunks.push({
        filePath,
        startLine: i + 1,
        endLine: end,
        chunkType: language === 'markdown' ? 'doc' : 'block',
        language,
        content: chunkLines.join('\n'),
      });
      if (end >= fileLines.length) break;
    }

    return chunks;
  }
}
