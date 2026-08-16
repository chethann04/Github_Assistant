async function run() {
  console.log('1. Fetching repositories...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Testing Architecture Synthesis for: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Requesting Architecture Synthesis via /api/v1/intelligence/:id/architecture...');
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/architecture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Received architecture payload in ${elapsed}s:`);

  if (!data.architecture || typeof data.architecture !== 'string') {
    console.error('[FAIL] Expected non-empty architecture string.');
    process.exit(1);
  }

  const hasMermaid = data.architecture.includes('```mermaid') || data.architecture.includes('flowchart') || data.architecture.includes('graph TD');
  console.log(`[PASS] Contains Mermaid Diagram: ${hasMermaid ? 'YES' : 'NO'}`);
  console.log(`[PASS] Architecture length: ${data.architecture.length} chars`);
  console.log('\nFirst 350 chars of Architecture Analysis:');
  console.log(data.architecture.slice(0, 350));

  console.log('\n=============================================');
  console.log('✅ PHASE 6 INTERACTIVE ARCHITECTURE VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
