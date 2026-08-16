import { GitHubService } from '../services/github.service.js';
import { ChunkerService } from '../services/chunker.service.js';
import { EmbeddingService } from '../services/embedding.service.js';

async function testCathryn() {
  console.log('Testing cathrynlavery/diagram-design...');
  const repoInfo = GitHubService.parseRepoUrl('https://github.com/cathrynlavery/diagram-design');
  const details = await GitHubService.fetchRepoMetadata(repoInfo.owner, repoInfo.name);
  console.log(`Fetched details: commit=${details.latestCommit}`);

  const files = await GitHubService.fetchRepoFileTree(repoInfo.owner, repoInfo.name, details.latestCommit);
  console.log(`Found ${files.length} processable files`);

  const allChunks = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const content = await GitHubService.fetchRawFileContent(repoInfo.owner, repoInfo.name, details.latestCommit, f.path);
      const chunks = ChunkerService.chunkFile(f.path, content);
      allChunks.push(...chunks);
    } catch (e: any) {
      console.warn(`Skipped ${f.path}: ${e.message}`);
    }
  }
  console.log(`Created ${allChunks.length} chunks`);

  const batchSize = 16;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);
    try {
      await EmbeddingService.generateBatchEmbeddings(texts, 16, 'passage');
      process.stdout.write(`.` );
    } catch (e: any) {
      console.error(`\nFAILED on batch starting at chunk ${i}:`, e.message);
      for (let j = 0; j < batch.length; j++) {
        try {
          await EmbeddingService.generateEmbedding(batch[j].content, 'passage');
        } catch (singleErr: any) {
          console.error(`\n---> EXACT FAILING CHUNK ${i + j}:`);
          console.error(`File: ${batch[j].filePath} (lines ${batch[j].startLine}-${batch[j].endLine})`);
          console.error(`Error: ${singleErr.message}`);
          console.error(`Content:\n${batch[j].content}`);
        }
      }
      break;
    }
  }
  console.log('\nDone testing.');
}

testCathryn().catch((err) => {
  console.error('Fatal:', err);
});
