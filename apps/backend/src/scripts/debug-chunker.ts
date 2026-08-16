import prisma from '../config/prisma.js';
import { GitHubService } from '../services/github.service.js';
import { ChunkerService } from '../services/chunker.service.js';
import { VectorStore } from '../services/chroma.service.js';

async function diagnose() {
  console.log('Finding repository with BankersAlgorithm.jsx in database...');
  const repos = await prisma.repository.findMany();
  console.log(`Found ${repos.length} repositories.`);

  for (const repo of repos) {
    console.log(`\nRepo: ${repo.owner}/${repo.name} (${repo.id}) - commit: ${repo.latestCommit}`);
    try {
      const files = await GitHubService.fetchRepoFileTree(repo.owner, repo.name, repo.latestCommit || repo.defaultBranch);
      const target = files.find(f => f.path.includes('BankersAlgorithm.jsx'));
      if (target) {
        console.log(`\nFound target file: ${target.path} in repo ${repo.owner}/${repo.name}`);
        const rawContent = await GitHubService.fetchRawFileContent(repo.owner, repo.name, repo.latestCommit || repo.defaultBranch, target.path);
        const rawLines = rawContent.split(/\r?\n/);
        console.log(`Total raw lines in file: ${rawLines.length}`);

        // Find calculateNeed in raw lines
        rawLines.forEach((line, idx) => {
          if (line.includes('calculateNeed') || line.includes('findSafeSequence') || line.includes('displayAvailable') || line.includes('generateResourceAllocationGraph')) {
            console.log(`RAW FILE LINE ${idx + 1}: ${line.trim()}`);
          }
        });

        // Run ChunkerService
        console.log('\n--- CHUNKER SERVICE OUTPUT ---');
        const chunks = ChunkerService.chunkFile(target.path, rawContent);
        console.log(`Generated ${chunks.length} chunks.`);
        for (const [cIdx, chunk] of chunks.entries()) {
          console.log(`Chunk ${cIdx + 1}: [${chunk.chunkType} ${chunk.name || ''}] Lines ${chunk.startLine}-${chunk.endLine} (length: ${chunk.content.split('\n').length} lines)`);
          if (chunk.name?.includes('calculateNeed') || chunk.content.includes('calculateNeed')) {
            console.log(`>>> Contains calculateNeed! Chunk lines: ${chunk.startLine}-${chunk.endLine}`);
            console.log(`>>> First 3 lines of chunk content:`);
            console.log(chunk.content.split('\n').slice(0, 3).join('\n'));
            console.log(`>>> Raw file lines at ${chunk.startLine}-${chunk.startLine + 2}:`);
            console.log(rawLines.slice(chunk.startLine - 1, chunk.startLine + 2).join('\n'));
          }
        }

        // Check ChromaDB points
        console.log('\n--- CHROMADB POINTS ---');
        const searchResults = await VectorStore.searchSimilar(new Array(1536).fill(0), repo.id, 20, target.path);
        console.log(`ChromaDB search found ${searchResults.length} points for ${target.path}`);
        for (const res of searchResults) {
          console.log(`ChromaDB Point: payload.startLine=${res.payload.startLine}, payload.endLine=${res.payload.endLine}, name=${res.payload.name}`);
        }
      }
    } catch (e: any) {
      console.warn(`Could not fetch repo ${repo.owner}/${repo.name}:`, e.message);
    }
  }
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
