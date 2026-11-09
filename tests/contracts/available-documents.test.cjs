require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {artifactHash,deliveryInputHash,storedAvailableBytes}=require('../../src/lib/audit/artifact-binding.ts');
const {getDeliveryState}=require('../../src/lib/audit/delivery-state.ts');
const {REVIEW_CONTRACT}=require('../../src/lib/audit/review-versions.ts');
const {canContinueWithObservations}=require('../../src/lib/editorial/observations-continuation.ts');
function fixture(){
 const submission={practiceArea:'Tax',targetDirectory:'Chambers'};
 const data={draft_revision:4,firm_name:'Synthetic Firm',practice_area:'Tax',original_b10:'Tax disputes',matters:[{id:'m',rawNotes:'A pending appeal.',publish_status:'confidential'}],
   completed_review_policy_version:REVIEW_CONTRACT.policy,completed_renderer_version:REVIEW_CONTRACT.renderer,completed_artifact_review_version:REVIEW_CONTRACT.artifact,
   release_verdict:{passed:false,status:'needs_review',errors:['One sourced contribution is missing.']},
   final_artifact_review:{judge:{passed:false,defects:[{severity:'critical',owner:'rankpilot',message:'One sourced contribution is missing.'}]}}};
 const bytes=Buffer.from('exact bytes fixture'),audit=Buffer.from('exact audit fixture');
 data.available_artifact={base64:bytes.toString('base64'),audit_base64:audit.toString('base64'),sha256:artifactHash(bytes),audit_sha256:artifactHash(audit),input_hash:deliveryInputHash(submission,data),observation_status:'with_observations',review_revision:4};
 return {submission,data,bytes,audit};
}
test('both exact files remain downloadable with findings; approval remains false',()=>{
 const {submission,data,bytes,audit}=fixture();const result=getDeliveryState(data,data.matters,true);
 assert.equal(result.available,true);assert.equal(result.approved,false);assert.equal(result.label,'Documentos disponibles · con observaciones');
 assert.deepEqual(storedAvailableBytes(submission,data,'submission'),bytes);assert.deepEqual(storedAvailableBytes(submission,data,'audit'),audit);
 assert.equal(data.final_artifact_review.judge.defects.length,1);
});
test('a missing, stale or corrupted partner file cannot be advertised or downloaded as a complete pair',()=>{
 let {submission,data}=fixture();delete data.available_artifact.audit_base64;
 assert.equal(getDeliveryState(data,data.matters,true).available,false);assert.equal(storedAvailableBytes(submission,data,'submission'),null);
 ({submission,data}=fixture());data.original_b10='Edited source';assert.equal(storedAvailableBytes(submission,data,'submission'),null);
 ({submission,data}=fixture());data.available_artifact.audit_base64=Buffer.from('changed').toString('base64');assert.throws(()=>storedAvailableBytes(submission,data,'submission'),/CORRUPTED/);
 ({submission,data}=fixture());data.draft_revision++;assert.equal(getDeliveryState(data,data.matters,true).available,false);
});
test('completed repair capacity continues the same saved semantic attempt once without resetting methods or usage',()=>{
 const state={selection_validated:true,selection_review_validated:true,development:{b10:'Saved'},development_validated:false,field_review_failures:[{owner:'rankpilot',field_path:'b10',source_quote:'Source',artifact_quote:'Saved'}],field_review_attempts:{b10:2},trace:[{usage:{total_tokens:31}}]};
 const data={review_checkpoint:{state}};
 const job={status:'failed',stage:'development',tasks:['development'],cursor:0,sourceHash:'same',issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot'},ledger:[{trace:{usage:{total_tokens:31}}}]};
 const before=structuredClone({job,data});assert.equal(canContinueWithObservations(job,data,'same'),true);assert.deepEqual({job,data},before);
 assert.equal(canContinueWithObservations(job,data,'changed'),false);
 job.ledger.push({status:'delivery_observations_requested'});assert.equal(canContinueWithObservations(job,data,'same'),false);
 job.ledger=[{trace:{usage:{unknown_calls:1}}}];assert.equal(canContinueWithObservations(job,data,'same'),false);
});
