require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canResumeRetiredBudget}=require('../../src/lib/editorial/budget-continuation.ts');
function fixture(){return {job:{status:'failed',stage:'development',cursor:1,tasks:['selection','development','audit','artifact'],sourceHash:'source',issue:{owner:'rankpilot',code:'EDITORIAL_BUDGET_REQUIRED'},ledger:[{trace:{usage:{total_tokens:1175993}}},{trace:{provider_request_started:false}}]},data:{review_checkpoint:{state:{development:{b10:'Saved text'},repair_continuation:{pending_groups:['candidates/0']},field_review_attempts:{b10:2},trace:[{usage:{total_tokens:1175993}}]}}}};}
test('retired budget can resume the unstarted operation with all usage and methods intact',()=>{
 const f=fixture(),before=structuredClone(f);assert.equal(canResumeRetiredBudget(f.job,f.data,'source'),true);assert.deepEqual(f,before);
});
test('retired budget never replenishes recovery or repeats an unknown operation',()=>{
 for(const change of [f=>f.job.ledger.push({status:'retired_budget_continuation',trace:{provider_request_started:false}}),f=>f.job.ledger.at(-1).trace.provider_request_started=true,f=>f.job.ledger[0].trace.usage.unknown_calls=1,f=>f.data.review_checkpoint.state.trace=[{usage_status:'unknown'}],f=>f.job.status='running',f=>f.job.issue.code='DEVELOPMENT_REJECTED',f=>f.job.sourceHash='other',f=>f.job.cursor=3,f=>delete f.data.review_checkpoint]){const f=fixture();change(f);assert.equal(canResumeRetiredBudget(f.job,f.data,'source'),false);}
 process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';process.env.EDITORIAL_TOKEN_BUDGET='1200000';
 try{const f=fixture();assert.equal(canResumeRetiredBudget(f.job,f.data,'source'),false);}finally{delete process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET;delete process.env.EDITORIAL_TOKEN_BUDGET;}
});
test('enqueue resumes the same job once and preserves checkpoint, cursor and cumulative receipts',async()=>{
 const Module=require('node:module'),original=Module._load;
 const f=fixture(),submission={id:'s',userId:'u',chambersData:f.data,matters:[]};
 let current=f.job,updates=0;
 const tx={submission:{findUnique:async()=>submission},$queryRaw:async(strings,...values)=>{
   const sql=strings.join('?');
   if(sql.startsWith('UPDATE')){updates++;assert.match(sql,/"ledger"="ledger" \|\|/);assert.doesNotMatch(sql,/"cursor"=/);current={...current,status:'queued',ledger:[...current.ledger,...JSON.parse(values[0])]};return [current];}
   if(sql.includes('SELECT * FROM "EditorialJob"'))return [current];return [{id:'s'}];
 }};
 Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:{$transaction:async fn=>fn(tx)}};return original.call(this,name,...args);};
 try{
   const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
   const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');
   current={...current,id:'j',sourceHash:stableHash(sourceSnapshot(submission))};
   const before=structuredClone(submission),receipts=structuredClone(current.ledger);
   assert.equal(publicJob(current,submission).canResumeResidual,true);
   const first=await enqueue(submission,true);assert.equal(first.id,'j');assert.equal(first.cursor,1);assert.equal(first.status,'queued');
   assert.deepEqual(first.ledger.slice(0,-1),receipts);assert.deepEqual(submission,before);
   await enqueue(submission,true);assert.equal(updates,1);
 }finally{Module._load=original;}
});
