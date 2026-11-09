require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const original=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:{}};return original.call(this,name,...args);};
const {superviseArtifact}=require('../../src/lib/editorial/supervisor.ts');
const {FIELD_RECOVERY_CONTRACT,obligationKey}=require('../../src/lib/editorial/field-recovery.ts');
const {editorialTokenBudget}=require('../../src/lib/editorial/recovery.ts');
const defect=()=>({severity:'critical',owner:'rankpilot',scope:'submission',code:'EDITORIAL_OMISSION',field_path:'candidates/0/submission_bio',matter_id:'team-a',source_quote:'Team members: Sofia Vega.',artifact_quote:'Sofia advises employers.',message:'Preserve sourced participation.'});
const data=()=>({editorial_development:{version:'editorial-development-v4'},review_checkpoint:{state:{case_requirements:{recovery_contract:FIELD_RECOVERY_CONTRACT}}},release_verdict:{passed:false},final_artifact_review:{judge:{passed:false,defects:[defect()]}}});
const job=()=>({cursor:3,stage:'artifact',ledger:[]});

test('a located failure gets correction then a different source reconstruction, never unlimited retries',()=>{
 const d=data(),j=job(),before=structuredClone(d);
 const first=superviseArtifact(j,d,'commit-a');assert.equal(first.action,'repair');assert.equal(first.repair_strategy,'targeted_correction');
 j.ledger.push({supervision:first,trace:{usage:{total_tokens:100}}});
 const second=superviseArtifact(j,d,'commit-a');assert.equal(second.action,'repair');assert.equal(second.repair_strategy,'source_reconstruction');
 j.ledger.push({supervision:second,trace:{usage:{total_tokens:100}}});
 const terminal=superviseArtifact(j,d,'commit-b');assert.equal(terminal.action,'pause');assert.equal(terminal.reason,'field_recovery_exhausted');
 assert.deepEqual(d,before);assert.notEqual(terminal.action,'complete');
});
test('rewording diagnostics, source excerpts or output cannot replenish a field allowance',()=>{
 const first=defect();
 assert.equal(obligationKey(first),obligationKey({...first,code:'UNSUPPORTED_CLAIM',source_quote:'Another passage of the same source',artifact_quote:'Rephrased output',matter_id:'team-b'}));
 assert.notEqual(obligationKey(first),obligationKey({...first,field_path:'candidates/1/submission_bio'}));
 assert.notEqual(obligationKey({...first,field_path:'text'}),obligationKey({...first,field_path:'text',matter_id:'another-matter'}));
});
test('new localized fields remain repairable after two earlier document reviews',()=>{
 const d=data(),j=job();j.ledger=[{stage:'artifact',generated_content_hash:'first'},{stage:'artifact',generated_content_hash:'second'}];
 assert.equal(superviseArtifact(j,d,'commit').action,'repair');
 const first=superviseArtifact(j,d,'commit');j.ledger.push({supervision:first});
 d.final_artifact_review.judge.defects=[{...defect(),field_path:'candidates/1/submission_bio'}];
 assert.equal(superviseArtifact(j,d,'commit').repair_strategy,'targeted_correction');
});
test('unknown usage and the same cumulative token cap still stop paid recovery',()=>{
 const j=job();j.ledger=[{trace:{usage:{unknown_calls:1}}}];
 assert.equal(superviseArtifact(j,data(),'commit').reason,'provider_outcome_unknown');
 j.ledger=[{trace:{usage:{total_tokens:editorialTokenBudget()}}}];
 assert.equal(superviseArtifact(j,data(),'commit').reason,'token_budget');
});
test('early field repairs and final document repairs share one allowance',()=>{
 const d=data();d.review_checkpoint.state.field_review_attempts={'candidates/0/submission_bio':1};
 assert.equal(superviseArtifact(job(),d,'commit').repair_strategy,'source_reconstruction');
 d.review_checkpoint.state.field_review_attempts['candidates/0/submission_bio']=2;
 assert.equal(superviseArtifact(job(),d,'commit').reason,'field_recovery_exhausted');
});
test('source questions, unlocated diagnostics and independent approval retain their distinct outcomes',()=>{
 const d=data();d.final_artifact_review.judge.defects=[{...defect(),owner:'user'}];
 assert.equal(superviseArtifact(job(),d,'commit').action,'needs_input');
 d.final_artifact_review.judge.defects=[{...defect(),field_path:null}];assert.equal(superviseArtifact(job(),d,'commit').action,'pause');
 d.final_artifact_review.judge={passed:true,defects:[{...defect(),severity:'warning'}]};d.release_verdict.passed=true;
 assert.equal(superviseArtifact(job(),d,'commit').action,'complete');
 d.final_artifact_review.judge.defects=[defect()];assert.notEqual(superviseArtifact(job(),d,'commit').action,'complete');
});
