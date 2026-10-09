require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {recoveryPlan,editorialTokenBudget}=require('../../src/lib/editorial/recovery.ts');
const job={cursor:2,stage:'audit',ledger:[],issue:{owner:'rankpilot'}};
test('unknown provider outcome is quarantined beyond the engine lease before automatic retry',()=>{
 const plan=recoveryPlan(job,'AI_REVIEW_UNAVAILABLE','build',1000);
 assert.ok(+plan.retryAt>=331000);assert.equal(plan.attempt,1);
});
test('three same-stage failures stop automatic consumption, a new build gets a bounded recovery',()=>{
 const ledger=Array.from({length:3},()=>({stage:'audit',cursor:2,worker_commit:'old',issue:{code:'DEVELOPMENT_REJECTED'}}));
 assert.equal(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','old'),null);
 assert.ok(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','fixed'));
 assert.equal(recoveryPlan({...job,ledger:[...ledger,...ledger]},'DEVELOPMENT_REJECTED','another'),null);
});
test('recovery preserves the cumulative budget and never takes over factual user questions or changed sources',()=>{
 assert.equal(recoveryPlan({...job,ledger:[{trace:{usage:{total_tokens:editorialTokenBudget()}}}]},'AI_REVIEW_UNAVAILABLE','fixed'),null);
 assert.equal(recoveryPlan({...job,issue:{owner:'user'}},'DEVELOPMENT_REJECTED','fixed'),null);
 for(const code of ['SOURCE_CHANGED','HUMAN_DRAFT_STALE','TOKEN_BUDGET','INVALID_STAGE'])assert.equal(recoveryPlan(job,code,'fixed'),null);
});
test('a new repair pass does not inherit failures from a different cursor',()=>{
 const ledger=Array.from({length:3},()=>({stage:'audit',cursor:2,worker_commit:'same',issue:{code:'DEVELOPMENT_REJECTED'}}));
 assert.ok(recoveryPlan({...job,cursor:5,ledger},'DEVELOPMENT_REJECTED','same'));
});

test('an invalid completed review retries promptly and still respects the failure ceiling',()=>{
 const plan=recoveryPlan(job,'AI_REVIEW_INVALID','build',1000);
 assert.equal(+plan.retryAt,16000);
 const ledger=Array.from({length:3},()=>({stage:'audit',cursor:2,worker_commit:'build',issue:{code:'AI_REVIEW_INVALID'}}));
 assert.equal(recoveryPlan({...job,ledger},'AI_REVIEW_INVALID','build'),null);
});

test('only ungrounded global review failures qualify for diagnostic recovery',()=>{
 const {needsDiagnosticReview}=require('../../src/lib/editorial/recovery.ts');
 const defect={code:'EDITORIAL_OMISSION',severity:'critical',owner:'rankpilot',message:'La aceptación editorial no está completa: source_fidelity',source_quote:'',artifact_quote:''};
 const state={final_artifact_review:{judge:{acceptance:[{criterion:'source_fidelity',status:'failed'}],defects:[defect]}}};
 assert.equal(needsDiagnosticReview(state),true);
 for(const changes of [{owner:'user'},{artifact_quote:'A concrete disputed assertion'},{source_quote:'A concrete omitted source fact'},{code:'SOURCE_CONFLICT'}]){
  assert.equal(needsDiagnosticReview({final_artifact_review:{judge:{...state.final_artifact_review.judge,defects:[{...defect,...changes}]}}}),false);
 }
 assert.equal(needsDiagnosticReview({}),false);
});
