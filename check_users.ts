import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.smeshjwepztrfnhncnxl:bs%40LMPAK3%40sqyg%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres"
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const res = await client.query('SELECT id, email FROM "User"');
    console.log('Users in public.User:', res.rows);
    
    // Check auth.users too if possible
    const authRes = await client.query('SELECT id, email FROM auth.users');
    console.log('Users in auth.users:', authRes.rows);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

main();
