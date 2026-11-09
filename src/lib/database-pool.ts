/** Runtime pooling only: migration and CLI connection settings stay separate. */
export function databasePoolOptions(env: NodeJS.ProcessEnv) {
  const serverless = env.VERCEL === '1';
  let connectionString = env.DATABASE_URL;
  if (serverless && connectionString) {
    const url = new URL(connectionString);
    // Supavisor session mode reserves one backend per warm function connection.
    // Preserve the configured host, identity, database, SSL and other options.
    if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432') {
      url.port = '6543';
      connectionString = url.toString();
    }
  }
  return {
    connectionString,
    max: serverless ? 1 : 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: serverless ? 10000 : 20000,
    keepAlive: true,
  };
}
