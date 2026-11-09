require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canRecheckFieldContext,FIELD_CONTEXT_VERSION}=require('../../src/lib/editorial/development-recheck.ts');
const {reviewIssues}=require('../../src/lib/audit/review-actions.ts');
function fixture(){return {job:{status:'failed',stage:'development',cursor:1,tasks:['selection','development'],sourceHash:'same',issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot'},ledger:[{worker_commit:'old',trace:{usage:{total_tokens:801304}}}]},data:{review_checkpoint:{state:{selection_validated:true,selection_review_validated:true,development:{b10:'Saved supported wording'},development_validated:false,field_review_enabled:true,field_review_attempts:{b10:2},trace:[{usage:{total_tokens:801304}}],field_review_failures:[{field_path:'b10',obligation_id:'argument:2:b10',owner:'rankpilot'}]}}}};}
test('legacy incomplete institutional context permits one diagnostic without renewing repair or token allowances',()=>{
 const {job,data}=fixture(),before=structuredClone({job,data});assert.equal(canRecheckFieldContext(job,data,'same','new'),true);assert.deepEqual({job,data},before);
 job.ledger.push({status:'field_context_review_requested',worker_commit:'new'});assert.equal(canRecheckFieldContext(job,data,'same','another-build'),false);
});
test('current context, other field failures, unknown usage and exhausted budgets cannot use the context continuation',()=>{
 for(const change of [({data})=>data.review_checkpoint.state.field_review_context_version=FIELD_CONTEXT_VERSION,({data})=>data.review_checkpoint.state.field_review_failures[0].field_path='candidates/0/submission_bio',({data})=>data.review_checkpoint.state.trace.push({usage:{unknown_calls:1}}),({job})=>job.ledger[0].trace.usage.total_tokens=1200000,({job})=>job.status='running']){const f=fixture();change(f);assert.equal(canRecheckFieldContext(f.job,f.data,'same','new'),false);}
 const {job,data}=fixture();assert.equal(canRecheckFieldContext(job,data,'changed','new'),false);assert.equal(canRecheckFieldContext(job,data,'same','old'),false);
});
test('a real continuation action never simultaneously tells the user to contact an administrator',()=>{
 const {job,data}=fixture();for(const context of [false,true]){const [issue]=reviewIssues(data,[],{...job,canResumeResidual:true,canRecheckFieldContext:context,sourceMatches:true});assert.match(issue.action,/Continuar preparación/);assert.doesNotMatch(issue.action,/administr|Copia la referencia/);}
});

test('a prior incomplete mandate-only review may once include an explicitly supplied head, never get a general third retry',()=>{
 const {job,data}=fixture();data.departmentHeads=[{name:'Sofia Vega'}];const s=data.review_checkpoint.state;s.field_review_context_version='selected-institutional-sources-v1';s.field_review_failures=[{field_path:'c2',obligation_id:'argument:0:c2',owner:'rankpilot',source_quote:'Lead Partner(s): Sofia Vega.'}];job.ledger.push({status:'field_context_review_requested',worker_commit:'prior'});
 assert.equal(canRecheckFieldContext(job,data,'same','new'),true);
 job.ledger.push({status:'field_context_review_requested',context_version:FIELD_CONTEXT_VERSION,worker_commit:'new'});assert.equal(canRecheckFieldContext(job,data,'same','future'),false);
 job.ledger.pop();data.departmentHeads=[];assert.equal(canRecheckFieldContext(job,data,'same','new'),false);
});
