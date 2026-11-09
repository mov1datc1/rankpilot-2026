require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {recoveryPlan,editorialTokenBudget}=require('../../src/lib/editorial/recovery.ts');
const job={cursor:2,stage:'audit',ledger:[],issue:{owner:'rankpilot'}};
test('authorized validation capacity preserves spend and does not reset failed methods or unknown calls',()=>{
 const {spentTokens,authorizedReviewUsed}=require('../../src/lib/editorial/recovery.ts');
 const used={trace:{usage:{total_tokens:1236241}}};
 const grant={status:'authorized_validation_capacity',authorization:{approved_by:'Owner',reason:'Complete validation with bounded recovery',total_tokens:3000000}};
 const ledger=[used,grant];assert.equal(editorialTokenBudget(ledger),3000000);assert.equal(spentTokens(ledger),1236241);
 assert.equal(authorizedReviewUsed([...ledger,{stage:'artifact',trace:{usage:{total_tokens:10}}}]),false);
 assert.equal(recoveryPlan({...job,ledger:[...ledger,...Array.from({length:2},()=>({stage:'audit',cursor:2,issue:{code:'DEVELOPMENT_REJECTED'}}))]},'DEVELOPMENT_REJECTED','new'),null);
 assert.equal(recoveryPlan({...job,ledger:[...ledger,{trace:{usage:{unknown_calls:1}}}]},'DEVELOPMENT_REJECTED','new'),null);
 assert.equal(editorialTokenBudget([{...grant,authorization:{...grant.authorization,total_tokens:Infinity}}]),editorialTokenBudget());
});
test('mixed known and unknown usage survives aggregation and blocks automatic recovery',()=>{
 const {stageTraceDelta}=require('../../src/lib/audit/review-checkpoint.ts');
 const {spentTokens,hasUnknownProviderUsage}=require('../../src/lib/editorial/recovery.ts');
 const prior={role:'strategist',provider_request_id:'prior',usage:{total_tokens:100}};
 const unknown={role:'selection_reviewer',usage:{unknown_calls:1},usage_status:'unknown'};
 const trace=stageTraceDelta([],[prior,unknown]);
 assert.equal(trace.usage.total_tokens,100);assert.equal(trace.usage.unknown_calls,1);
 assert.equal(trace.usage_status,'partial_unknown');
 assert.equal(stageTraceDelta([prior,unknown],[prior,unknown]),null);
 const ledger=[{trace}];assert.equal(spentTokens(ledger),100);assert.ok(hasUnknownProviderUsage(ledger));
 assert.equal(recoveryPlan({...job,ledger},'SELECTION_REVIEW_DEFERRED','fixed'),null);
 assert.equal(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','fixed'),null);
});
test('unknown provider outcomes never buy another call after a delay or deployment',()=>{
 for(const code of ['AI_REVIEW_UNAVAILABLE','INTERRUPTED','EXISTING_CALL','STAGE_FAILED','DRAFT_CONFLICT']) {
  assert.equal(recoveryPlan(job,code,'build',1000),null);
  assert.equal(recoveryPlan(job,code,'fixed',Date.now()+3600000),null);
 }
});
test('one retry per stage/cursor, with no extra allowance after a deployment',()=>{
 const ledger=Array.from({length:2},()=>({stage:'audit',cursor:2,worker_commit:'old',issue:{code:'DEVELOPMENT_REJECTED'}}));
 assert.ok(recoveryPlan({...job,ledger:ledger.slice(0,1)},'DEVELOPMENT_REJECTED','fixed'));
 assert.equal(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','old'),null);
 assert.equal(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','fixed'),null);
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

test('ambiguous template-label diagnostics are reassessed without approving or taking over factual disputes',()=>{
 const {needsDiagnosticReview}=require('../../src/lib/editorial/recovery.ts');
 const defect={code:'TEMPORAL_FINDING_UNRESOLVED',severity:'critical',owner:'rankpilot',retryable:true,temporal_basis:'missing_metadata',artifact_claim_kind:'template_label',source_quote:'',artifact_quote:'E8 Date of completion or current status'};
 const state=d=>({final_artifact_review:{judge:{acceptance:[{criterion:'source_fidelity',status:'met'}],defects:[d]}}});
 assert.equal(needsDiagnosticReview(state(defect)),true);
 for(const changes of [{owner:'user'},{source_quote:'Work ended in 2020'},{temporal_basis:'evidenced_conflict'},{artifact_claim_kind:'factual_assertion'},{retryable:false}]) assert.equal(needsDiagnosticReview(state({...defect,...changes})),false);
});
test('a rejected selection never buys another complete selector automatically',()=>{
 assert.equal(recoveryPlan({stage:'selection',cursor:0,issue:{owner:'rankpilot'},ledger:[]},'SELECTION_REJECTED','fixed'),null);
});

test('explicit extension adds only its approved ceiling and permits no second final call',()=>{
 const {authorizedReviewUsed}=require('../../src/lib/editorial/recovery.ts');
 const used=1209770,grant={status:'authorized_extension',authorization:{approved_by:'Explicit user approval',spent_tokens:used,additional_tokens:250000,final_reviews:1}};
 const ledger=[{trace:{usage:{total_tokens:used}}},grant];
 assert.equal(editorialTokenBudget(ledger),1459770);assert.equal(authorizedReviewUsed(ledger),false);
 assert.ok(recoveryPlan({...job,ledger},'DEVELOPMENT_REJECTED','fixed'));
 const reviewed=[...ledger,{stage:'artifact',issue:{code:'AI_REVIEW_UNAVAILABLE'}}];
 assert.equal(authorizedReviewUsed(reviewed),true);assert.equal(recoveryPlan({...job,ledger:reviewed},'AI_REVIEW_UNAVAILABLE','fixed'),null);
 assert.equal(recoveryPlan({...job,ledger:[...ledger,{trace:{usage:{total_tokens:250000}}}]},'DEVELOPMENT_REJECTED','fixed'),null);
 assert.equal(editorialTokenBudget([{...grant,authorization:{...grant.authorization,approved_by:''}}]),editorialTokenBudget());
});
