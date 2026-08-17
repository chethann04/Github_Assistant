import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnection(name, connectionString) {
  console.log(`\nTesting connection for: ${name}...`);
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 8000,
  });

  const start = Date.now();
  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as current_time, count(*) from "Repository";');
    console.log(`✅ [${name}] Connected successfully in ${Date.now() - start}ms! Repositories count:`, res.rows[0].count);
    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ [${name}] Connection failed after ${Date.now() - start}ms:`, err.message);
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  const url5432 = "postgresql://postgres.oiyavpehrmegpvyzeedz:Chethan%40github@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
  const url6543 = "postgresql://postgres.oiyavpehrmegpvyzeedz:Chethan%40github@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

  await testConnection('Port 5432 (Direct / Session Mode)', url5432);
  await testConnection('Port 6543 (Transaction Pooler)', url6543);
}

run();
