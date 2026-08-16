async function run() {
  console.log('1. Fetching repositories...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Testing Dependency Graph for: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Requesting Full Dependency Graph via /api/v1/intelligence/:id/dependency-graph...');
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/dependency-graph`);

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Dependency Graph generated in ${elapsed}s:`);
  console.log(`   Total Code Nodes:         ${data.nodes.length}`);
  console.log(`   Total Inter-file Edges:   ${data.edges.length}`);
  console.log(`   Detected External PKGs:   ${data.summary.externalPackages.length}`);
  console.log('\nTop 5 Most Imported Files (Central Hubs):');
  data.summary.mostImportedFiles.slice(0, 5).forEach((f, idx) => {
    console.log(`   ${idx + 1}. ${f.filePath} (imported by ${f.count} files)`);
  });

  console.log('\n3. Requesting Specific File Dependency Details via /api/v1/intelligence/:id/dependency-details...');
  const testFile = 'apps/backend/src/routes/repos.ts';
  const detailRes = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/dependency-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: testFile }),
  });

  if (!detailRes.ok) {
    console.error(`[FAIL] Detail endpoint failed with ${detailRes.status}`);
    process.exit(1);
  }

  const details = await detailRes.json();
  console.log(`[PASS] Dependency Breakdown for "${testFile}":`);
  console.log(`   Outward Imports (Files this imports):   ${details.imports.length}`);
  details.imports.forEach(i => console.log(`     -> ${i.filePath} (spec: ${i.specifier})`));
  console.log(`   Inward Dependents (Files that import this): ${details.importedBy.length}`);
  details.importedBy.forEach(i => console.log(`     <- ${i.filePath} (spec: ${i.specifier})`));

  console.log('\n=============================================');
  console.log('✅ PHASE 7 DEPENDENCY GRAPH VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
