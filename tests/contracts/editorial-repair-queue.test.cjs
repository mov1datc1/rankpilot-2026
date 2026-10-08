require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
let submission,last,inserts=0;
const tx={submission:{findUnique:async()=>submission,update:async({data})=>{submission={...submission,...data};return submission;}},$queryRaw:async(strings,...values)=>{const q=strings.join('?');if(q.startsWith('INSERT')){inserts++;return [{id:values[0],tasks:JSON.parse(values[5]),stage:values[6],ledger:JSON.parse(values[7])}];}if(q.includes('SELECT * FROM "EditorialJob"'))return [last];return [{id:'s'}];}};
const original=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:{$transaction:async f=>f(tx)}};return original.call(this,name,...args)};
const {enqueue}=require('../../src/lib/editorial/jobs.ts');const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');const {deliveryInputHash}=require('../../src/lib/audit/artifact-binding.ts');
function reset(){inserts=0;const source='The case remains pending.',text='The team won.';submission={id:'s',userId:'u',chambersData:{completed_review_input_hash:'old',review_checkpoint:{state:{},step_keys:{}},matters:[{id:'m',rawNotes:source,optimizedText:text,draft_provenance:{text_hash:stableHash(text)}}],final_artifact_review:{judge:{defects:[{severity:'critical',owner:'rankpilot',code:'UNSUPPORTED_CLAIM',scope:'submission',matter_id:'m',source_quote:source,artifact_quote:text}]}}}};last={status:'needs_review',sourceHash:stableHash(sourceSnapshot(submission)),resultHash:deliveryInputHash(submission)};}
test('explicit generation repair queues only supported stages and invalidates cached artifact verdict',async()=>{reset();assert.equal(await enqueue(submission,true),last);const job=await enqueue(submission,true,true);assert.deepEqual(job.tasks,['matter:m','audit','artifact']);assert.equal(job.ledger[0].status,'repair_requested');assert.equal(submission.chambersData.completed_review_input_hash,null);assert.equal(inserts,1);});
test('repair cannot duplicate an active job or turn an unsupported finding into a paid retry',async()=>{reset();last.status='running';assert.equal(await enqueue(submission,true,true),last);assert.equal(inserts,0);reset();submission.chambersData.final_artifact_review.judge.defects[0].owner='user';last.resultHash=deliveryInputHash(submission);await assert.rejects(()=>enqueue(submission,true,true),/AUTO_REPAIR_UNAVAILABLE/);assert.equal(inserts,0);});
test('editorial omission retains source-matching development key for bounded repair',async()=>{
 reset();const data=submission.chambersData;
 data.editorial_development={version:'editorial-development-v1',matters:[{matter_id:'m',text:'The team advised.'}]};
 data.review_checkpoint={step_keys:{strategy:'strategy-source-key',development:'development-source-key'},state:{development:data.editorial_development,development_validated:true}};
 data.final_artifact_review.judge.defects=[{severity:'critical',owner:'rankpilot',code:'EDITORIAL_OMISSION',scope:'submission',matter_id:'m',message:'Source-backed outcome omitted.'}];
 last.resultHash=deliveryInputHash(submission);last.sourceHash=stableHash(sourceSnapshot(submission));
 const job=await enqueue(submission,true,true);
 assert.deepEqual(job.tasks,['development','audit','artifact']);
 assert.equal(submission.chambersData.review_checkpoint.step_keys.development,'development-source-key');
 assert.equal(submission.chambersData.review_checkpoint.state.development_validated,false);
 assert.deepEqual(submission.chambersData.review_checkpoint.state.development,data.editorial_development);
});
test('Audit-only defect preserves Submission development and prior letter for a bounded patch',async()=>{
 reset();const data=submission.chambersData;data.editorial_development={version:'editorial-development-v1'};
 const letter={executive_assessment:'Wrong diagnosis',portfolio:'Unchanged portfolio'};
 data.review_checkpoint={state:{letter,development:data.editorial_development,development_validated:true},step_keys:{development:'same-source',writer:'old-letter'}};
 data.final_artifact_review.judge.defects=[{severity:'critical',owner:'rankpilot',code:'UNSUPPORTED_CLAIM',scope:'letter',message:'Wrong diagnostic.'},{severity:'critical',owner:'rankpilot',code:'EDITORIAL_OMISSION',scope:'submission',message:'La aceptación editorial no está completa: executive_audit'}];
 last.resultHash=deliveryInputHash(submission);last.sourceHash=stableHash(sourceSnapshot(submission));
 const job=await enqueue(submission,true,true);
 assert.deepEqual(job.tasks,['audit','artifact']);assert.deepEqual(submission.chambersData.review_checkpoint.state.letter,letter);
 assert.equal(submission.chambersData.review_checkpoint.state.development_validated,true);
 assert.equal(submission.chambersData.review_checkpoint.state.letter_repair_requested,true);
});
