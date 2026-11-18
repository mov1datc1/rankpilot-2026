process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canAcceptSelectionObservations}=require('../../src/lib/editorial/selection-recovery.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
// DeForest 18-11 shape: 3 reviews, 2 repairs, two bound wording findings.
function fixture(){
 const finding=(kind)=>({status:'repair_required',evidence_bound:true,field_paths:['rationale','legal_understanding'],correction_dispositions:[],evidence_kind:kind,rule_id:null,rule_quote:''});
 const failed={securitas:finding('source'),solana:finding('portfolio_comparison')};
 const state={selection_validated:false,selection_review_validated:false,selection_diagnostic_invalid:false,selection_review_unavailable:false,selection_review_deferred:false,
  selection_review_attempts:3,selection_repair_attempts:2,trace:[{usage:{total_tokens:65633}},{usage:{total_tokens:61680}}],
  selection_feedback:{semantic_rejection:true,field_only:true,failed_checks:failed,pending_diagnostics:{}}};
 const source={id:'s',userId:'u',targetDirectory:'Chambers',practiceArea:'Labour & Employment',matters:[],chambersData:{matters:[{id:'securitas',rawNotes:'x'},{id:'solana',rawNotes:'y'}],review_checkpoint:{created_at:Date.now(),step_keys:{strategy:'k'},state}}};
 const sourceHash=stableHash(sourceSnapshot(source));
 const job={id:'j',status:'failed',stage:'selection',cursor:0,tasks:['selection'],sourceHash,ledger:[{stage:'selection',worker_commit:'v97',trace:{usage:{total_tokens:274107}}}],issue:{owner:'rankpilot',code:'SELECTION_REJECTED'}};
 return {source,state,sourceHash,job,failed};
}
const withState=(source,delta)=>({...source.chambersData,review_checkpoint:{...source.chambersData.review_checkpoint,state:{...source.chambersData.review_checkpoint.state,...delta}}});
test('exhausted wording-only rejection continues once on a new build',()=>{
 const {source,sourceHash,job}=fixture();
 assert.equal(canAcceptSelectionObservations(job,source.chambersData,sourceHash,'v98'),true);
 assert.equal(canAcceptSelectionObservations(job,source.chambersData,sourceHash,'v97'),false);
 assert.equal(canAcceptSelectionObservations({...job,ledger:[...job.ledger,{status:'selection_observation_acceptance_requested',worker_commit:'v98'}]},source.chambersData,sourceHash,'v99'),false);
 assert.equal(canAcceptSelectionObservations(job,source.chambersData,'other-source','v98'),false);
 assert.equal(canAcceptSelectionObservations({...job,issue:{owner:'user',code:'SELECTION_REJECTED'}},source.chambersData,sourceHash,'v98'),false);
});
test('disposition, rule, unbound, unknown-usage or still-repairable findings never qualify',()=>{
 const {source,sourceHash,job,failed}=fixture();
 const bad=[
  {selection_feedback:{semantic_rejection:true,field_only:true,failed_checks:{...failed,securitas:{...failed.securitas,correction_dispositions:['reserve']}}}},
  {selection_feedback:{semantic_rejection:true,field_only:true,failed_checks:{...failed,securitas:{...failed.securitas,evidence_kind:'application_rule'}}}},
  {selection_feedback:{semantic_rejection:true,field_only:true,failed_checks:{...failed,securitas:{...failed.securitas,evidence_bound:false}}}},
  {selection_feedback:{semantic_rejection:true,field_only:false,failed_checks:failed}},
  {selection_feedback:{semantic_rejection:true,field_only:true,failed_checks:failed,pending_diagnostics:{x:{}}}},
  {selection_review_attempts:2,selection_repair_attempts:1},
  {selection_diagnostic_invalid:true},
  {trace:[{usage:{unknown_calls:1}}]},
 ];
 for(const delta of bad) assert.equal(canAcceptSelectionObservations(job,withState(source,delta),sourceHash,'v98'),false,JSON.stringify(delta).slice(0,120));
 const stale={...source.chambersData,review_checkpoint:{...source.chambersData.review_checkpoint,created_at:Date.now()-86400001}};
 assert.equal(canAcceptSelectionObservations(job,stale,sourceHash,'v98'),false);
});
