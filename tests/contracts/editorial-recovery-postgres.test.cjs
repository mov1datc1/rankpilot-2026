require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');

test('PostgreSQL microsecond jobs recover once; newer jobs and changed sources prevent recovery', {skip:!process.env.EDITORIAL_POSTGRES_TEST_URL}, async()=>{
 const {Client}=require('pg');const client=new Client({connectionString:process.env.EDITORIAL_POSTGRES_TEST_URL});
 await client.connect();
 const submission={id:'recovery-synthetic',userId:'synthetic-owner',matters:[],chambersData:{matters:[]}};
 const query=async(strings,...values)=>(await client.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,''),values)).rows;
 const execute=async(strings,...values)=>(await client.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,''),values)).rowCount;
 const db={$queryRaw:query,$executeRaw:execute,submission:{findUnique:async()=>structuredClone(submission),update:async({data})=>{Object.assign(submission,data);return structuredClone(submission);}}};
 db.$transaction=async fn=>{await client.query('BEGIN');try{const r=await fn(db);await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}};
 const load=Module._load;
 Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return load.call(this,name,...args);};
 try {
  const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
  const {recoverStoppedJobs}=require('../../src/lib/editorial/runner.ts');
  // Connection-local shadow tables: never read or write production submissions/jobs.
  await client.query('CREATE TEMP TABLE "Submission" (id text PRIMARY KEY)');
  await client.query('CREATE TEMP TABLE "EditorialJob" (id text PRIMARY KEY,"submissionId" text,"userId" text,"sourceHash" text,status text,issue jsonb,stage text,cursor integer,tasks jsonb,ledger jsonb,"createdAt" timestamptz,"updatedAt" timestamptz,"leaseToken" text,"leaseUntil" timestamptz)');
  await client.query('INSERT INTO "Submission" VALUES ($1)',[submission.id]);
  const sourceHash=stableHash(sourceSnapshot(submission));
  const insert=async(id,offset,status='indeterminate')=>client.query(`INSERT INTO "EditorialJob" (id,"submissionId","userId","sourceHash",status,issue,stage,cursor,ledger,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'{"owner":"rankpilot","code":"AI_REVIEW_UNAVAILABLE","retryable":true}','audit',2,'[]',date_trunc('second',now()-interval '1 hour')+interval '0.123456 seconds'+$6::interval,now()-interval '10 minutes')`,[id,submission.id,submission.userId,sourceHash,status,offset]);
  await insert('old','0 seconds');
  const before=(await client.query('SELECT "createdAt" FROM "EditorialJob" WHERE id=$1',['old'])).rows[0];
  assert.equal((await client.query('SELECT "createdAt">$1 AS lost_precision FROM "EditorialJob" WHERE id=$2',[before.createdAt,'old'])).rows[0].lost_precision,true);
  await recoverStoppedJobs();
  assert.equal((await client.query('SELECT status FROM "EditorialJob" WHERE id=$1',['old'])).rows[0].status,'queued');
  await recoverStoppedJobs();assert.equal((await client.query('SELECT count(*)::int AS n FROM "EditorialJob"')).rows[0].n,1);
  await client.query('UPDATE "EditorialJob" SET status=\'indeterminate\',"updatedAt"=now()-interval \'10 minutes\'');
  await insert('newer','1 second','completed');await recoverStoppedJobs();
  assert.equal((await client.query('SELECT status FROM "EditorialJob" WHERE id=$1',['old'])).rows[0].status,'indeterminate');
  await client.query('DELETE FROM "EditorialJob" WHERE id=$1',['newer']);
  submission.chambersData.firm_name='Changed source';await recoverStoppedJobs();
  assert.equal((await client.query('SELECT status FROM "EditorialJob" WHERE id=$1',['old'])).rows[0].status,'indeterminate');
  delete submission.chambersData.firm_name;
  const diagnostic={acceptance:[{criterion:'source_fidelity',status:'failed'}],defects:[{code:'EDITORIAL_OMISSION',severity:'critical',owner:'rankpilot',message:'La aceptación editorial no está completa: source_fidelity',source_quote:'',artifact_quote:''}]};
  submission.chambersData.final_artifact_review={judge:diagnostic};
  submission.chambersData.completed_review_input_hash='cached-invalid-review';
  await client.query(`UPDATE "EditorialJob" SET status='needs_review',issue=NULL,stage='artifact',cursor=4,tasks='["selection","development","audit","artifact"]',ledger='[{"stage":"artifact","cursor":3,"trace":{"usage":{"total_tokens":123}}}]',"updatedAt"=now()-interval '10 minutes' WHERE id='old'`);
  await recoverStoppedJobs();
  const recovered=(await client.query(`SELECT * FROM "EditorialJob" WHERE id='old'`)).rows[0];
  assert.equal(recovered.status,'queued');assert.equal(recovered.cursor,3);
  assert.equal(recovered.ledger.length,2);assert.equal(recovered.ledger[0].trace.usage.total_tokens,123);
  assert.equal(recovered.ledger[1].diagnostic_recovery,true);assert.equal(recovered.issue.code,'AI_REVIEW_INVALID');
  assert.equal(submission.chambersData.completed_review_input_hash,null);
  await recoverStoppedJobs();
  assert.equal((await client.query(`SELECT jsonb_array_length(ledger) AS n FROM "EditorialJob" WHERE id='old'`)).rows[0].n,2);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM "EditorialJob"')).rows[0].n,1);
  for(const extra of [{artifact_quote:'A concrete unsupported assertion'},{owner:'user'}]) {
   submission.chambersData.final_artifact_review={judge:{...diagnostic,defects:[{...diagnostic.defects[0],...extra}]}};
   submission.chambersData.completed_review_input_hash='preserve-concrete-review';
   await client.query(`UPDATE "EditorialJob" SET status='needs_review',cursor=4,"updatedAt"=now()-interval '10 minutes' WHERE id='old'`);
   await recoverStoppedJobs();
   assert.equal((await client.query(`SELECT status FROM "EditorialJob" WHERE id='old'`)).rows[0].status,'needs_review');
   assert.equal(submission.chambersData.completed_review_input_hash,'preserve-concrete-review');
  }
 } finally {Module._load=load;await client.end();}
});
