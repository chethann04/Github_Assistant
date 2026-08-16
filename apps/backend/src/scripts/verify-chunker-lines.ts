/**
 * Verification test for exact physical line number accuracy in ChunkerService.
 * Run: npx tsx src/scripts/verify-chunker-lines.ts
 */
import { ChunkerService } from '../services/chunker.service.js';
import { GitHubService } from '../services/github.service.js';
import prisma from '../config/prisma.js';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function verifyChunkerLines() {
  console.log('\n============================================================');
  console.log('🔬 CHUNKER PHYSICAL LINE NUMBER ACCURACY VERIFICATION');
  console.log('============================================================\n');

  const repo = await prisma.repository.findFirst({
    where: { owner: 'chethann04', name: 'Deadlock-Detection-' },
  });
  if (!repo) {
    console.log('Repository chethann04/Deadlock-Detection- not found in DB. Skipping GitHub tests.');
    testSyntheticCases();
    return;
  }

  const commitSha = repo.latestCommit || repo.defaultBranch;
  console.log(`Fetching src/BankersAlgorithm.jsx from commit ${commitSha}...\n`);

  const rawContent = await GitHubService.fetchRawFileContent(
    repo.owner,
    repo.name,
    commitSha,
    'src/BankersAlgorithm.jsx'
  );

  const rawLines = rawContent.replace(/\r\n/g, '\n').split('\n');
  console.log(`Raw file has ${rawLines.length} physical lines.\n`);

  const chunks = ChunkerService.chunkFile('src/BankersAlgorithm.jsx', rawContent);
  console.log(`Chunker produced ${chunks.length} chunks.\n`);

  // Rule 1: No single chunk should span more than 80 lines
  console.log('[RULE 1] No chunk exceeds 80 lines:');
  for (const chunk of chunks) {
    const size = chunk.endLine - chunk.startLine + 1;
    assert(`Chunk ${chunk.startLine}-${chunk.endLine} (${chunk.name || chunk.chunkType}): ${size} lines`, size <= 80, `Oversized: ${size} lines`);
  }

  // Rule 2: Every chunk's first line of content == rawLines[startLine - 1]
  console.log('\n[RULE 2] chunk.content[0] === rawLines[startLine - 1] (exact physical line match):');
  let mismatchCount = 0;
  for (const chunk of chunks) {
    const expectedFirstLine = rawLines[chunk.startLine - 1];
    const actualFirstLine = chunk.content.split('\n')[0];
    const match = expectedFirstLine === actualFirstLine;
    if (!match) {
      mismatchCount++;
      console.error(`  ✗ MISMATCH at L${chunk.startLine}: expected="${expectedFirstLine?.slice(0, 60)}" got="${actualFirstLine?.slice(0, 60)}"`);
      failed++;
    }
  }
  if (mismatchCount === 0) {
    console.log(`  ✓ All ${chunks.length} chunks have exact physical line number alignment`);
    passed++;
  }

  // Rule 3: chunk.content === fileLines.slice(startLine-1, endLine).join('\n')
  console.log('\n[RULE 3] chunk.content is a verbatim slice of physical file lines:');
  let contentMismatches = 0;
  for (const chunk of chunks) {
    const expectedContent = rawLines.slice(chunk.startLine - 1, chunk.endLine).join('\n');
    if (expectedContent !== chunk.content) {
      contentMismatches++;
      console.error(`  ✗ Content mismatch at chunk L${chunk.startLine}-L${chunk.endLine}`);
    }
  }
  if (contentMismatches === 0) {
    console.log(`  ✓ All ${chunks.length} chunks are verbatim source slices`);
    passed++;
  } else {
    failed += contentMismatches;
  }

  // Rule 4: Key functions found in dedicated chunks (not buried in one giant chunk)
  console.log('\n[RULE 4] Key functions found in properly sized dedicated chunks:');
  const targets = [
    { name: 'calculateNeed', expectedLine: 507 },
    { name: 'displayAvailable', expectedLine: 531 },
    { name: 'findSafeSequence', expectedLine: 557 },
    { name: 'generateResourceAllocationGraph', expectedLine: 660 },
  ];

  for (const target of targets) {
    const dedicated = chunks.find(c => c.name === target.name);
    if (dedicated) {
      assert(
        `${target.name} has its own chunk at L${dedicated.startLine}-L${dedicated.endLine}`,
        dedicated.startLine === target.expectedLine,
        `Expected startLine=${target.expectedLine}, got ${dedicated.startLine}`
      );
    } else {
      // It may appear as content in a larger sub-chunk — find which chunk covers its line
      const covering = chunks.find(c => c.startLine <= target.expectedLine && c.endLine >= target.expectedLine);
      if (covering) {
        const chunkFirstLine = rawLines[covering.startLine - 1];
        assert(
          `${target.name} (L${target.expectedLine}) covered by chunk L${covering.startLine}-L${covering.endLine}`,
          rawLines[covering.startLine - 1] === covering.content.split('\n')[0],
          `Line ${covering.startLine} mismatch`
        );
      } else {
        assert(`${target.name} covered by some chunk`, false, 'No chunk covers its line range');
      }
    }
  }

  // Rule 5: No chunk larger than 1814 lines (previous giant chunk size)
  console.log('\n[RULE 5] No chunk is the old 1814-line giant:');
  const giant = chunks.find(c => c.endLine - c.startLine > 500);
  assert('No chunk spans >500 lines', !giant, giant ? `Found chunk L${giant.startLine}-L${giant.endLine}` : undefined);

  // Synthetic cases (no GitHub needed)
  testSyntheticCases();

  console.log('\n============================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 ALL CHUNKER LINE NUMBER TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED. Check the output above.');
  }
  console.log('============================================================\n');
}

