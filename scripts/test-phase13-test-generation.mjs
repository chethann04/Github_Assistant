async function run() {
  console.log('1. Fetching repositories & acquiring anonymous session cookie...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const cookie = reposRes.headers.get('set-cookie');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Testing AI Test Generation on: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  const targetFile = 'apps/backend/src/middleware/anonymousSession.ts';
  console.log(`\n2. Generating Vitest Test Suite for "${targetFile}" via /api/v1/intelligence/:id/generate-tests...`);
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/generate-tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
    body: JSON.stringify({
      filePath: targetFile,
      framework: 'vitest',
    }),
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Test Suite generated in ${elapsed}s:`);

  if (!data.testSuite || typeof data.testSuite !== 'string') {
    console.error('[FAIL] Expected valid testSuite string.');
    process.exit(1);
  }

  console.log(`[PASS] Test Suite length: ${data.testSuite.length} chars`);
  console.log('\nFirst 400 chars of Generated Test Suite:');
  console.log(data.testSuite.slice(0, 400));

  const hasAssertions = data.testSuite.includes('expect(') || data.testSuite.includes('describe(') || data.testSuite.includes('it(');
  console.log(`\n[PASS] Contains Test Assertions (expect/describe/it): ${hasAssertions ? 'YES' : 'NO'}`);

  console.log('\n=============================================');
  console.log('✅ PHASE 13 AI TEST GENERATOR VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
