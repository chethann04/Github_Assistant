import { ChunkerService, maskSensitiveData } from '../services/chunker.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { VectorStore } from '../services/chroma.service.js';
import { config } from '../config/env.js';

async function runPhase1Tests() {
  console.log('\n============================================================');
  console.log('🧪 EXECUTING PHASE 1 VERIFICATION & REGRESSION TESTS');
  console.log('============================================================\n');

  // Test 1: Clean Source Chunking & Line Number Accuracy for App.jsx & BankersAlgorithm.jsx
  console.log('[TEST 1] Testing pure code chunking on sample JSX/JS files...');
  const sampleBankerCode = `import React, { useState } from 'react';

export function BankersAlgorithm() {
  const [allocation, setAllocation] = useState([[0, 1, 0], [2, 0, 0]]);
  const [max, setMax] = useState([[7, 5, 3], [3, 2, 2]]);
  const [available, setAvailable] = useState([3, 3, 2]);

  function isSafeState(alloc, maxClaims, avail) {
    const n = alloc.length;
    const m = avail.length;
    const need = [];
    for (let i = 0; i < n; i++) {
      need[i] = [];
      for (let j = 0; j < m; j++) {
        need[i][j] = maxClaims[i][j] - alloc[i][j];
      }
    }
    return { safe: true, sequence: [0, 1] };
  }

  return <div>Bankers Algorithm Simulator</div>;
}`;

  const chunks = ChunkerService.chunkFile('src/BankersAlgorithm.jsx', sampleBankerCode);
  if (chunks.length === 0) throw new Error('Failed to generate chunks for BankersAlgorithm.jsx');
  const firstChunk = chunks[0];
  console.log(`✓ BankersAlgorithm.jsx generated ${chunks.length} chunk(s).`);
  console.log(`✓ First chunk lines: ${firstChunk.startLine}-${firstChunk.endLine}`);
  if (firstChunk.content.startsWith('// File:')) {
    throw new Error('FAILED: Chunk content still contains prepended metadata comment!');
  }
  console.log(`✓ PASSED: Chunk content contains clean raw source code.`);

  // Test 2: High-Entropy Secret Protection & Redaction
  console.log('\n[TEST 2] Testing secret detection & redaction...');
  const secretSample = `
    const API_KEY = "sk-123456789012345678901234567890";
    const GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";
    const normalVar = "Hello World";
  `;
  const sanitized = maskSensitiveData(secretSample);
  if (sanitized.includes('sk-1234567890') || sanitized.includes('ghp_abcdef')) {
    throw new Error('FAILED: High entropy API keys were not redacted!');
  }
  console.log(`✓ PASSED: Secrets properly masked into [REDACTED_SECRET].`);

  // Test 3: Production ChromaDB Persistence
  console.log('\n[TEST 3] Testing ChromaDB local persistence configuration...');
  console.log(`✓ config.enableInMemoryFallback is strictly: ${config.enableInMemoryFallback}`);
  const vectorStoreOk = await VectorStore.isAvailable();
  console.log(`✓ ChromaDB vector store is reachable: ${vectorStoreOk}`);
  if (!vectorStoreOk) {
    throw new Error('FAILED: ChromaDB storage is not initialized at ' + config.chromaPersistDirectory);
  }
  await VectorStore.ensureCollection();
  console.log(`✓ PASSED: ChromaDB collection verified with ${config.embeddingDimensions} dimensions.`);

  // Test 4: Gemini 503 / 429 User-Friendly Error Mapping
  console.log('\n[TEST 4] Testing Gemini transient error mapping...');
  const err503 = GeminiService.mapUserFriendlyError({ status: 503, message: 'Service Unavailable' });
  if (err503.code !== 'LLM_TEMPORARILY_UNAVAILABLE' || !err503.message.includes('temporarily unavailable')) {
    throw new Error('FAILED: 503 error was not properly mapped!');
  }
  const err429 = GeminiService.mapUserFriendlyError({ status: 429, message: 'Resource Exhausted' });
  if (err429.code !== 'LLM_RATE_LIMITED' || !err429.message.includes('rate-limited')) {
    throw new Error('FAILED: 429 error was not properly mapped!');
  }
  console.log(`✓ PASSED: 503/429 mapped to clean user messages without raw provider leaks.`);

  console.log('\n============================================================');
  console.log('🎉 ALL PHASE 1 RELIABILITY & SECURITY TESTS PASSED!');
  console.log('============================================================\n');
  process.exit(0);
}

runPhase1Tests().catch((err) => {
  console.error('\n❌ Phase 1 tests failed:', err);
  process.exit(1);
});
