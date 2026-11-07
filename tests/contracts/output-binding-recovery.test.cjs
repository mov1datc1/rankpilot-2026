require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canBindPublicQuote}=require('../../src/lib/editorial/public-quote-binding.ts');
const {canResumeEditorialResidual}=require('../../src/lib/editorial/residual-recovery.ts');

function fixture(){
 const note='Ernie Soto’s category cannot be established from the permitted biography target: current seniority is missing.';
 const candidates=[
  {name:'Sofia Vega',submission_bio:'Sofia Vega brings experience in workforce governance.',profile_coverage:[{decision:'retain',public_quote:'Sofia brings experience in workforce governance.'}]},
  {name:'Luis Prado',submission_bio:'He also leads constitutional litigation that restored the right of defence.',submission_case_coverage:[{public_quote:'He leads constitutional litigation that restored the right of defence.'}]},
  {name:'Ernie Soto',recommendation:'develop',suggested_ranking:'Category pending',category_missing_criterion:'Current seniority and personal contribution.',submission_bio:'Ernie Soto participates as a team member.'}];
 const data={matters:[{teamMembers:'Ernie Soto'}],review_checkpoint:{state:{development_validated:false,development:{candidates},
  errors:['Perfil B9: Sofia Vega: Credencial retenida ausente del B9 de esta persona.','Caso personal B9: Luis Prado: La contribución personal debe ejecutarse literalmente en el B9 de esta persona.','Reparación pendiente: '+note],
  trace:[{usage:{total_tokens:20}}],repair_report:{corrected_paths:['candidates/0','candidates/1','candidates/2/submission_bio'],failed_paths:[],unresolved:[note],surgical_retries:0}}}};
 const job={id:'same-job',sourceHash:'source',status:'failed',stage:'development',cursor:1,issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot',retryable:true},ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:20}}}]};
 return {data,job};
}
test('known identity and additive bindings never alter prose or accept changed facts',()=>{
 assert.equal(canBindPublicQuote('Sofia brings experience in workforce governance.','Sofia Vega brings experience in workforce governance.','Sofia Vega'),true);
 assert.equal(canBindPublicQuote('He leads constitutional litigation that restored the right of defence.','He also leads constitutional litigation that restored the right of defence.','Luis Prado'),true);
 assert.equal(canBindPublicQuote("He restored the employer's right of defence.",'He also restored the employer’s right of defence.','Luis Prado'),true);
 assert.equal(canBindPublicQuote("He restored the employer's right of defence.",'He restored the employers’ right of defence.','Luis Prado'),false);
 for(const body of ['Sofia Vega did not lead workforce negotiations.','Sofia Vega may lead workforce negotiations.','Luis Prado led workforce negotiations.'])assert.equal(canBindPublicQuote('Sofia led workforce negotiations.',body,'Sofia Vega'),false);
 assert.equal(canBindPublicQuote('He leads collective labour negotiations.','He also leads collective labour negotiations. He also leads collective labour negotiations.','Luis Prado'),false);
});
test('known binding residual plus an out-of-scope already-pending category can continue once after a code fix',()=>{
 const {data,job}=fixture(),before=structuredClone({data,job});
 assert.equal(canResumeEditorialResidual(job,data,'source','new-build'),true);
 assert.deepEqual({data,job},before);
 job.ledger.push({status:'residual_recovery_requested'});
 assert.equal(canResumeEditorialResidual(job,data,'source','later-build'),false);
});
test('a missing credential, unrelated source question or actual nomination cannot use binding recovery',()=>{
 const {data,job}=fixture();
 data.review_checkpoint.state.development.candidates[0].submission_bio='Sofia Vega has no retained career evidence in this text.';
 assert.equal(canResumeEditorialResidual(job,data,'source','new-build'),false);
 const next=fixture();next.data.review_checkpoint.state.repair_report.unresolved=['Please confirm a disputed legal outcome.'];
 assert.equal(canResumeEditorialResidual(next.job,next.data,'source','new-build'),false);
 const nomination=fixture();nomination.data.review_checkpoint.state.development.candidates[2].recommendation='present';
 assert.equal(canResumeEditorialResidual(nomination.job,nomination.data,'source','new-build'),false);
});
test('binding continuation retains source, build and provider-usage restrictions',()=>{
 const {data,job}=fixture();
 assert.equal(canResumeEditorialResidual(job,data,'other-source','new-build'),false);
 assert.equal(canResumeEditorialResidual(job,data,'source','old-build'),false);
 data.review_checkpoint.state.trace.push({usage:{unknown_calls:1}});
 assert.equal(canResumeEditorialResidual(job,data,'source','new-build'),false);
});
