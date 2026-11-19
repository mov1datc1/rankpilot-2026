require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {recoveryPlan,hasUnknownProviderUsage,CREDIT_RECHECK_MS,CREDIT_RECHECKS}=require('../../src/lib/editorial/recovery.ts');

// v1.0.105 (DeForest 19-11 15:50): HTTP 429 insufficient_quota bills nothing; the case resumes when credit returns.
const rejected={stage:'development',cursor:1,issue:{code:'AI_CREDIT_EXHAUSTED'},trace:{role:'repair',usage:{input_tokens:0,output_tokens:0,total_tokens:0},usage_status:'rejected_unbilled'}};
const job=(n)=>({stage:'development',cursor:1,issue:{code:'AI_CREDIT_EXHAUSTED',owner:'rankpilot',retryable:true},ledger:Array.from({length:n},()=>rejected)});

test('a billing rejection is a known, unbilled outcome that is rechecked every 15 minutes',()=>{
 assert.equal(hasUnknownProviderUsage(job(1).ledger),false);
 const plan=recoveryPlan(job(1),'AI_CREDIT_EXHAUSTED','build',1000);
 assert.ok(plan);assert.equal(plan.retryAt.getTime(),1000+CREDIT_RECHECK_MS);assert.equal(CREDIT_RECHECK_MS,15*60*1000);
 assert.ok(recoveryPlan(job(CREDIT_RECHECKS),'AI_CREDIT_EXHAUSTED','build'));
});
test('rechecks stop after 12 hours and an unknown outcome is still never retried',()=>{
 assert.equal(CREDIT_RECHECKS*CREDIT_RECHECK_MS,12*3600*1000);
 assert.equal(recoveryPlan(job(CREDIT_RECHECKS+1),'AI_CREDIT_EXHAUSTED','build'),null);
 const unknown={...job(1),ledger:[{stage:'development',trace:{usage:{unknown_calls:1},usage_status:'unknown'}}]};
 assert.equal(recoveryPlan(unknown,'AI_CREDIT_EXHAUSTED','build'),null);
 assert.equal(recoveryPlan({...job(0),issue:{code:'AI_REVIEW_UNAVAILABLE',owner:'rankpilot'}},'AI_REVIEW_UNAVAILABLE','build'),null);
});
