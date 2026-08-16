import { VectorStore, SearchResult } from './chroma.service.js';
import { EmbeddingService } from './embedding.service.js';
import { Citation, maskSecrets } from './rag.service.js';
import prisma from '../config/prisma.js';

export type RepoSizeTier = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';

export interface RepoScaleProfile {
  tier: RepoSizeTier;
  totalFiles: number;
  totalChunks: number;
  candidateLimit: number;
  selectedChunkLimit: number;
  maxTokenBudget: number;
  minRelevanceScore: number;
}

export type AnalysisDomain = 'ARCHITECTURE' | 'DOCS' | 'BUGS' | 'IMPACT' | 'GENERAL';

export interface AdaptiveRetrievalResult {
  citations: Citation[];
  contextText: string;
  profile: RepoScaleProfile;
  totalCandidatesFetched: number;
  retrievalTimeMs: number;
}

export class AdaptiveRetrievalService {
  /**
   * Dynamically classifies repository scale based on indexed files and logical chunks.
   */
  public static async getRepoProfile(repositoryId: string): Promise<RepoScaleProfile> {
    const chunkCount = await VectorStore.countChunks(repositoryId);

    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        indexJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const totalFiles = repo?.indexJobs[0]?.totalFiles || Math.max(1, Math.round(chunkCount / 4));
    const totalChunks = Math.max(chunkCount, repo?.indexJobs[0]?.totalChunks || 0);

    let tier: RepoSizeTier = 'SMALL';
    let candidateLimit = 12;
    let selectedChunkLimit = 6;
    let maxTokenBudget = 4000;
    let minRelevanceScore = 0.35;

    if (totalChunks >= 2000 || totalFiles >= 500) {
      tier = 'VERY_LARGE';
      candidateLimit = 20;
      selectedChunkLimit = 10;
      maxTokenBudget = 6000;
      minRelevanceScore = 0.45;
    } else if (totalChunks >= 500 || totalFiles >= 150) {
      tier = 'LARGE';
      candidateLimit = 16;
      selectedChunkLimit = 8;
      maxTokenBudget = 5500;
      minRelevanceScore = 0.42;
    } else if (totalChunks >= 100 || totalFiles >= 25) {
      tier = 'MEDIUM';
      candidateLimit = 14;
      selectedChunkLimit = 7;
      maxTokenBudget = 4800;
      minRelevanceScore = 0.38;
    } else {
      tier = 'SMALL';
      candidateLimit = 10;
      selectedChunkLimit = 5;
      maxTokenBudget = 3800;
      minRelevanceScore = 0.32;
    }

    return {
      tier,
      totalFiles,
      totalChunks,
      candidateLimit,
      selectedChunkLimit,
      maxTokenBudget,
      minRelevanceScore,
    };
  }

  /**
   * Analysis-Specific Adaptive Retrieval
   * Dispatches multi-vector queries tailored to the analysis domain, filters by relevance score,
   * enforces deduplication, and bounds total context tokens within budget.
   */
  public static async retrieveForAnalysis(
    repositoryId: string,
    domain: AnalysisDomain,
    customQuery?: string
  ): Promise<AdaptiveRetrievalResult> {
    const startTime = Date.now();
    const profile = await this.getRepoProfile(repositoryId);

    // Formulate targeted multi-queries based on domain
    const queries: string[] = [];

    switch (domain) {
      case 'ARCHITECTURE':
        queries.push(
          'architecture main entry point index app server router configuration',
          'package.json Cargo.toml go.mod pyproject.toml workspace monorepo modules',
          'core components database schema models controllers services lifecycle'
        );
        break;

      case 'DOCS':
        queries.push(
          'exports public api functions classes interfaces types methods endpoints',
          'README usage examples quickstart installation setup configuration options'
        );
        break;

      case 'BUGS':
        queries.push(
          'error exception throw catch try promise async await race condition null undefined',
          'input validation sanitize boundary check buffer overflow memory security auth'
        );
        break;

      case 'IMPACT':
        queries.push(
          customQuery || 'imports exports require dependencies modules callers references'
        );
        break;

      case 'GENERAL':
      default:
        queries.push(customQuery || 'overview architecture entry points core logic');
        break;
    }

    // Fetch candidate chunks across queries via batch embedding and parallel search
    const allMatches: SearchResult[] = [];
    const perQueryLimit = Math.ceil(profile.candidateLimit / queries.length);

    try {
      const queryVectors = await EmbeddingService.generateBatchEmbeddings(queries, queries.length, 'query');
      const searchPromises = queryVectors.map((vec) => VectorStore.searchSimilar(vec, repositoryId, perQueryLimit));
      const matchArrays = await Promise.all(searchPromises);
      for (const matches of matchArrays) {
        allMatches.push(...matches);
      }
    } catch (err: any) {
      console.warn(`[AdaptiveRetrieval] Batch query search error, falling back:`, err.message);
      await Promise.all(
        queries.map(async (q) => {
          try {
            const vector = await EmbeddingService.generateEmbedding(q, 'query');
            const matches = await VectorStore.searchSimilar(vector, repositoryId, perQueryLimit);
            allMatches.push(...matches);
          } catch (singleErr: any) {
            console.warn(`[AdaptiveRetrieval] Query search error for "${q}":`, singleErr.message);
          }
        })
      );
    }

    // Rank & Deduplicate candidates
    const seenKeys = new Set<string>();
    const rankedCandidates: Citation[] = [];

    // Sort all matches descending by cosine similarity score
    allMatches.sort((a, b) => b.score - a.score);

    for (const m of allMatches) {
      if (m.payload.repositoryId !== repositoryId) continue;

      const key = `${m.payload.filePath}:${m.payload.startLine}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        rankedCandidates.push({
          filePath: m.payload.filePath,
          startLine: m.payload.startLine,
          endLine: m.payload.endLine,
          snippet: maskSecrets(m.payload.content || ''),
          score: Math.round(m.score * 100) / 100,
          name: m.payload.name,
        });
      }
    }

    // Filter by relevance threshold, but guarantee at least top K candidates
    let qualified = rankedCandidates.filter((c) => c.score >= profile.minRelevanceScore);
    if (qualified.length < Math.min(6, rankedCandidates.length)) {
      qualified = rankedCandidates.slice(0, profile.selectedChunkLimit);
    }

    // Context Token Budgeting: select top items up to selectedChunkLimit and maxTokenBudget
    const selectedCitations: Citation[] = [];
    let currentTokensEstimate = 0;

    for (const citation of qualified) {
      if (selectedCitations.length >= profile.selectedChunkLimit) break;

      const snippetTokens = Math.ceil((citation.snippet?.length || 0) / 3.5);
      if (currentTokensEstimate + snippetTokens > profile.maxTokenBudget && selectedCitations.length >= 4) {
        break; // Reached context budget ceiling
      }

      selectedCitations.push(citation);
      currentTokensEstimate += snippetTokens;
    }

    // Format final context text with verified source demarcations
    const contextText = selectedCitations
      .map(
        (c, idx) =>
          `[CITATION #${idx + 1}: ${c.filePath} (Lines ${c.startLine}-${c.endLine})${c.name ? ` Symbol: ${c.name}` : ''}]\n${c.snippet}`
      )
      .join('\n\n');

    const retrievalTimeMs = Date.now() - startTime;

    return {
      citations: selectedCitations,
      contextText,
      profile,
      totalCandidatesFetched: allMatches.length,
      retrievalTimeMs,
    };
  }
}
