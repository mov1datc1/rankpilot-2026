require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const submission={id:'case',userId:'owner',chambersData:{matters:[]},matters:[]};
let last,mutations=0;
const tx={$queryRaw:async strings=>String(strings).includes('EditorialJob')?[last]:[],submission:{findUnique:async()=>submission,update:async()=>{mutations++;}},$executeRaw:async()=>{mutations++;}};
const db={$transaction:async fn=>fn(tx)};
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return load.call(this,name,...args);};
const {enqueue}=require('../../src/lib/editorial/jobs.ts');
Module._load=load;
test('an explicit retry or newer build cannot reset a rejected selection allowance',async()=>{
 last={id:'rejected',status:'failed',stage:'selection',sourceHash:stableHash(sourceSnapshot(submission)),ledger:[{trace:{usage:{total_tokens:123}}}],issue:{code:'SELECTION_REJECTED'}};
 const before=structuredClone(last);
 for(const retry of [false,true]) assert.equal(await enqueue(submission,retry),last);
 assert.equal(mutations,0);assert.deepEqual(last,before);
});
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
test('manual retry cannot reset a failed development, grounding or exhausted budget',async()=>{
 for(const code of ['DEVELOPMENT_REJECTED','GROUNDING_REJECTED','TOKEN_BUDGET','AI_OUTPUT_LIMIT','SELECTION_DIAGNOSTIC_INVALID']) {
  last={id:'failed',status:'failed',sourceHash:stableHash(sourceSnapshot(submission)),stage:'development',ledger:[{trace:{usage:{total_tokens:123}}}],issue:{code,owner:'rankpilot'}};
  const before=structuredClone(last);
  for(const retry of [false,true]) assert.equal(await enqueue(submission,retry),last);
  assert.deepEqual(last,before);assert.equal(mutations,0);
 }
});
test('manual retry cannot buy a duplicate call for an unknown same-source outcome after the lease expires',async()=>{
 last={id:'unknown',status:'indeterminate',sourceHash:stableHash(sourceSnapshot(submission)),updatedAt:new Date(Date.now()-86400000),ledger:[],issue:{code:'AI_REVIEW_UNAVAILABLE'}};
 await assert.rejects(enqueue(submission,true),/PROVIDER_OUTCOME_UNKNOWN/);
 assert.equal(mutations,0);
 assert.equal(await enqueue(submission,false),last);
});
test('a lost browser start response returns the same active job on another click',async()=>{
 for(const status of ['queued','running']) {
  last={id:'already-started',status,sourceHash:stableHash(sourceSnapshot(submission)),ledger:[]};
  assert.equal(await enqueue(submission,true),last);
  assert.equal(mutations,0);
 }
});
test('unknown usage cannot obtain a fresh budget through failed status or manual retry',async()=>{
 for(const status of ['failed','needs_review','indeterminate']) {
  last={id:'unknown-transport',status,sourceHash:stableHash(sourceSnapshot(submission)),ledger:[{trace:{usage:{total_tokens:100}}},{trace:{usage:{unknown_calls:1},usage_status:'unknown'}}]};
  await assert.rejects(enqueue(submission,true),/PROVIDER_OUTCOME_UNKNOWN/);
  assert.equal(mutations,0);
  assert.equal(last.ledger[0].trace.usage.total_tokens,100);
 }
});
