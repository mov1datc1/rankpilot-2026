process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canResumeBudgetReview}=require('../../src/lib/editorial/budget-continuation.ts');
function fixture(){return {job:{status:'needs_review',sourceHash:'same',stage:'artifact',cursor:4,tasks:['selection','development','audit','artifact'],ledger:[{trace:{usage:{total_tokens:1236241}},supervision:{action:'pause',reason:'token_budget'}},{status:'authorized_validation_capacity',authorization:{approved_by:'Owner',reason:'Finish validation',total_tokens:3000000}}]},data:{final_artifact_review:{judge:{passed:false}},review_checkpoint:{state:{case_requirements:{recovery_contract:'field-recovery-v1'},field_review_attempts:{b10:2}}}}};}
test('legacy final review migrates recorded fields instead of hitting the old global limit or resetting earlier methods',()=>{
 const {capacityRecoveryCheckpoint}=require('../../src/lib/editorial/budget-continuation.ts');
 const {fieldRecoveryPlan}=require('../../src/lib/editorial/field-recovery.ts');
 const {job,data}=fixture();delete data.review_checkpoint.state.field_review_attempts;delete data.review_checkpoint.state.case_requirements;
 data.review_checkpoint.state.repair_report={corrected_paths:['matters/0/text'],failed_paths:[],unresolved:[]};
 job.ledger.unshift({supervision:{action:'repair',reason:'targeted_generated_content'}});
 const before=structuredClone({job,data}),s=capacityRecoveryCheckpoint(job,data).state;
 assert.deepEqual({job,data},before);assert.deepEqual(s.field_review_attempts,{'matters/0/text':1});
 const defect=field=>({owner:'rankpilot',severity:'critical',scope:'submission',field_path:field,artifact_quote:'Current wording',message:'Missing documented participation'});
 assert.equal(fieldRecoveryPlan(job.ledger,[defect('candidates/6/submission_bio')],s.field_review_attempts).strategy,'targeted_correction');
 assert.equal(fieldRecoveryPlan(job.ledger,[defect('matters/0/text')],s.field_review_attempts).strategy,'source_reconstruction');
 job.ledger.unshift({supervision:{action:'repair'}});assert.equal(capacityRecoveryCheckpoint(job,data),null);
});
test('capacity permits one continuation of the saved final stage without resetting spent methods',()=>{
 const {job,data}=fixture(),before=structuredClone({job,data});assert.equal(canResumeBudgetReview(job,data,'same'),true);assert.deepEqual({job,data},before);
 job.ledger.push({status:'capacity_continuation_requested',capacity:3000000});assert.equal(canResumeBudgetReview(job,data,'same'),false);
});
test('capacity cannot turn other stops, unknown usage or changed sources into retry permission',()=>{
 for(const change of [({job})=>job.ledger[0].supervision.reason='field_recovery_exhausted',({job})=>job.ledger[0].trace.usage.unknown_calls=1,({data})=>data.review_checkpoint.state.trace=[{usage:{unknown_calls:1}}],({job})=>job.ledger[1].authorization.total_tokens=1200000,({job})=>job.status='running',({data})=>delete data.final_artifact_review]) {const f=fixture();change(f);assert.equal(canResumeBudgetReview(f.job,f.data,'same'),false);}
 const f=fixture();assert.equal(canResumeBudgetReview(f.job,f.data,'changed'),false);
});
