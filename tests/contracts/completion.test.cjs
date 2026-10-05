require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {NextRequest}=require('next/server');const JSZip=require('jszip');
let state,calls,conflict,rejectFinal;
const source='Synthetic Buyer retained the team in a tax appeal in Mexico. Partner Sofia Vega led the representation. The disputed assessment is MXN 1000000. The appeal remains pending; there has been no ruling.';
const b10='Synthetic Legal advises on tax disputes in Mexico. The supplied mandate is a pending tax appeal. No ranking or broader team size is claimed.';
function reset(){conflict=false;rejectFinal=false;calls=[];state={id:'s',userId:'u',updatedAt:new Date('2026-01-01'),targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',currentBand:null,status:'Draft',matters:[{id:'m1',submissionId:'s',client:'Synthetic Buyer',name:'Tax appeal',leadPartner:'Sofia Vega',summary:source,rawNotes:source,source_excerpt:source,optimizedText:source,value:'MXN 1000000',isConfidential:false,confidentialityConfirmed:true,publish_status:'publishable'}],chambersData:{firm_name:'Synthetic Legal',original_b10:b10,enhanced_b7:b10,draft_revision:1}};state.chambersData.matters=structuredClone(state.matters);}
const db=box=>({submission:{findUnique:async()=>structuredClone(box),updateMany:async()=>({count:conflict?0:1}),update:async({data})=>Object.assign(box,data)},matter:{updateMany:async({where,data})=>{Object.assign(box.matters.find(m=>m.id===where.id),data);return{count:1};}},user:{findUnique:async()=>null}});
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async fn=>{const pending=structuredClone(state);const result=await fn(db(pending));state=pending;return result;}:db(state)[key]});
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:prisma};if(name==='@/utils/supabase/server')return{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})};return load.call(this,name,...args);};
const {POST}=require('../../src/app/api/optimize/complete/route.ts');
const {deliveryInputHash,artifactHash}=require('../../src/lib/audit/artifact-binding.ts');
global.fetch=async(url,options)=>{
 const payload=JSON.parse(options.body);calls.push({url,payload});
 if(url.endsWith('/review-package'))return Response.json({success:true,ranking_verification:{status:'unavailable'},strategy:{matters:[{matter_id:'m1',disposition:'core',rationale:'Pending tax appeal',source_quote:'The appeal remains pending'}],hero_matter_id:'m1'},letter:{executive_assessment:'Pending tax appeal',portfolio:'One mandate',leadership:'Not provided',evidence_gaps:'Outcome pending',next_steps:'Update the outcome'},judge:{passed:true,defects:[]},release_verdict:{passed:true,status:'passed',errors:[]}});
 return Response.json({success:true,judge:{passed:!rejectFinal,defects:rejectFinal?[{severity:'critical',message:'Injected rendered claim defect'}]:[]}});
};
const complete=body=>POST(new NextRequest('http://localhost/api/optimize/complete',{method:'POST',body:JSON.stringify({submissionId:'s',...body})}));
test('completion reviews actual DOCX and binds exact bytes to current draft',async()=>{reset();const r=await complete();assert.equal(r.status,200);const data=state.chambersData;assert.equal(data.release_verdict.passed,true,JSON.stringify(data.release_verdict));assert.equal(calls.length,2);assert.ok(calls[1].payload.package.rendered_artifact.includes('MXN 1000000'));const bytes=Buffer.from(data.approved_artifact.base64,'base64');assert.ok((await JSZip.loadAsync(bytes)).file('word/document.xml'));assert.equal(data.approved_artifact.sha256,artifactHash(bytes));assert.equal(data.approved_artifact.input_hash,deliveryInputHash(state));});
test('final reviewer defect blocks artifact despite positive initial review',async()=>{reset();rejectFinal=true;const r=await complete();assert.equal(r.status,200);assert.equal(state.chambersData.release_verdict.passed,false);assert.equal(state.chambersData.approved_artifact,null);assert.equal(state.status,'Draft');assert.equal(calls.length,2);assert.ok(state.chambersData.release_verdict.errors[0].includes('Injected rendered claim defect'));});
test('concurrent save during review rejects completion without overwriting draft',async()=>{reset();conflict=true;const before=structuredClone(state);assert.equal((await complete()).status,409);assert.deepEqual(state,before);});
test('unsaved optimized text cannot bypass persisted version',async()=>{reset();assert.equal((await complete({matters:[{...state.matters[0],optimizedText:'Invented outcome'}]})).status,409);assert.equal(calls.length,0);});
const {POST:optimizeMatter}=require('../../src/app/api/optimize/matter/route.ts');
test('optimizing one mandate preserves a concurrent result for a second mandate with the same client',async()=>{
 reset();state.matters.push({...state.matters[0],id:'m2',name:'Separate appeal'});state.chambersData.matters=structuredClone(state.matters);
 const originalFetch=global.fetch;
 global.fetch=async(url,options)=>{const payload=JSON.parse(options.body);assert.equal(payload.matter.source_excerpt,source);state.chambersData.matters[1].optimizedText='Concurrent saved result';state.chambersData.draft_revision=2;return Response.json({success:true,optimized_text:'Updated first mandate'});};
 try{const r=await optimizeMatter(new NextRequest('http://localhost/api/optimize/matter',{method:'POST',body:JSON.stringify({submissionId:'s',matterId:'m1',matter:{source_excerpt:'Untrusted inline invention'}})}));assert.equal(r.status,200);assert.equal(state.chambersData.matters[0].optimizedText,'Updated first mandate');assert.equal(state.chambersData.matters[1].optimizedText,'Concurrent saved result');assert.equal(state.chambersData.draft_revision,3);}finally{global.fetch=originalFetch;}
});
test('same-mandate source edit during optimization rejects stale generated text',async()=>{
 reset();const originalFetch=global.fetch;
 global.fetch=async()=>{state.chambersData.matters[0].rawNotes='New confirmed source';return Response.json({success:true,optimized_text:'Stale text'});};
 try{const r=await optimizeMatter(new NextRequest('http://localhost/api/optimize/matter',{method:'POST',body:JSON.stringify({submissionId:'s',matterId:'m1'})}));assert.equal(r.status,409);assert.equal(state.chambersData.matters[0].rawNotes,'New confirmed source');assert.notEqual(state.chambersData.matters[0].optimizedText,'Stale text');}finally{global.fetch=originalFetch;}
});
test('pending source decisions block optimization before any model call',async()=>{
 for (const pending of [{valueConflict:'Table and narrative disagree'},{confidentialityConfirmed:false,publish_status:'confirmation_required'}]) {
  reset();Object.assign(state.chambersData.matters[0],pending);
  const response=await optimizeMatter(new NextRequest('http://localhost/api/optimize/matter',{method:'POST',body:JSON.stringify({submissionId:'s',matterId:'m1'})}));
  assert.equal(response.status,422);assert.equal(calls.length,0);
  assert.equal((await complete()).status,422);assert.equal(calls.length,0);
 }
});
