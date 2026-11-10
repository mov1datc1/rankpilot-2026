require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {editorialTokenBudget,recoveryPlan,spentTokens}=require('../../src/lib/editorial/recovery.ts');
const {engineFetch}=require('../../src/lib/editorial/engine.ts');
const {editorialIdentity}=require('../../src/lib/editorial/identity.ts');
const {canResumeBudgetReview}=require('../../src/lib/editorial/budget-continuation.ts');
delete process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET;
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
const job={cursor:2,stage:'development',issue:{owner:'rankpilot'},ledger:[{trace:{usage:{total_tokens:4200000}}}]};
test('legacy amounts and earlier grants do not stop uncapped jobs or reset spend',()=>{
 assert.equal(editorialTokenBudget(job.ledger),Infinity);
 assert.equal(editorialTokenBudget([...job.ledger,{status:'authorized_validation_capacity',authorization:{approved_by:'Owner',reason:'Historical grant',total_tokens:3000000}}]),Infinity);
 assert.equal(spentTokens(job.ledger),4200000);
 assert.ok(recoveryPlan(job,'DEVELOPMENT_REJECTED','new'));
});
test('uncapped jobs still stop repeated failed methods, unknown calls and source requests',()=>{
 const failures=Array.from({length:2},()=>({stage:'development',cursor:2,issue:{code:'DEVELOPMENT_REJECTED'}}));
 assert.equal(recoveryPlan({...job,ledger:[...job.ledger,...failures]},'DEVELOPMENT_REJECTED','new'),null);
 assert.equal(recoveryPlan({...job,ledger:[...job.ledger,{trace:{usage:{unknown_calls:1}}}]},'DEVELOPMENT_REJECTED','new'),null);
 assert.equal(recoveryPlan({...job,issue:{owner:'user'}},'DEVELOPMENT_REJECTED','new'),null);
 assert.equal(recoveryPlan({...job,cursor:40},'DEVELOPMENT_REJECTED','new'),null);
});
test('uncapped worker omits allowance on the HTTP boundary and strips caller supplied amounts',async()=>{
 const original=global.fetch;let headers;
 global.fetch=async(url,init)=>{headers=new Headers(init.headers);return Response.json({}, {status:400});};
 try {
  await editorialIdentity.run({userId:'u',submissionId:'s',tokenAllowance:editorialTokenBudget()-spentTokens(job.ledger)},()=>engineFetch('https://fixture.invalid',{headers:{'X-RankPilot-Token-Allowance':'1'}}));
  assert.equal(headers.get('X-RankPilot-Token-Allowance'),null);
 }finally{global.fetch=original;}
});
test('removing the ceiling allows one saved budget review, with finite retry history retained',()=>{
 const j={status:'needs_review',sourceHash:'same',stage:'artifact',cursor:4,tasks:['selection','development','audit','artifact'],ledger:[...job.ledger,{supervision:{action:'pause',reason:'token_budget'}}]};
 const data={final_artifact_review:{judge:{passed:false}},review_checkpoint:{state:{case_requirements:{recovery_contract:'field-recovery-v1'},field_review_attempts:{b10:2}}}};
 const before=structuredClone(data);
 assert.equal(canResumeBudgetReview(j,data,'same'),true);
 assert.equal(canResumeBudgetReview(j,data,'changed'),false);
 j.ledger.push({status:'capacity_continuation_requested',capacity:null});
 assert.equal(canResumeBudgetReview(j,data,'same'),false);
 assert.deepEqual(data,before);
});
