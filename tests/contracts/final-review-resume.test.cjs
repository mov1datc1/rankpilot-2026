require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canResumeFinalReview,FINAL_REVIEW_RESUME}=require('../../src/lib/editorial/final-review-resume.ts');
const {recoveryPlan}=require('../../src/lib/editorial/recovery.ts');

// v1.0.104 (Ramos Castillo 19-11): the final review returned AI_REVIEW_INVALID twice and the case stopped.
const failure={stage:'artifact',cursor:3,issue:{code:'AI_REVIEW_INVALID'},trace:{usage:{total_tokens:70000}}};
const job=()=>({status:'failed',stage:'artifact',cursor:3,sourceHash:'h',issue:{code:'AI_REVIEW_INVALID',owner:'rankpilot',retryable:true},ledger:[failure,failure]});
const data={review_checkpoint:{state:{development:{}}}};

test('a case stopped only by an unfinished final review can resume that review once',()=>{
 assert.equal(canResumeFinalReview(job(),data,'h'),true);
 assert.equal(canResumeFinalReview({...job(),sourceHash:'other'},data,'h'),false);
 assert.equal(canResumeFinalReview({...job(),stage:'development'},data,'h'),false);
 assert.equal(canResumeFinalReview({...job(),issue:{code:'SELECTION_REJECTED'}},data,'h'),false);
 assert.equal(canResumeFinalReview({...job(),ledger:[{stage:'artifact',trace:{usage:{unknown_calls:1}}}]},data,'h'),false);
 assert.equal(canResumeFinalReview({...job(),ledger:[...job().ledger,{status:FINAL_REVIEW_RESUME}]},data,'h'),false);
 assert.equal(canResumeFinalReview(job(),{},'h'),false);
});
test('the resume marker restores exactly one bounded retry allowance for that stage',()=>{
 const spent=job();assert.equal(recoveryPlan(spent,'AI_REVIEW_INVALID','build'),null);
 const resumed={...spent,status:'queued',ledger:[...spent.ledger,{stage:'artifact',cursor:3,status:FINAL_REVIEW_RESUME}]};
 assert.ok(recoveryPlan({...resumed,ledger:[...resumed.ledger,failure]},'AI_REVIEW_INVALID','build'));
 assert.equal(recoveryPlan({...resumed,ledger:[...resumed.ledger,failure,failure]},'AI_REVIEW_INVALID','build'),null);
});