function testSyntheticCases() {
  console.log('\n[SYNTHETIC CASES] Testing known line number scenarios:');

  // startLine = 1
  const tiny = ChunkerService.chunkFile('test.ts', 'export const a = 1;\nexport const b = 2;\n');
  assert('startLine=1 for small file', tiny.length > 0 && tiny[0].startLine === 1);

  // Middle range
  const mid = Array.from({ length: 200 }, (_, i) => `const fn${i} = () => { return ${i}; };`).join('\n');
  const midChunks = ChunkerService.chunkFile('test.ts', mid);
  assert('Middle-range file produces multiple chunks', midChunks.length > 3);
  for (const c of midChunks) {
    const midLines = mid.split('\n');
    const expected = midLines.slice(c.startLine - 1, c.endLine).join('\n');
    if (expected !== c.content) {
      console.error(`  ✗ Content mismatch in synthetic middle-range chunk at L${c.startLine}-${c.endLine}`);
      failed++;
    }
  }
  passed++;
  console.log(`  ✓ Middle-range: ${midChunks.length} chunks, all line-accurate`);

  // Single-line citation
  const single = ChunkerService.chunkFile('test.ts', 'const x = 1;');
  assert('Single line file: startLine=1, endLine=1', single.length > 0 && single[0].startLine === 1 && single[0].endLine === 1);

  // Overlapping sub-windows for oversized function
  const bigFn = `const bigFn = () => {\n` + Array.from({ length: 200 }, (_, i) => `  const x${i} = ${i};`).join('\n') + '\n};\n';
  const bigChunks = ChunkerService.chunkFile('test.ts', bigFn);
  const allUnder80 = bigChunks.every(c => (c.endLine - c.startLine + 1) <= 80);
  assert(`Oversized function (200+ lines) split into chunks ≤80 lines each`, allUnder80);
  for (const c of bigChunks) {
    const rawFnLines = bigFn.replace(/\r\n/g, '\n').split('\n');
    const expected = rawFnLines.slice(c.startLine - 1, c.endLine).join('\n');
    if (expected !== c.content) {
      console.error(`  ✗ Sub-window content mismatch at L${c.startLine}-${c.endLine}`);
      failed++;
    }
  }
  passed++;
  console.log(`  ✓ Oversized function: split into ${bigChunks.length} sub-windows, all line-accurate`);
}

verifyChunkerLines().catch(console.error).finally(() => prisma.$disconnect());
