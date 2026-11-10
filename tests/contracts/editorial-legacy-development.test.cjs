process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canResumeLegacyDevelopment}=require('../../src/lib/editorial/legacy-development-recovery.ts');
function fixture(){return {
 job:{status:'failed',stage:'development',cursor:1,tasks:['selection','development'],sourceHash:'same',issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot'},ledger:[{worker_commit:'old',trace:{usage:{total_tokens:640797}}}]},
 data:{review_checkpoint:{state:{selection_validated:true,selection_review_validated:true,development:{b10:'Saved source-backed prose'},development_validated:false,trace:[{usage:{total_tokens:640797}}],repair_report:{surgical_retries:1,failed_paths:['candidates/0'],retry_paths:['candidates/0'],corrected_paths:[],unresolved:[]}}}}
};}
test('legacy targeted correction can continue explicitly once without emptying its ledger',()=>{
 const {job,data}=fixture(),before=structuredClone({job,data});assert.equal(canResumeLegacyDevelopment(job,data,'same','new'),true);assert.deepEqual({job,data},before);job.ledger.push({status:'legacy_development_recovery_requested',worker_commit:'new'});assert.equal(canResumeLegacyDevelopment(job,data,'same','future'),false);
});
test('a recovery cannot migrate unknown usage, active shared methods, exhausted budgets or unresolved source questions',()=>{
 for(const change of [({data})=>data.review_checkpoint.state.trace.push({usage:{unknown_calls:1}}),({data})=>data.review_checkpoint.state.field_review_attempts={'candidates/0':1},({data})=>data.review_checkpoint.state.repair_report.unresolved=['Need original evidence'],({job})=>job.ledger[0].trace.usage.total_tokens=1200000,({job})=>job.status='running']){const f=fixture();change(f);assert.equal(canResumeLegacyDevelopment(f.job,f.data,'same','new'),false);}
 const {job,data}=fixture();assert.equal(canResumeLegacyDevelopment(job,data,'changed','new'),false);assert.equal(canResumeLegacyDevelopment(job,data,'same','old'),false);
});
