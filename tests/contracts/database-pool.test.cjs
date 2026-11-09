const test = require('node:test');
const assert = require('node:assert/strict');
require('../../docs/reviews/review-loader.cjs');
const { databasePoolOptions } = require('../../src/lib/database-pool.ts');

test('Vercel uses the configured Supavisor host in transaction mode with a bounded pool', () => {
  const input = 'postgresql://app.project:encoded%40password@aws-0-test.pooler.supabase.com:5432/postgres?sslmode=verify-full&application_name=test';
  const options = databasePoolOptions({ VERCEL: '1', DATABASE_URL: input });
  const before = new URL(input), after = new URL(options.connectionString);
  assert.equal(after.port, '6543');
  after.port = before.port;
  assert.equal(after.toString(), before.toString());
  assert.equal(options.max, 1);
  assert.equal(options.connectionTimeoutMillis, 10000);
});

test('worker, migrations and unrelated database endpoints are not rewritten', () => {
  for (const input of [
    'postgresql://app:password@aws-0-test.pooler.supabase.com:6543/postgres',
    'postgresql://app:password@db.project.supabase.co:5432/postgres',
    'postgresql://app:password@localhost:5432/postgres',
    'postgresql://app:password@pooler.supabase.com.example.org:5432/postgres',
  ]) assert.equal(databasePoolOptions({ VERCEL: '1', DATABASE_URL: input }).connectionString, input);
  const input = 'postgresql://app:password@aws-0-test.pooler.supabase.com:5432/postgres';
  const worker = databasePoolOptions({ DATABASE_URL: input });
  assert.equal(worker.connectionString, input);
  assert.equal(worker.max, 3);
});

test('reloading the runtime module shares the existing client without allocating another pool', () => {
  const Module = require('node:module');
  const original = Module._load;
  const target = require.resolve('../../src/lib/prisma.ts');
  let pools = 0, clients = 0;
  const fakePool = class { constructor() { pools++; } on() {} };
  const fakeClient = class { constructor() { clients++; } };
  const saved = globalThis.rankpilotPrisma;
  delete globalThis.rankpilotPrisma;
  Module._load = function(name, ...args) {
    if (name === 'pg') return { Pool: fakePool };
    if (name === '@prisma/client') return { PrismaClient: fakeClient };
    if (name === '@prisma/adapter-pg') return { PrismaPg: class {} };
    return original.call(this, name, ...args);
  };
  try {
    delete require.cache[target]; const first = require(target).default;
    delete require.cache[target]; const second = require(target).default;
    assert.equal(first, second); assert.equal(pools, 1); assert.equal(clients, 1);
  } finally {
    Module._load = original; delete require.cache[target];
    if (saved === undefined) delete globalThis.rankpilotPrisma; else globalThis.rankpilotPrisma = saved;
  }
});
