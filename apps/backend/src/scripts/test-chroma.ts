import { VectorStore } from '../services/chroma.service.js';

async function test() {
  console.log('Testing ChromaService availability...');
  const available = await VectorStore.isAvailable();
  console.log('ChromaService available:', available);

  console.log('Testing ensureCollection...');
  await VectorStore.ensureCollection();
  console.log('ensureCollection succeeded.');

  console.log('Testing upsertChunks...');
  const testChunks = [
    {
      chunk: {
        repositoryId: 'repo-test-1',
        commitSha: 'commit123',
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 10,
        chunkType: 'function',
        language: 'typescript',
        name: 'bootstrap',
        content: 'export function bootstrap() { console.log("running"); }',
      },
      vector: new Array(2048).fill(0.05),
    },
    {
      chunk: {
        repositoryId: 'repo-test-1',
        commitSha: 'commit123',
        filePath: 'src/deadlock.ts',
        startLine: 1,
        endLine: 20,
        chunkType: 'class',
        language: 'typescript',
        name: 'DeadlockDetector',
        content: 'export class DeadlockDetector { detect() { return true; } }',
      },
      vector: new Array(2048).fill(0.08),
    },
  ];

  await VectorStore.upsertChunks('repo-test-1', 'commit123', testChunks);
  console.log('upsertChunks succeeded.');

  console.log('Testing countChunks...');
  const count = await VectorStore.countChunks('repo-test-1');
  console.log('Count for repo-test-1:', count);

  console.log('Testing searchSimilar...');
  const searchResults = await VectorStore.searchSimilar(new Array(2048).fill(0.075), 'repo-test-1', 5);
  console.log('Search results count:', searchResults.length);
  for (const res of searchResults) {
    console.log(`- Result [score=${res.score.toFixed(4)}]: ${res.payload.filePath} -> ${res.payload.name}`);
  }

  console.log('Testing deleteByRepositoryId...');
  await VectorStore.deleteByRepositoryId('repo-test-1');
  const countAfter = await VectorStore.countChunks('repo-test-1');
  console.log('Count after delete:', countAfter);

  console.log('ALL VECTOR STORE TESTS PASSED!');
  process.exit(0);
}

test().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
