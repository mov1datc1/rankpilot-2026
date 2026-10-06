// Real PostgreSQL semantics, synthetic rows, transaction rolled back in full.
const fs=require('node:fs');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {Client}=require('pg');
require('dotenv').config({quiet:true});
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{
 await c.query('BEGIN');await c.query(fs.readFileSync('scripts/editorial/schema.sql','utf8'));
 const owner=(await c.query('SELECT id FROM "User" LIMIT 1')).rows[0]?.id;assert.ok(owner);
 const sid=randomUUID(),jid=randomUUID();
 await c.query('INSERT INTO "Submission" (id,"userId","targetDirectory","guideRegion","practiceArea","currentBand","updatedAt") VALUES ($1,$2,\'Chambers\',\'Synthetic\',\'Tax\',\'\',now())',[sid,owner]);
 await c.query('INSERT INTO "EditorialJob" (id,"submissionId","userId","sourceHash",snapshot) VALUES ($1,$2,$3,\'test\',\'{}\')',[jid,sid,owner]);
 await c.query('SAVEPOINT duplicate');
 let duplicate=false;try{await c.query('INSERT INTO "EditorialJob" (id,"submissionId","userId","sourceHash",snapshot) VALUES ($1,$2,$3,\'test\',\'{}\')',[randomUUID(),sid,owner]);}catch(e){duplicate=e.code==='23505';await c.query('ROLLBACK TO duplicate');}assert.ok(duplicate,'one active job constraint');
 const claimed=await c.query('UPDATE "EditorialJob" SET status=\'running\',"leaseToken"=\'worker-one\',"leaseUntil"=now()-interval \'1 second\' WHERE id=(SELECT id FROM "EditorialJob" WHERE id=$1 AND status=\'queued\' FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id',[jid]);assert.equal(claimed.rowCount,1);
 assert.equal((await c.query('SELECT id FROM "EditorialJob" WHERE id=$1 AND status=\'queued\'',[jid])).rowCount,0);
 await c.query('UPDATE "EditorialJob" SET status=\'indeterminate\' WHERE id=$1 AND status=\'running\' AND "leaseUntil"<now()',[jid]);
 assert.equal((await c.query('SELECT status FROM "EditorialJob" WHERE id=$1',[jid])).rows[0].status,'indeterminate');
 assert.equal((await c.query('UPDATE "EditorialJob" SET status=\'completed\' WHERE id=$1 AND status=\'running\' AND "leaseToken"=\'worker-one\'',[jid])).rowCount,0,'expired owner cannot complete queue stage');
 const rls=await c.query('SELECT relrowsecurity FROM pg_class WHERE oid=\'"EditorialJob"\'::regclass');assert.equal(rls.rows[0].relrowsecurity,true);
 console.log('PostgreSQL: active uniqueness, atomic claim, lease expiry, fencing and RLS passed; rolling back all synthetic data and DDL.');
 }finally{await c.query('ROLLBACK');await c.end();}})().catch(e=>{console.error('Queue SQL test failed:',e.code || e.name);process.exitCode=1;});
