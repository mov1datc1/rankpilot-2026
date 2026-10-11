require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const original=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:{}};return original.call(this,name,...args);};
const {superviseArtifact,findingFingerprint}=require('../../src/lib/editorial/supervisor.ts');
const {editorialTokenBudget}=require('../../src/lib/editorial/recovery.ts');
const issue={severity:'critical',owner:'rankpilot',scope:'letter',code:'EDITORIAL_OMISSION',field_path:'leadership',matter_id:'fictional-7',source_quote:'Unranked; proposed category: associate to watch',artifact_quote:'Current: associate',message:'Ranking status omitted'};
const data=()=>({editorial_development:{version:'editorial-development-v2'},editorial_review:{letter:{leadership:'Current: associate'}},release_verdict:{passed:false},final_artifact_review:{judge:{passed:false,defects:[structuredClone(issue)]}}});
const job=()=>({cursor:3,stage:'artifact',ledger:[]});
test('supervisor selects Audit-only correction and never mutates evidence or approves its own repair',()=>{
 const d=data(),before=structuredClone(d);const decision=superviseArtifact(job(),d,'build');assert.equal(decision.action,'repair');assert.deepEqual(decision.repair.tasks,['audit','artifact']);assert.deepEqual(d,before);
});
test('same unresolved claim stops even if unrelated text and diagnostic wording change',()=>{
 const d=data(),j=job();j.ledger=[{supervision:superviseArtifact(j,d,'build')}];d.editorial_review.letter.portfolio='Unrelated rewrite';d.final_artifact_review.judge.defects[0].message='Another explanation of the same defect';
 assert.equal(superviseArtifact(j,d,'build').reason,'same_finding_after_repair');
 d.final_artifact_review.judge.defects[0].artifact_quote='A different disputed assertion';assert.equal(superviseArtifact(j,d,'build').action,'repair');
});
test('different matters and scopes do not share recovery fingerprints',()=>{
 for(const change of [{matter_id:'fictional-8'},{scope:'submission'},{field_path:'portfolio'},{source_quote:'Different source'}])assert.notEqual(findingFingerprint(issue),findingFingerprint({...issue,...change}));
 assert.equal(findingFingerprint(issue),findingFingerprint({...issue,artifact_quote:'Current:   associate'}));
});
test('source questions and exhausted budgets cannot trigger a paid correction',()=>{
 const d=data();d.final_artifact_review.judge.defects.push({...issue,owner:'user'});assert.equal(superviseArtifact(job(),d,'build').action,'needs_input');
 const j=job();j.ledger=[{trace:{usage:{total_tokens:editorialTokenBudget()}}}];assert.equal(superviseArtifact(j,data(),'build').reason,'token_budget');
});
test('invalid diagnostics recheck the reviewer under existing retry limits, never approve',()=>{
 const d=data();d.final_artifact_review.judge={passed:false,acceptance:[{status:'failed'}],defects:[{code:'EDITORIAL_OMISSION',severity:'critical',owner:'rankpilot',message:'La aceptación editorial no está completa: source_fidelity'}]};
 assert.equal(superviseArtifact(job(),d,'build').action,'reassess');
 const j=job();j.ledger=Array.from({length:3},()=>({stage:'artifact',cursor:3,worker_commit:'build',issue:{code:'AI_REVIEW_INVALID'}}));assert.equal(superviseArtifact(j,d,'build').action,'pause');
});
test('only the independent release and artifact verdict together authorize completion',()=>{
 const d=data();d.final_artifact_review.judge={passed:true,defects:[]};assert.notEqual(superviseArtifact(job(),d,'build').action,'complete');d.release_verdict.passed=true;assert.equal(superviseArtifact(job(),d,'build').action,'complete');
 d.final_artifact_review.judge.defects=[issue];assert.notEqual(superviseArtifact(job(),d,'build').action,'complete');
});
