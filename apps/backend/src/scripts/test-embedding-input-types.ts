import { config } from '../config/env.js';
import { EmbeddingService } from '../services/embedding.service.js';

async function runTests() {
  console.log('====================================================');
  console.log('NVIDIA NIM EMBEDDING INPUT_TYPE & VLM VERIFICATION TEST');
  console.log('====================================================');
  console.log(`Model: ${config.embeddingModel}`);
  console.log(`Expected Dimensions: ${config.embeddingDimensions}`);
  console.log(`Base URL: ${config.nvidiaBaseUrl}`);
  console.log('----------------------------------------------------');

  let allPassed = true;

  // Test A: Plain text passage embedding (input_type="passage")
  console.log('\n[Test A] Testing plain text passage embedding (input_type="passage")...');
  try {
    const passageText = 'export class AuthenticationService { authenticate(user: string): boolean { return true; } }';
    const passageVector = await EmbeddingService.generateEmbedding(passageText, 'passage');
    console.log(`[Test A] PASS: Received vector with length ${passageVector.length}`);
    if (passageVector.length !== 2048) {
      throw new Error(`Dimension mismatch in Test A: expected 2048, got ${passageVector.length}`);
    }
  } catch (err: any) {
    console.error(`[Test A] FAIL:`, err.message);
    allPassed = false;
  }

  // Test B: Query embedding (input_type="query")
  console.log('\n[Test B] Testing query embedding (input_type="query")...');
  try {
    const queryText = 'Where is authentication implemented?';
    const queryVector = await EmbeddingService.generateEmbedding(queryText, 'query');
    console.log(`[Test B] PASS: Received vector with length ${queryVector.length}`);
    if (queryVector.length !== 2048) {
      throw new Error(`Dimension mismatch in Test B: expected 2048, got ${queryVector.length}`);
    }
  } catch (err: any) {
    console.error(`[Test B] FAIL:`, err.message);
    allPassed = false;
  }

  // Test C1: Document chunk containing markdown image reference
  console.log('\n[Test C1] Testing document chunk with markdown image reference (input_type="passage")...');
  try {
    const docWithImageRef = '# Project Architecture\n\n![Architecture Diagram](https://raw.githubusercontent.com/org/repo/main/assets/arch.png)\n\nThis system handles distributed caching and RAG embeddings.';
    const docVector = await EmbeddingService.generateEmbedding(docWithImageRef, 'passage');
    console.log(`[Test C1] PASS: Received vector with length ${docVector.length}`);
    if (docVector.length !== 2048) {
      throw new Error(`Dimension mismatch in Test C1: expected 2048, got ${docVector.length}`);
    }
  } catch (err: any) {
    console.error(`[Test C1] FAIL:`, err.message);
    allPassed = false;
  }

  // Test C2: Document chunk containing inline data:image/... URI (which previously caused 503 / 400 VLM error)
  console.log('\n[Test C2] Testing document chunk with inline data:image/ URI (input_type="passage")...');
  try {
    const codeWithDataUri = `
      export const defaultAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      export const svgIcon = "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24'><path d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/></svg>";
    `;
    const dataUriVector = await EmbeddingService.generateEmbedding(codeWithDataUri, 'passage');
    console.log(`[Test C2] PASS: Received vector with length ${dataUriVector.length}`);
    if (dataUriVector.length !== 2048) {
      throw new Error(`Dimension mismatch in Test C2: expected 2048, got ${dataUriVector.length}`);
    }
  } catch (err: any) {
    console.error(`[Test C2] FAIL:`, err.message);
    allPassed = false;
  }

  // Test C3: Batch Passage Embeddings with mixed chunks
  console.log('\n[Test C3] Testing batch passage embeddings (input_type="passage")...');
  try {
    const batchTexts = [
      'import { Router } from "express"; export const router = Router();',
      '# Lit Website\n![Screenshot](https://example.com/preview.jpg)\nUI Component Library',
      'const icon = "data:image/png;base64,iVBORw0KGgo=";\nexport function getIcon() { return icon; }',
      'interface UserPayload { id: string; role: string; }'
    ];
    const batchVectors = await EmbeddingService.generateBatchEmbeddings(batchTexts, 4, 'passage');
    console.log(`[Test C3] PASS: Generated ${batchVectors.length} vectors`);
    for (let i = 0; i < batchVectors.length; i++) {
      if (batchVectors[i].length !== 2048) {
        throw new Error(`Batch vector ${i} dimension mismatch: expected 2048, got ${batchVectors[i].length}`);
      }
    }
    console.log(`[Test C3] All ${batchVectors.length} vectors verified at 2048 dimensions.`);
  } catch (err: any) {
    console.error(`[Test C3] FAIL:`, err.message);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('ALL EMBEDDING INPUT_TYPE & VLM TESTS COMPLETED SUCCESSFULLY (2048-dim verified)');
  } else {
    console.error('SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
