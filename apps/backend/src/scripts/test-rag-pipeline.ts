import prisma from '../config/prisma.js';
import { RAGService } from '../services/rag.service.js';
import { LLMService } from '../services/llm.service.js';
import { ProviderHealthManager } from '../ai/provider-health.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('=============================================================================');
  console.log('🧪 RAG RETRIEVAL & GROUNDED CHAT TEST SUITE');
  console.log('=============================================================================\n');

  const testRepoId = '60159988-abad-4104-83f9-f09d93fcd141';
  const repo = await prisma.repository.findUnique({ where: { id: testRepoId } });

  assert(Boolean(repo), 'Repository 60159988-abad-4104-83f9-f09d93fcd141 exists in database');

  // -----------------------------------------------------------------
  // TEST 1: Broad Overview Question Retrieval
  // -----------------------------------------------------------------
  console.log('\n--- TEST 1: Broad Overview & Motivation Query ---');
  const query1 = 'brief me about this project and its motivation towards the users';
  const result1 = await RAGService.retrieveContext(query1, testRepoId, 8);

  assert(result1.citations.length > 0, 'TEST 1: Retrieval returned non-zero citations', `Count: ${result1.citations.length}`);
  assert(result1.contextText.length > 500, 'TEST 1: Context text is rich (> 500 chars)', `Length: ${result1.contextText.length}`);
  assert(result1.citations.some((c) => c.filePath.toLowerCase().includes('readme')), 'TEST 1: README.md is included in top citations');

  // -----------------------------------------------------------------
  // TEST 2: Code Specific Question Retrieval
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Code Specific Architecture / Service Query ---');
  const query2 = 'how is the RAG context retrieval and vector store implemented?';
  const result2 = await RAGService.retrieveContext(query2, testRepoId, 8);

  assert(result2.citations.length > 0, 'TEST 2: Retrieval returned code citations', `Count: ${result2.citations.length}`);
  assert(result2.citations.some((c) => c.filePath.includes('rag.service') || c.filePath.includes('chroma')), 'TEST 2: rag.service or chroma.service was matched');

  // -----------------------------------------------------------------
  // TEST 3: System Prompt Construction
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: System Prompt Non-Empty Grounding ---');
  const prompt1 = RAGService.buildSystemPrompt(repo, 'repo', result1.contextText);
  assert(!prompt1.includes('The provided repository data is empty'), 'TEST 3: System prompt does NOT say repository is empty');
  assert(prompt1.includes('REPOSITORY SOURCE 1'), 'TEST 3: System prompt contains formatted repository sources');
  assert(prompt1.includes(repo?.name || 'Github_Assistant'), 'TEST 3: System prompt includes repository name');

  // -----------------------------------------------------------------
  // TEST 4: End-to-End LLM Generation with Fallback
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Grounded Response Generation via Provider Pipeline ---');
  let fullResponse = '';
  for await (const token of LLMService.streamChat({
    systemPrompt: prompt1,
    userMessage: query1,
    provider: 'auto',
  })) {
    fullResponse += token;
  }

  console.log(`\nGenerated Response Preview (first 250 chars):\n${fullResponse.substring(0, 250)}...\n`);
  assert(fullResponse.length > 100, 'TEST 4: LLM generated a substantial answer', `Length: ${fullResponse.length}`);
  assert(!fullResponse.toLowerCase().includes('no information available about the project'), 'TEST 4: AI did NOT claim information is missing');

  console.log('\n=============================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('=============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
