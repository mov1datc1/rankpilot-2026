const test=require('node:test');const assert=require('node:assert/strict');
require('../../docs/reviews/review-loader.cjs');
const {planDrafting,publicJob,targetedRepair}=require('../../src/lib/editorial/jobs.ts');
const {sourceSnapshot,stableHash,draftSourceHash,draftDisposition}=require('../../src/lib/editorial/contracts.ts');
const {editorialIdentity,editorialUser}=require('../../src/lib/editorial/identity.ts');
const {reviewStepHash}=require('../../src/lib/audit/review-checkpoint.ts');
const matters=Array.from({length:32},(_,i)=>({id:`m${i}`,rawNotes:`Matter ${i} is pending`,publish_status:'non_publishable',confidentialityConfirmed:true}));
const state={selection_validated:true,strategy:{matters:matters.map((m,i)=>({matter_id:m.id,disposition:i<20?'core':'reserve'})),hero_matter_id:'m0'}};
test('strategy selects before drafting; 12 reserves do not buy rewrites',()=>{
 const tasks=planDrafting({matters,original_b10:'Department source',review_checkpoint:{state}});
 assert.deepEqual([tasks[0],tasks.at(-2),tasks.at(-1)],['selection','audit','artifact']);
 assert.deepEqual(tasks,['selection','development','audit','artifact']);
});
test('rejected selection cannot advance into writers',()=>assert.throws(()=>planDrafting({matters,review_checkpoint:{state:{...state,selection_validated:false}}}),/SELECTION_REJECTED/));
test('source edits invalidate generated prose but never overwrite human edits',()=>{
 const original=matters[0],prose='Pending mandate.';
 const draft={...original,optimizedText:prose,draft_provenance:{source_hash:draftSourceHash(original),text_hash:stableHash(prose)}};
 assert.equal(draftDisposition(draft),'reuse');
 assert.equal(draftDisposition({...draft,rawNotes:'Changed facts'}),'write');
 assert.equal(draftDisposition({...draft,rawNotes:'Changed facts',optimizedText:'Human correction'}),'review');
});
test('generated drafts and trace provenance do not invalidate source snapshot or strategy',()=>{
 const submission={practiceArea:'Tax',targetDirectory:'Chambers',chambersData:{matters}};
 const snapshot=sourceSnapshot(submission), key=reviewStepHash('strategy',snapshot.payload);
 const changed=structuredClone(submission);changed.chambersData.matters[0]={...matters[0],optimizedText:'Some prose',status:'Optimized',draft_provenance:{source_hash:'h'}};
 assert.equal(stableHash(sourceSnapshot(changed)),stableHash(snapshot));
 assert.equal(reviewStepHash('strategy',{...snapshot.payload,matters:changed.chambersData.matters}),key);
 changed.chambersData.matters[0].rawNotes='Different evidence';assert.notEqual(stableHash(sourceSnapshot(changed)),stableHash(snapshot));
});
test('worker identity is scoped to one owned submission and never an HTTP capability',async()=>{
 await editorialIdentity.run({userId:'owner',submissionId:'s1'},async()=>{
 assert.deepEqual(await editorialUser(new Request('http://local',{method:'POST',body:JSON.stringify({submissionId:'s1'})})),{id:'owner',email:null});
 assert.equal(await editorialUser(new Request('http://local',{method:'POST',body:JSON.stringify({submissionId:'s2'})})),null);
 });assert.equal(editorialIdentity.getStore(),undefined);
});
test('browser polling cannot retrieve private source snapshots or lease tokens',()=>{
 const publicState=publicJob({id:'j',status:'running',stage:'selection',cursor:0,tasks:['selection'],snapshot:{secret:'private'},leaseToken:'private'});
 assert.equal(publicState.snapshot,undefined);assert.equal(publicState.leaseToken,undefined);
});

