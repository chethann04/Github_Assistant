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
  console.log(`[INFO] Testing Health Dashboard for: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Requesting Health Assessment via /api/v1/intelligence/:id/health...');
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/health`, {
    headers: {
      ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {}),
    },
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const health = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Health Assessment computed in ${elapsed}s:`);
  console.log(`   Overall Health Score:     ${health.overallScore} / 100`);
  console.log(`   Total Indexed Files:      ${health.filesCount}`);
  console.log(`   Total Vector Chunks:      ${health.chunksCount}`);
  console.log(`   Architecture Status:      ${health.architectureStatus}`);
  console.log(`   Documentation Status:     ${health.docStatus}`);
  console.log(`   Security Summary:         ${health.securitySummary?.high} High · ${health.securitySummary?.medium} Medium`);
  console.log(`   Code Review Findings:     ${health.codeReviewSummary?.totalFindings} Findings`);

  console.log('\nLanguage Distribution:');
  health.languages?.forEach(l => console.log(`   - ${l.name}: ${l.percentage}% (${l.count} files)`));

  console.log('\nHealth Categories:');
  health.categories?.forEach(c => console.log(`   - ${c.name}: ${c.score}/100 (Weight: ${c.weight * 100}%)`));

  console.log('\nPotential Warnings:');
  health.potentialProblems?.forEach(p => console.log(`   ⚠️ ${p}`));

  console.log('\n=============================================');
  console.log('✅ PHASE 9 REPOSITORY HEALTH DASHBOARD VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
