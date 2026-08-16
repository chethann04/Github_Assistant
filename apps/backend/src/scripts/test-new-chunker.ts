import { ChunkerService } from '../services/chunker.service.js';
import { GitHubService } from '../services/github.service.js';
import prisma from '../config/prisma.js';

// Test new chunking logic
async function testNewChunker() {
  const repo = await prisma.repository.findFirst({
    where: { owner: 'chethann04', name: 'Deadlock-Detection-' }
  });
  if (!repo) return;

  const rawContent = await GitHubService.fetchRawFileContent(
    repo.owner, repo.name, repo.latestCommit || repo.defaultBranch, 'src/BankersAlgorithm.jsx'
  );
  const rawLines = rawContent.split(/\r?\n/);
  console.log(`Total raw lines: ${rawLines.length}`);

  const functionOrClassRegex = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\*?\s+([a-zA-Z0-9_$]+)|class\s+([a-zA-Z0-9_$]+)|interface\s+([a-zA-Z0-9_$]+)|type\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?function|def\s+([a-zA-Z0-9_]+)|func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)|fn\s+([a-zA-Z0-9_]+)|pub\s+(?:fn|struct|enum|impl)\s+([a-zA-Z0-9_]+))/;

  const chunks: Array<{ startLine: number; endLine: number; name?: string; content: string }> = [];
  const MAX_CHUNK_LINES = 60;

  function pushChunk(start: number, end: number, name?: string) {
    if (start >= end) return;
    const chunkLines = rawLines.slice(start, end);
    const content = chunkLines.join('\n');
    if (content.trim().length > 10) {
      // If chunk exceeds max lines, break into subchunks
      if (chunkLines.length > MAX_CHUNK_LINES) {
        for (let s = 0; s < chunkLines.length; s += 45) {
          const subEnd = Math.min(s + MAX_CHUNK_LINES, chunkLines.length);
          const subLines = chunkLines.slice(s, subEnd);
          chunks.push({
            startLine: start + s + 1,
            endLine: start + subEnd,
            name,
            content: subLines.join('\n'),
          });
          if (subEnd >= chunkLines.length) break;
        }
      } else {
        chunks.push({
          startLine: start + 1,
          endLine: end,
          name,
          content,
        });
      }
    }
  }

  let currentStart = 0;
  let currentName: string | undefined = undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.match(functionOrClassRegex);
    if (match) {
      if (i > currentStart) {
        pushChunk(currentStart, i, currentName);
      }
      currentStart = i;
      currentName = match.slice(1).find(n => Boolean(n));
    }
  }

  if (currentStart < rawLines.length) {
    pushChunk(currentStart, rawLines.length, currentName);
  }

  console.log(`Generated ${chunks.length} chunks with new chunker.`);
  
  // Verify calculateNeed, displayAvailable, findSafeSequence, generateResourceAllocationGraph
  const targets = ['calculateNeed', 'displayAvailable', 'findSafeSequence', 'generateResourceAllocationGraph'];
  for (const t of targets) {
    const found = chunks.filter(c => c.name === t || c.content.includes(t));
    console.log(`\nTarget: "${t}" found in ${found.length} chunk(s):`);
    for (const c of found) {
      console.log(`  - Chunk: L${c.startLine}-L${c.endLine} (name: ${c.name || 'none'})`);
      console.log(`    First line: "${c.content.split('\n')[0].trim()}"`);
      console.log(`    Actual raw line ${c.startLine}: "${rawLines[c.startLine - 1].trim()}"`);
      // Verify physical line matches!
      if (c.content.split('\n')[0].trim() !== rawLines[c.startLine - 1].trim()) {
        console.error(`    MISMATCH: chunk line 1 != raw line ${c.startLine}`);
      } else {
        console.log(`    MATCH: Line numbers are 100% physical and exact!`);
      }
    }
  }
}

testNewChunker().catch(console.error).finally(() => prisma.$disconnect());
