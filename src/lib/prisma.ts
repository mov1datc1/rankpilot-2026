import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`

const pool = new Pool({
  connectionString,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
})
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

export default prisma