test('automatic repair requires literal evidence, generated provenance and an affected matter',()=>{
 const prose='The team won the appeal.';
 const source='The appeal remains pending.';
 const matter={id:'m1',rawNotes:source,optimizedText:prose,draft_provenance:{text_hash:stableHash(prose)}};
 const defect={severity:'critical',code:'UNSUPPORTED_CLAIM',owner:'rankpilot',scope:'submission',matter_id:'m1',source_quote:source,artifact_quote:prose};
 const data={matters:[matter],final_artifact_review:{judge:{defects:[defect]}}};
 assert.deepEqual(targetedRepair(data),{tasks:['matter:m1','audit','artifact'],letter:false});
 assert.equal(targetedRepair({...data,matters:[{...matter,optimizedText:'Human-edited prose'}]}),null);
 assert.equal(targetedRepair({...data,final_artifact_review:{judge:{defects:[{...defect,source_quote:'Unrelated source'}]}}}),null);
 assert.equal(targetedRepair({...data,final_artifact_review:{judge:{defects:[{...defect,owner:'user'}]}}}),null);
 assert.equal(targetedRepair({...data,final_artifact_review:{judge:{defects:[{...defect,code:'SOURCE_CONFLICT'}]}}}),null);
});

test('the complete editorial development is a mandatory stage before audit and artifacts',()=>{
 assert.deepEqual(planDrafting({matters,review_checkpoint:{state}}),['selection','development','audit','artifact']);
});

test('a user question does not prevent repair of a separate source-backed generation defect',()=>{
 const prose='The team won.';const source='The appeal is pending.';
 const data={matters:[{id:'m1',rawNotes:source,optimizedText:prose,draft_provenance:{text_hash:stableHash(prose)}}],final_artifact_review:{judge:{defects:[{severity:'critical',owner:'user',code:'SOURCE_CONFLICT',message:'Confirm the lawyer role'},{severity:'critical',owner:'rankpilot',code:'UNSUPPORTED_CLAIM',scope:'submission',matter_id:'m1',source_quote:source,artifact_quote:prose}]}}};
 assert.deepEqual(targetedRepair(data),{tasks:['matter:m1','audit','artifact'],letter:false});
});
test('generated department text can be repaired, but a human-edited B10 cannot',()=>{
 const source='The team advises on appeals.',text='The team won every appeal.';
 const data={original_b10:source,enhanced_b7:text,b10_optimization:{source,text},final_artifact_review:{judge:{defects:[{severity:'critical',owner:'rankpilot',code:'UNSUPPORTED_CLAIM',scope:'submission',source_quote:source,artifact_quote:text}]}}};
 assert.deepEqual(targetedRepair(data),{tasks:['b10','audit','artifact'],letter:false});
 assert.equal(targetedRepair({...data,enhanced_b7:'Human text.'}),null);
});

test('public failures explain the next action without leaking validator IDs',()=>{
 const j=publicJob({id:'j',status:'failed',stage:'development',cursor:1,tasks:['selection','development','audit','artifact'],issue:{owner:'rankpilot',code:'DEVELOPMENT_REJECTED',message:'Cita decisiva sin vínculo literal: secret-uuid'}});
 assert.match(j.issue.message,/Reanudar preparación/);assert.match(j.issue.message,/No necesitas modificar tus datos/);assert.ok(!j.issue.message.includes('secret-uuid'));
});
test('durable tasks reuse completed roles instead of executing the next paid role under the wrong label',()=>{
 const {reviewTaskDisposition}=require('../../src/lib/audit/review-checkpoint.ts');
 assert.equal(reviewTaskDisposition('strategy','development'),'reuse');
 assert.equal(reviewTaskDisposition('development','writer'),'reuse');
 assert.equal(reviewTaskDisposition('writer','done'),'reuse');
 assert.equal(reviewTaskDisposition('development','development'),'run');
 assert.equal(reviewTaskDisposition('writer','development'),'out_of_order');
});
