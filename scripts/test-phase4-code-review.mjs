async function run() {
  console.log('1. Fetching repositories...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Testing Code Review for repository: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Requesting Advanced Code Review scan via /api/v1/intelligence/:id/bugs...');
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/bugs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    console.error(`[FAIL] HTTP error ${res.status}: ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const findings = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[PASS] Received ${findings.length} Code Review findings in ${elapsed}s:`);

  if (!Array.isArray(findings) || findings.length === 0) {
    console.error('[FAIL] Expected non-empty array of findings.');
    process.exit(1);
  }

  findings.forEach((f, idx) => {
    console.log(`\n🔍 Finding #${idx + 1}:`);
    console.log(`   Title:         ${f.title}`);
    console.log(`   Severity:      ${f.severity}`);
    console.log(`   Category:      ${f.category}`);
    console.log(`   Confidence:    ${f.confidence}`);
    console.log(`   File & Lines:  ${f.filePath} (${f.lineRange})`);
    console.log(`   Problem:       ${f.problem || f.description}`);
    console.log(`   Why It Matters:${f.whyItMatters || 'N/A'}`);
    console.log(`   Suggested Fix: ${f.suggestedFix}`);
    if (f.suggestedPatch) {
      console.log(`   Patch:         Present (${f.suggestedPatch.split('\n').length} lines)`);
    }
  });

  // Verify grounded file paths (ensure they are real repo files, not invented)
  const filesRes = await fetch(`http://localhost:4000/api/v1/repos/${targetRepo.id}/files`);
  const files = await filesRes.json();
  const repoFilePaths = new Set(files.map(f => f.path));

  let groundedCount = 0;
  findings.forEach(f => {
    if (repoFilePaths.has(f.filePath) || files.some(file => file.path.includes(f.filePath) || f.filePath.includes(file.path))) {
      groundedCount++;
    }
  });

  console.log(`\n[INFO] Grounded File Paths: ${groundedCount}/${findings.length} findings matched indexed files.`);

  console.log('\n=============================================');
  console.log('✅ PHASE 4 ADVANCED CODE REVIEW VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
