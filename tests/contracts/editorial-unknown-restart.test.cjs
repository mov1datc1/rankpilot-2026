require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const submission={id:'case',userId:'owner',chambersData:{matters:[]},matters:[]};
let last,mutations=0;
const tx={$queryRaw:async strings=>String(strings).includes('EditorialJob')?[last]:[],submission:{findUnique:async()=>submission,update:async()=>{mutations++;}},$executeRaw:async()=>{mutations++;}};
const db={$transaction:async fn=>fn(tx)};
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return load.call(this,name,...args);};
const {enqueue}=require('../../src/lib/editorial/jobs.ts');
Module._load=load;
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
test('manual retry cannot buy a duplicate call for an unknown same-source outcome after the lease expires',async()=>{
 last={id:'unknown',status:'indeterminate',sourceHash:stableHash(sourceSnapshot(submission)),updatedAt:new Date(Date.now()-86400000),ledger:[],issue:{code:'AI_REVIEW_UNAVAILABLE'}};
 await assert.rejects(enqueue(submission,true),/PROVIDER_OUTCOME_UNKNOWN/);
 assert.equal(mutations,0);
 assert.equal(await enqueue(submission,false),last);
});
