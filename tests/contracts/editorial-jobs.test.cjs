const test=require('node:test');const assert=require('node:assert/strict');
require('../../docs/reviews/review-loader.cjs');
const {planDrafting,publicJob,targetedRepair}=require('../../src/lib/editorial/jobs.ts');
const {sourceSnapshot,stableHash,draftSourceHash,draftDisposition}=require('../../src/lib/editorial/contracts.ts');
const {editorialIdentity,editorialUser}=require('../../src/lib/editorial/identity.ts');
const {reviewStepHash}=require('../../src/lib/audit/review-checkpoint.ts');
const {engineMatchesWorker,EDITORIAL_VERSION}=require('../../src/lib/editorial/contracts.ts');
test('rolling deployments require identical engine code and RAG, not identical UI commits',()=>{
 const fingerprint='a'.repeat(64);
 assert.equal(engineMatchesWorker({version:EDITORIAL_VERSION,commit:'previous-ui',engine_fingerprint:fingerprint},fingerprint),true);
 assert.equal(engineMatchesWorker({version:EDITORIAL_VERSION,engine_fingerprint:'b'.repeat(64)},fingerprint),false);
 assert.equal(engineMatchesWorker({version:EDITORIAL_VERSION},fingerprint),false);
 assert.equal(engineMatchesWorker({version:'old',engine_fingerprint:fingerprint},fingerprint),false);
 assert.equal(engineMatchesWorker({version:EDITORIAL_VERSION},''),false);
});
test('Python engine and Node worker compute the same runtime fingerprint',()=>{
 const {execFileSync}=require('node:child_process');
 const {engineFingerprint}=require('../../src/lib/editorial/engine-identity.ts');
 const actual=execFileSync('python3',['-c','from utils.engine_identity import engine_fingerprint; print(engine_fingerprint())'],{cwd:require('node:path').resolve(__dirname,'../../ai-engine'),encoding:'utf8'}).trim();
 assert.equal(engineFingerprint(),actual);
});
const matters=Array.from({length:32},(_,i)=>({id:`m${i}`,rawNotes:`Matter ${i} is pending`,publish_status:'non_publishable',confidentialityConfirmed:true}));
const state={selection_validated:true,selection_review_validated:true,strategy:{matters:matters.map((m,i)=>({matter_id:m.id,disposition:i<20?'core':'reserve'})),hero_matter_id:'m0'}};
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
 assert.doesNotMatch(j.issue.message,/Reanudar|Pulsa/);assert.match(j.issue.message,/No necesitas corregir textos/);assert.ok(!j.issue.message.includes('secret-uuid'));
});
test('durable tasks reuse completed roles instead of executing the next paid role under the wrong label',()=>{
 const {reviewTaskDisposition}=require('../../src/lib/audit/review-checkpoint.ts');
 assert.equal(reviewTaskDisposition('strategy','development'),'reuse');
 assert.equal(reviewTaskDisposition('development','writer'),'reuse');
 assert.equal(reviewTaskDisposition('writer','done'),'reuse');
 assert.equal(reviewTaskDisposition('development','development'),'run');
 assert.equal(reviewTaskDisposition('writer','development'),'out_of_order');
});

test('mutable research cache does not change runtime identity but methodology does',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {engineFingerprint}=require('../../src/lib/editorial/engine-identity.ts');
 const {execFileSync}=require('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rankpilot-identity-'));
 try {
  for(const name of ['main.py','requirements.txt','Dockerfile'])fs.writeFileSync(path.join(root,name),'fixture');
  for(const dir of ['agents','chains','config','core','rag_knowledge','templates','utils'])fs.mkdirSync(path.join(root,dir));
  const py=()=>execFileSync('python3',['-c','from utils.engine_identity import engine_fingerprint; import sys; print(engine_fingerprint(sys.argv[1]))',root],{cwd:path.resolve(__dirname,'../../ai-engine'),encoding:'utf8'}).trim();
  const before=engineFingerprint(root);assert.equal(py(),before);
  fs.mkdirSync(path.join(root,'config/benchmark_cache'));fs.writeFileSync(path.join(root,'config/benchmark_cache/live.json'),'cached research');
  assert.equal(engineFingerprint(root),before);assert.equal(py(),before);
  fs.writeFileSync(path.join(root,'rag_knowledge/rules.md'),'New methodology');
  assert.notEqual(engineFingerprint(root),before);assert.equal(py(),engineFingerprint(root));
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('concrete punctuation defects are repaired automatically without making optional style preferences a user task',()=>{
 const defect={code:'EDITORIAL_STYLE',severity:'warning',owner:'rankpilot',scope:'submission',field_path:'b10',artifact_quote:'The team,, advised.',message:'Remove duplicate comma.'};
 const data={editorial_development:{b10:'The team,, advised.'},final_artifact_review:{judge:{defects:[defect]}}};
 assert.deepEqual(targetedRepair(data),{tasks:['development','audit','artifact'],letter:true});
 assert.equal(targetedRepair({...data,final_artifact_review:{judge:{defects:[{...defect,artifact_quote:'',field_path:null,message:'I prefer shorter prose.'}]}}}),null);
});
test('a disputed optional sector is withdrawn automatically only with the explicit editorial containment verdict',()=>{
 const defect={code:'SOURCE_CONFLICT',severity:'critical',owner:'rankpilot',scope:'submission',field_path:'client_sector',conflict_resolution:'omit_nonessential_descriptor'};
 const data={editorial_development:{},final_artifact_review:{judge:{defects:[defect]}}};
 assert.deepEqual(targetedRepair(data),{tasks:['development','audit','artifact'],letter:true});
 for(const changes of [{owner:'user'},{field_path:'value'},{conflict_resolution:'confirm_source'}]){
  assert.equal(targetedRepair({...data,final_artifact_review:{judge:{defects:[{...defect,...changes}]}}}),null);
 }
});
