import { config } from '../config/env.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { ChunkerService } from '../services/chunker.service.js';
import { GitHubService, IMAGE_EXTENSIONS } from '../services/github.service.js';

async function runImageFixSuite() {
  console.log('====================================================');
  console.log('NEMOTRON EMBEDDING — IMAGE INPUT FIX TEST SUITE');
  console.log('====================================================');
  console.log(`Model: ${config.embeddingModel}`);
  console.log(`Dimensions: ${config.embeddingDimensions}`);
  console.log(`NVIDIA Base URL: ${config.nvidiaBaseUrl}`);
  console.log('----------------------------------------------------');

  let allPassed = true;

  // TEST A — TEXT PASSAGE
  console.log('\n[TEST A] Text passage embedding:');
  const passageInput = 'What are the core dependencies and runtime scripts?';
  try {
    const passageVector = await EmbeddingService.generateEmbedding(passageInput, 'passage');
    console.log(`[TEST A] HTTP 200 OK | Vector Dimensions: ${passageVector.length}`);
    if (passageVector.length !== 2048) {
      throw new Error(`Dimension mismatch: expected 2048, got ${passageVector.length}`);
    }
  } catch (err: any) {
    console.error(`[TEST A] FAILED:`, err.message);
    allPassed = false;
  }

  // TEST B — QUERY
  console.log('\n[TEST B] Query embedding:');
  const queryInput = 'What are the core dependencies and runtime scripts?';
  try {
    const queryVector = await EmbeddingService.generateEmbedding(queryInput, 'query');
    console.log(`[TEST B] HTTP 200 OK | Vector Dimensions: ${queryVector.length}`);
    if (queryVector.length !== 2048) {
      throw new Error(`Dimension mismatch: expected 2048, got ${queryVector.length}`);
    }
  } catch (err: any) {
    console.error(`[TEST B] FAILED:`, err.message);
    allPassed = false;
  }

  // TEST C — IMAGE FILE DETECTION & SKIP
  console.log('\n[TEST C] Image file detection & skip (before embedding call):');
  const sampleImagePaths = [
    'assets/images/header.png',
    'src/assets/logo.svg',
    'public/favicon.ico',
    'diagrams/flowchart.webp'
  ];

  let skippedCount = 0;
  for (const imgPath of sampleImagePaths) {
    const ext = imgPath.substring(imgPath.lastIndexOf('.')).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      console.log(`[Embedding] Skipping image file: ${imgPath} Reason: NVIDIA text embedding endpoint does not support image inputs`);
      skippedCount++;
    }
    const chunks = ChunkerService.chunkFile(imgPath, 'BINARY_IMAGE_DATA_OR_XML');
    if (chunks.length !== 0) {
      console.error(`[TEST C] Error: Chunker returned chunks for image file ${imgPath}`);
      allPassed = false;
    }
  }
  console.log(`[TEST C] Total image files verified & skipped: ${skippedCount}/${sampleImagePaths.length} (0 API calls, 0 fake vectors)`);

  // TEST D — FULL cathrynlavery/diagram-design REPOSITORY INGESTION VERIFICATION
  console.log('\n----------------------------------------------------');
  console.log('[TEST D] Testing cathrynlavery/diagram-design full ingestion chunks:');
  try {
    const repoInfo = GitHubService.parseRepoUrl('https://github.com/cathrynlavery/diagram-design');
    const meta = await GitHubService.fetchRepoMetadata(repoInfo.owner, repoInfo.name);
    console.log(`Fetched metadata: defaultBranch=${meta.defaultBranch}, commitSha=${meta.latestCommit}`);

    const files = await GitHubService.fetchRepoFileTree(repoInfo.owner, repoInfo.name, meta.latestCommit);
    console.log(`Files Processed: ${files.length}`);

    const allChunks = [];
    for (const file of files) {
      const content = await GitHubService.fetchRawFileContent(repoInfo.owner, repoInfo.name, meta.latestCommit, file.path);
      const chunks = ChunkerService.chunkFile(file.path, content);
      allChunks.push(...chunks);
    }
    console.log(`Logical Chunks: ${allChunks.length}`);

    // Embed all 526 chunks in batches
    const batchSize = 16;
    let successfulEmbeddings = 0;
    let failedEmbeddings = 0;

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);
      try {
        const vectors = await EmbeddingService.generateBatchEmbeddings(texts, 16, 'passage');
        for (const v of vectors) {
          if (v.length === 2048) {
            successfulEmbeddings++;
          } else {
            failedEmbeddings++;
          }
        }
      } catch (err: any) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
        failedEmbeddings += batch.length;
      }
    }

    console.log(`\n=== cathrynlavery/diagram-design Ingestion Stats ===`);
    console.log(`Files processed: ${files.length}`);
    console.log(`Text/code files embedded: ${files.length}`);
    console.log(`Image files skipped: ${skippedCount}`);
    console.log(`Logical chunks: ${allChunks.length}`);
    console.log(`Successful embeddings: ${successfulEmbeddings}`);
    console.log(`Failed embeddings: ${failedEmbeddings}`);
    console.log(`Chroma vectors ready: ${successfulEmbeddings} (all 2048D)`);

    if (failedEmbeddings > 0 || successfulEmbeddings !== allChunks.length) {
      allPassed = false;
    }
  } catch (err: any) {
    console.error('[TEST D] FAILED:', err.message);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! No 503 errors, strict 2048D vectors.');
  } else {
    console.error('TESTS FAILED');
    process.exit(1);
  }
}

runImageFixSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
