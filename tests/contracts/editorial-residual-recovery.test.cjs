process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canResumeEditorialResidual}=require('../../src/lib/editorial/residual-recovery.ts');

function fixture(){
 const data={review_checkpoint:{state:{development_validated:false,development:{candidates:[{submission_bio:'The supplied profile identifies the lead lawyer.'}]},errors:['Voz auditora en Submission: candidates/0/submission_bio'],trace:[{usage:{total_tokens:20}}],repair_report:{corrected_paths:['candidates/0','b10'],failed_paths:[],unresolved:[],surgical_retries:0}}}};
 const job={id:'same-job',sourceHash:'unchanged-source',status:'failed',stage:'development',cursor:1,issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot',retryable:true},ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:20}}}]};
 return {data,job};
}
test('one explicit residual continuation keeps the same ledger, cursor and source',()=>{
 const {data,job}=fixture(),before=structuredClone({data,job});
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),true);
 assert.deepEqual({data,job},before);
 job.ledger.push({status:'residual_recovery_requested',worker_commit:'new-build'});
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','another-build'),false);
});
test('source changes, exhausted or unknown consumption, and prior local retries cannot obtain an allowance',()=>{
 const {job,data}=fixture();
 assert.equal(canResumeEditorialResidual(job,data,'changed-source','new-build'),false);
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','old-build'),false);
 for(const changed of [{...job,status:'running'},{...job,stage:'selection'},{...job,issue:{...job.issue,code:'SELECTION_DIAGNOSTIC_INVALID'}},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:1200000}}}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{unknown_calls:1}}}]}])assert.equal(canResumeEditorialResidual(changed,data,'unchanged-source','new-build'),false);
 data.review_checkpoint.state.repair_report.surgical_retries=1;
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),false);
});
test('only located descendant wording residuals qualify, never source or profile-evidence questions',()=>{
 for(const errors of [['Confirma el valor.'],['Perfil B9: Missing evidence.'],['Voz auditora en Submission: candidates/8/submission_bio'],['Voz auditora en Submission: c2']]){
  const {job,data}=fixture();data.review_checkpoint.state.errors=errors;
  assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),false);
 }
 const {job,data}=fixture();data.review_checkpoint.state.trace.push({usage:{unknown_calls:1}});
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),false);
 data.review_checkpoint.state.trace=[];
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),false);
});

test('an omitted structured residual has one explicit continuation but a retried or uncertain one does not',()=>{
 const {job,data}=fixture(),s=data.review_checkpoint.state;
 Object.assign(s,{selection_validated:true,selection_review_validated:true,errors:['Institutional source binding failed.']});
 Object.assign(s.development,{case_plan:{institutional_arguments:[]},institutional_execution:[]});
 Object.assign(s.repair_report,{surgical_retries:1,failed_paths:['case_plan','institutional_execution'],retry_paths:['candidates/0']});
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),true);
 s.repair_report.retry_paths.push('case_plan');
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','new-build'),false);
 s.repair_report.retry_paths.pop();job.ledger.push({status:'residual_recovery_requested'});
 assert.equal(canResumeEditorialResidual(job,data,'unchanged-source','next-build'),false);
});
