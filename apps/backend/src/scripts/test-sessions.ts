import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

// Cookie jar helper for simulating distinct browsers
function createSessionClient() {
  let cookie: string | null = null;

  const instance = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
  });

  instance.interceptors.request.use((reqConfig) => {
    if (cookie) {
      reqConfig.headers['Cookie'] = cookie;
    }
    return reqConfig;
  });

  instance.interceptors.response.use((res) => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      // Extract anonymous_session cookie
      const match = setCookie[0].match(/anonymous_session=[^;]+/);
      if (match) {
        cookie = match[0];
      }
    }
    return res;
  });

  return {
    client: instance,
    getCookie: () => cookie,
  };
}

async function runSecurityAudit() {
  console.log('\n============================================================');
  console.log('🔒 EXECUTING PRIVATE ANONYMOUS SESSIONS SECURITY AUDIT');
  console.log('============================================================\n');

  // Client 1 (Browser A)
  const sessionA = createSessionClient();
  // Client 2 (Browser B - Incognito)
  const sessionB = createSessionClient();

  // Test 1: Initialize Session A
  console.log('[TEST 1] Initializing Session A...');
  const initResA = await sessionA.client.get('/repos');
  const cookieA = sessionA.getCookie();
  console.log(`✓ Session A created with cookie: ${cookieA}`);
  console.log(`✓ Session A initial repos count: ${initResA.data.length}`);

  // Test 2: Session A imports a repository
  console.log('\n[TEST 2] Session A importing repository expressjs/cors...');
  const importResA = await sessionA.client.post('/repos/import', {
    url: 'https://github.com/expressjs/cors',
  });
  const repoA = importResA.data.repository;
  const jobAId = importResA.data.jobId;
  console.log(`✓ Session A created repository ID: ${repoA.id}`);
  console.log(`✓ Session A created index job ID: ${jobAId}`);

  // Test 3: Session A creates a chat session
  console.log('\n[TEST 3] Session A creating chat session...');
  const chatResA = await sessionA.client.post('/chat/sessions', {
    repositoryId: repoA.id,
    title: 'Secret Session A Chat',
  });
  const chatSessionAId = chatResA.data.id;
  console.log(`✓ Session A created chat session ID: ${chatSessionAId}`);

  // Test 4: Initialize Session B
  console.log('\n[TEST 4] Initializing Session B (Incognito simulation)...');
  const initResB = await sessionB.client.get('/repos');
  const cookieB = sessionB.getCookie();
  console.log(`✓ Session B created with cookie: ${cookieB}`);
  console.log(`✓ Verifying cookies are distinct: ${cookieA !== cookieB}`);

  // Test 5: Verify Session B cannot see Session A repository in list
  console.log('\n[TEST 5] Verifying Session B repository list isolation...');
  const reposB = initResB.data;
  const leakedRepo = reposB.find((r: any) => r.id === repoA.id);
  if (leakedRepo) {
    throw new Error('SECURITY VIOLATION: Session A repository leaked into Session B list!');
  }
  console.log(`✓ PASSED: Session B repo list contains ${reposB.length} repositories (0 of Session A).`);

  // Test 6: Direct-ID Attack — Session B requests Session A repository details
  console.log('\n[TEST 6] Direct-ID Attack: Session B requests GET /repos/:id for Session A repo...');
  try {
    await sessionB.client.get(`/repos/${repoA.id}`);
    throw new Error('SECURITY VIOLATION: Session B accessed Session A repository details!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found (zero information disclosure).');
    } else {
      throw err;
    }
  }

  // Test 7: Direct-ID Attack — Session B requests Session A repository files
  console.log('\n[TEST 7] Direct-ID Attack: Session B requests GET /repos/:id/files for Session A repo...');
  try {
    await sessionB.client.get(`/repos/${repoA.id}/files`);
    throw new Error('SECURITY VIOLATION: Session B accessed Session A repository file tree!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found.');
    } else {
      throw err;
    }
  }

  // Test 8: Direct-ID Attack — Session B requests Session A index job status
  console.log('\n[TEST 8] Direct-ID Attack: Session B requests GET /indexing/status/:jobId for Session A job...');
  try {
    await sessionB.client.get(`/indexing/status/${jobAId}`);
    throw new Error('SECURITY VIOLATION: Session B accessed Session A index job status!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found.');
    } else {
      throw err;
    }
  }

  // Test 9: Direct-ID Attack — Session B requests Session A chat session
  console.log('\n[TEST 9] Direct-ID Attack: Session B requests GET /chat/sessions/:sessionId for Session A chat...');
  try {
    await sessionB.client.get(`/chat/sessions/${chatSessionAId}`);
    throw new Error('SECURITY VIOLATION: Session B accessed Session A chat session messages!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found.');
    } else {
      throw err;
    }
  }

  // Test 10: Direct-ID Attack — Session B attempts semantic search on Session A repo
  console.log('\n[TEST 10] Direct-ID Attack: Session B requests POST /chat/:repoId/search for Session A repo...');
  try {
    await sessionB.client.post(`/chat/${repoA.id}/search`, { query: 'middleware' });
    throw new Error('SECURITY VIOLATION: Session B executed vector search on Session A repo!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found.');
    } else {
      throw err;
    }
  }

  // Test 11: Direct-ID Attack — Session B requests Architecture generation for Session A repo
  console.log('\n[TEST 11] Direct-ID Attack: Session B requests POST /intelligence/:repoId/architecture for Session A repo...');
  try {
    await sessionB.client.post(`/intelligence/${repoA.id}/architecture`);
    throw new Error('SECURITY VIOLATION: Session B invoked architecture generation on Session A repo!');
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('✓ PASSED: Server returned 404 Not Found.');
    } else {
      throw err;
    }
  }

  console.log('\n============================================================');
  console.log('🎉 ALL 11 SECURITY & ISOLATION TESTS PASSED WITH ZERO LEAKS!');
  console.log('============================================================\n');
}

runSecurityAudit().catch((err) => {
  console.error('\n❌ Security audit failed:', err);
  process.exit(1);
});
