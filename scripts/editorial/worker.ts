import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import prisma from '../../src/lib/prisma';
import { claimJob, runJobStage } from '../../src/lib/editorial/runner';
import { EDITORIAL_VERSION } from '../../src/lib/editorial/contracts';

let stopping=false;
const workerId=randomUUID();
process.on('SIGTERM',()=>{stopping=true;});
process.on('SIGINT',()=>{stopping=true;});
const heartbeat=async()=>{await prisma.$executeRaw`INSERT INTO "EditorialWorker" ("id","version","heartbeat") VALUES (${workerId},${EDITORIAL_VERSION},now()) ON CONFLICT ("id") DO UPDATE SET "heartbeat"=now()`;};
async function main() {
  await heartbeat();
  const timer=setInterval(()=>{void heartbeat().catch(()=>{});},20000);
  console.log('Editorial worker ready',EDITORIAL_VERSION);
  try {
    while(!stopping) {
      try {
        const health=await fetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/health`,{signal:AbortSignal.timeout(15000)});
        if(!health.ok || (await health.json()).version!==EDITORIAL_VERSION) {await new Promise(r=>setTimeout(r,5000));continue;}
        const job=await claimJob();
        if(job) await runJobStage(job);
        else await new Promise(r=>setTimeout(r,2000));
      } catch {console.error('Editorial queue temporarily unavailable');await new Promise(r=>setTimeout(r,5000));}
    }
  } finally {
    clearInterval(timer);
    await prisma.$executeRaw`DELETE FROM "EditorialWorker" WHERE "id"=${workerId}`;
    await prisma.$disconnect();
  }
}
main().catch(()=>{console.error('Editorial worker could not start');process.exitCode=1;});
