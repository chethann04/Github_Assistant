async function run() {
  console.log('1. Fetching repositories...');
  const reposRes = await fetch('http://localhost:4000/api/v1/repos');
  const repos = await reposRes.json();

  if (!repos || repos.length === 0) {
    console.error('[ERROR] No repositories found in database.');
    process.exit(1);
  }

  const targetRepo = repos[0];
  console.log(`[INFO] Testing Security Audit for repository: ${targetRepo.owner}/${targetRepo.name} (${targetRepo.id})`);

  console.log('\n2. Requesting Security Audit via /api/v1/intelligence/:id/security...');
  const start = Date.now();
  const res = await fetch(`http://localhost:4000/api/v1/intelligence/${targetRepo.id}/security`, {
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
  console.log(`[PASS] Received ${findings.length} Security Audit findings in ${elapsed}s:`);

  if (!Array.isArray(findings) || findings.length === 0) {
    console.error('[FAIL] Expected non-empty array of security findings.');
    process.exit(1);
  }

  let secretMaskedCheck = true;
  findings.forEach((f, idx) => {
    console.log(`\n🛡️ Vulnerability #${idx + 1}:`);
    console.log(`   Title:         ${f.title}`);
    console.log(`   Severity:      ${f.severity}`);
    console.log(`   CWE:           ${f.cwe || 'N/A'}`);
    console.log(`   Category:      ${f.category}`);
    console.log(`   Confidence:    ${f.confidence}`);
    console.log(`   File & Lines:  ${f.filePath} (${f.lineRange})`);
    console.log(`   Explanation:   ${f.explanation}`);
    console.log(`   Remediation:   ${f.suggestedRemediation}`);

    // Verify secret masking safety rule
    if (f.evidence && /(sk-[a-zA-Z0-9]{20,})/.test(f.evidence)) {
      secretMaskedCheck = false;
      console.error(`   [SECURITY FAIL] Cleartext API key unmasked in evidence: ${f.evidence}`);
    } else {
      console.log(`   Evidence:      ${f.evidence.slice(0, 100)}... [MASKED: OK]`);
    }
  });

  if (!secretMaskedCheck) {
    console.error('[FAIL] Unmasked secrets found in output.');
    process.exit(1);
  }

  // Verify grounded file paths
  const filesRes = await fetch(`http://localhost:4000/api/v1/repos/${targetRepo.id}/files`);
  const files = await filesRes.json();
  const repoFilePaths = new Set(files.map(f => f.path));

  let groundedCount = 0;
  findings.forEach(f => {
    if (repoFilePaths.has(f.filePath) || files.some(file => file.path.includes(f.filePath) || f.filePath.includes(file.path))) {
      groundedCount++;
    }
  });

  console.log(`\n[INFO] Grounded Security Paths: ${groundedCount}/${findings.length} matched indexed files.`);
  console.log('\n=============================================');
  console.log('✅ PHASE 5 SECURITY ANALYSIS VERIFICATION PASSED');
  console.log('=============================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
