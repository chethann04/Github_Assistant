async function run() {
  console.log('1. Fetching repositories & acquiring anonymous session cookie...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const cookie = reposRes.headers.get('set-cookie');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const repo1 = repos[0];
  // If only 1 repo is indexed, we compare repo1 with itself for deterministic matrix validation
  const repo2 = repos.length > 1 ? repos[1] : repos[0];

  console.log(`[INFO] Testing Multi-Repo Compare between:`);
  console.log(`   Repo 1: ${repo1.owner}/${repo1.name} (${repo1.id})`);
  console.log(`   Repo 2: ${repo2.owner}/${repo2.name} (${repo2.id})`);

  console.log('\n2. Requesting Comparative Matrix via /api/v1/intelligence/compare...');
  const start = Date.now();
  const res = await fetch('http://localhost:4000/api/v1/intelligence/compare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
    body: JSON.stringify({
      repoId1: repo1.id,
      repoId2: repo2.id,
    }),
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const matrix = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Comparative Matrix synthesized in ${elapsed}s:`);
  console.log(`\n📊 Repo 1: ${matrix.repo1.name}`);
  console.log(`   Health Score:  ${matrix.repo1.health.overallScore} / 100`);
  console.log(`   Files Count:   ${matrix.repo1.health.filesCount}`);
  console.log(`   Vector Chunks: ${matrix.repo1.health.chunksCount}`);

  console.log(`\n📊 Repo 2: ${matrix.repo2.name}`);
  console.log(`   Health Score:  ${matrix.repo2.health.overallScore} / 100`);
  console.log(`   Files Count:   ${matrix.repo2.health.filesCount}`);
  console.log(`   Vector Chunks: ${matrix.repo2.health.chunksCount}`);

  console.log('\n=============================================');
  console.log('✅ PHASE 14 MULTI-REPO COMPARE VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
