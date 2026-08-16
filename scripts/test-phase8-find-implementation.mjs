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
  console.log(`[INFO] Testing Find Implementation on: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  const concept = 'Authentication & Session Middleware';
  console.log(`\n2. Searching for concept: "${concept}" via /api/v1/chat/:repoId/search...`);
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/chat/${targetRepo.id}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
    body: JSON.stringify({ query: concept, limit: 5 }),
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const locations = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Found ${locations.length} implementation locations in ${elapsed}s:`);

  if (!Array.isArray(locations) || locations.length === 0) {
    console.error('[FAIL] Expected non-empty array of locations.');
    process.exit(1);
  }

  locations.forEach((loc, idx) => {
    console.log(`\n📍 Location #${idx + 1}:`);
    console.log(`   File:       ${loc.filePath}`);
    console.log(`   Lines:      ${loc.startLine}–${loc.endLine}`);
    console.log(`   Match:      ${loc.score !== undefined ? (loc.score * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`   Snippet:    ${loc.snippet ? loc.snippet.slice(0, 100).replace(/\n/g, ' ') : 'N/A'}...`);
  });

  console.log('\n=============================================');
  console.log('✅ PHASE 8 FIND IMPLEMENTATION VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
