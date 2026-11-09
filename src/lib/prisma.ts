import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { databasePoolOptions } from './database-pool'

const runtime = globalThis as unknown as { rankpilotPrisma?: PrismaClient }

function createPrisma() {
  const pool = new Pool(databasePoolOptions(process.env))
  pool.on('error', (error: Error & { code?: string }) => {
    console.error('Database idle connection failed', { code: error.code || 'CONNECTION_ERROR' })
  })
  // No statementNameGenerator: adapter-pg uses unnamed statements, compatible
  // with Supavisor transaction pooling. Transactions still pin one connection.
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

const prisma = runtime.rankpilotPrisma ?? createPrisma()
runtime.rankpilotPrisma = prisma

export default prisma
