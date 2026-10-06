require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {NextRequest}=require('next/server');const JSZip=require('jszip');
let state,calls,conflict,rejectFinal;
const source='Synthetic Buyer retained the team in a tax appeal in Mexico. Partner Sofia Vega led the representation. The disputed assessment is MXN 1000000. The appeal remains pending; there has been no ruling.';
const b10='Synthetic Legal advises on tax disputes in Mexico. The supplied mandate is a pending tax appeal. No ranking or broader team size is claimed.';
function reset(){conflict=false;rejectFinal=false;calls=[];state={id:'s',userId:'u',updatedAt:new Date('2026-01-01'),targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',currentBand:null,status:'Draft',matters:[{id:'m1',submissionId:'s',client:'Synthetic Buyer',name:'Tax appeal',leadPartner:'Sofia Vega',summary:source,rawNotes:source,source_excerpt:source,optimizedText:source,value:'MXN 1000000',isConfidential:false,confidentialityConfirmed:true,publish_status:'publishable'}],chambersData:{firm_name:'Synthetic Legal',original_b10:b10,enhanced_b7:b10,draft_revision:1}};state.chambersData.matters=structuredClone(state.matters);}
const db=box=>({submission:{findUnique:async()=>structuredClone(box),updateMany:async({data})=>{if(conflict)return{count:0};Object.assign(box,data);return{count:1};},update:async({data})=>Object.assign(box,data)},matter:{updateMany:async({where,data})=>{Object.assign(box.matters.find(m=>m.id===where.id),data);return{count:1};}},user:{findUnique:async()=>null}});
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async fn=>{const pending=structuredClone(state);const result=await fn(db(pending));state=pending;return result;}:db(state)[key]});
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:prisma};if(name==='@/utils/supabase/server')return{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})};return load.call(this,name,...args);};
const {POST}=require('../../src/app/api/optimize/complete/route.ts');
const {deliveryInputHash,artifactHash}=require('../../src/lib/audit/artifact-binding.ts');
global.fetch=async(url,options)=>{
 const payload=JSON.parse(options.body);calls.push({url,payload});
 if(url.endsWith('/review-package'))return Response.json({success:true,selection_validated:true,ranking_verification:{status:'unavailable'},strategy:{matters:[{matter_id:'m1',disposition:'core',rationale:'Pending tax appeal',source_quote:'The appeal remains pending'}],hero_matter_id:'m1'},letter:{executive_assessment:'Pending tax appeal',portfolio:'One mandate',leadership:'Not provided',evidence_gaps:'Outcome pending',next_steps:'Update the outcome'},judge:{passed:true,defects:[]},release_verdict:{passed:true,status:'passed',errors:[]}});
 return Response.json({success:true,judge:{passed:!rejectFinal,defects:rejectFinal?[{severity:'critical',message:'Injected rendered claim defect'}]:[]}});
};
const complete=body=>POST(new NextRequest('http://localhost/api/optimize/complete',{method:'POST',body:JSON.stringify({submissionId:'s',...body})}));
test('completion defaults to the current ranking table and selected country without inventing a research period',async()=>{
 reset();state.guideRegion='Latin America — Mexico';
 assert.equal((await complete()).status,200);
 assert.equal(calls[0].payload.ranking_edition,'current');
 assert.equal(calls[0].payload.ranking_jurisdiction,'Mexico');
 assert.equal(calls[0].payload.research_period,null);
});
test('completion preserves the explicitly selected ranking scope and research period',async()=>{
 reset();Object.assign(state.chambersData,{ranking_edition:'2026',ranking_jurisdiction:'Brazil',research_period:{from:'2025-01-01',to:'2025-12-31'}});
 assert.equal((await complete()).status,200);
 assert.equal(calls[0].payload.ranking_edition,'2026');
 assert.equal(calls[0].payload.ranking_jurisdiction,'Brazil');
 assert.deepEqual(calls[0].payload.research_period,{from:'2025-01-01',to:'2025-12-31'});
});
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
test('rejected source selection is a proposal, never a canonical portfolio or approved artifact',async()=>{
 reset();const saved=global.fetch;
 global.fetch=async()=>Response.json({success:true,selection_validated:false,strategy:{matters:[{matter_id:'m1',disposition:'core'}],hero_matter_id:'m1'},release_verdict:{passed:false,status:'needs_review',errors:['Source quote not supported']}});
 try {assert.equal((await complete()).status,200);assert.equal(state.chambersData.canonical_matter_selection,null);assert.equal(state.chambersData.hero_matter_id,null);assert.equal(state.chambersData.approved_artifact,null);assert.deepEqual(state.chambersData.release_verdict.errors,['Source quote not supported']);} finally {global.fetch=saved;}
});
const {needsB10Optimization,hasValidatedSelection}=require('../../src/lib/audit/optimization-state.ts');
test('resume optimizes an imported enhanced B10 but preserves an existing revision',()=>{
 assert.equal(needsB10Optimization({original_b10:b10,enhanced_b7:b10},b10),true);
 assert.equal(needsB10Optimization({original_b10:b10},'User edited narrative'),false);
 assert.equal(needsB10Optimization({original_b10:b10,b10_optimization:{source:b10,text:b10}},b10),false);
 assert.equal(needsB10Optimization({original_b10:b10,confirmed_source_b10:'New source',b10_optimization:{source:b10,text:b10}},'New source'),true);
 assert.equal(hasValidatedSelection({canonical_matter_selection:{core_matter_ids:['m1']},editorial_review:{strategy:{},letter:null,judge:null}}),false);
 assert.equal(hasValidatedSelection({canonical_matter_selection:{core_matter_ids:['m1']},editorial_review:{selection_validated:true}}),true);
});
const {POST:optimizeB10}=require('../../src/app/api/optimize/b10/route.ts');
test('B10 response records provenance only after successful persistent save',async()=>{
 reset();const saved=global.fetch;
 global.fetch=async()=>Response.json({success:true,enhanced_b10:'Source-grounded shortened narrative.'});
 try {
  const r=await optimizeB10(new NextRequest('http://localhost/api/optimize/b10',{method:'POST',body:JSON.stringify({submissionId:'s'})}));
  assert.equal(r.status,200);const result=await r.json();
  assert.equal(result.b10_optimization.source,b10);assert.equal(result.b10_optimization.text,'Source-grounded shortened narrative.');assert.ok(result.b10_optimization.strategy_hash);
  assert.deepEqual(state.chambersData.b10_optimization,result.b10_optimization);
  assert.equal(state.chambersData.enhanced_b7,result.enhanced_b10);
  assert.equal(state.chambersData.approved_artifact,null);
 }finally{global.fetch=saved;}
});

const {reviewInputHash,reviewPackage}=require('../../src/lib/audit/review-checkpoint.ts');
test('checkpointed completion never repeats strategy or audit, and caches the approved artifact',async()=>{
 reset();const review=await (await global.fetch('http://engine/review-package',{body:'{}'})).json();calls=[];
 state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.matters)),stage:'done',state:review,lease_until:0};
 assert.equal((await complete({checkpoint:true})).status,200);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/verify-rendered-package'));
 assert.equal(state.chambersData.review_checkpoint.lease_until,0);
 const again=await complete({checkpoint:true});assert.equal(again.status,200);assert.equal((await again.json()).cached,true);assert.equal(calls.length,1);
});
test('final artifact lease blocks overlapping paid review calls',async()=>{
 reset();state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.matters)),stage:'done',state:{},lease_until:Date.now()+300000};
 const result=await complete({checkpoint:true});assert.equal(result.status,202);assert.equal((await result.json()).pending,true);assert.equal(calls.length,0);
});
test('stale checkpoint cannot approve an edited draft',async()=>{
 reset();state.chambersData.review_checkpoint={input_hash:'stale',stage:'done',state:{}};
 assert.equal((await complete({checkpoint:true})).status,409);assert.equal(calls.length,0);
});
test('an already reviewed rejection does not pay for an unchanged Word again',async()=>{
 reset();rejectFinal=true;const review=await (await global.fetch('http://engine/review-package',{body:'{}'})).json();calls=[];
 state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.matters)),stage:'done',state:review,lease_until:0};
 await complete({checkpoint:true});const result=await complete({checkpoint:true});assert.equal((await result.json()).cached,true);assert.equal(calls.length,1);
});

test('a new review deliverable cannot reuse approval of an older letter with the same source inputs',async()=>{
 reset();const review=await (await global.fetch('http://engine/review-package',{body:'{}'})).json();calls=[];
 state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.matters)),stage:'done',state:review,lease_until:0};
 await complete({checkpoint:true});assert.equal(calls.length,1);
 state.chambersData.review_checkpoint.state.letter.executive_assessment='Changed executive assessment';
 const result=await complete({checkpoint:true});assert.equal(result.status,200);assert.equal(calls.length,2);
 assert.equal(calls[1].payload.letter.executive_assessment,'Changed executive assessment');
});

for (const rejected of [false,true]) test(`a single exact Word judge controls delivery after deterministic gates (rejected=${rejected})`,async()=>{
 reset();rejectFinal=rejected;
 const review=await (await global.fetch('http://engine/review-package',{body:'{}'})).json();calls=[];
 delete review.judge;review.render_gate={passed:true,status:'passed',errors:[]};
 review.release_verdict={passed:false,status:'awaiting_artifact_review',errors:[]};
 state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.matters)),stage:'done',state:review,lease_until:0};
 assert.equal((await complete({checkpoint:true})).status,200);
 assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/verify-rendered-package'));
 assert.equal(state.chambersData.release_verdict.passed,!rejected);
 assert.equal(Boolean(state.chambersData.approved_artifact),!rejected);
});

test('a renderer update retries only the exact Word and then caches its new verdict',async()=>{
 reset();rejectFinal=true;
 await complete();const before=calls.length;
 state.chambersData.completed_renderer_version=1;
 const {reviewPackage,reviewInputHash}=require('../../src/lib/audit/review-checkpoint.ts');
 const review=state.chambersData.editorial_review;
 state.chambersData.review_checkpoint={input_hash:reviewInputHash(reviewPackage(state,state.chambersData,state.chambersData.matters)),stage:'done',lease_until:0,state:review};
 await complete({checkpoint:true});
 assert.equal(calls.length,before+1);assert.ok(calls.at(-1).url.endsWith('/verify-rendered-package'));
 assert.equal(state.chambersData.completed_renderer_version,4);
 await complete({checkpoint:true});assert.equal(calls.length,before+1);
});

for (const rejected of [false,true]) test(`review policy update invalidates cached verdict (rejected=${rejected})`,async()=>{
 reset();rejectFinal=rejected;await complete();const before=calls.length;
 state.chambersData.completed_review_policy_version='review-core-v1.3';
 await complete();assert.equal(calls.length,before+2);
 assert.equal(state.chambersData.completed_review_policy_version,'review-core-v2.0');
 await complete();assert.equal(calls.length,before+2);
});

test('approval binds both actual Word files to one revision and reviews both texts',async()=>{
 reset();await complete();
 const artifact=state.chambersData.approved_artifact;
 assert.ok(artifact.audit_base64);assert.ok(artifact.audit_sha256);assert.ok(artifact.revision_id);
 const final=calls.find(c=>c.url.endsWith('/verify-rendered-package'));
 assert.ok(final.payload.package.rendered_artifact);assert.ok(final.payload.package.rendered_audit.includes('Strategic Audit'));
 const archive=await require('jszip').loadAsync(Buffer.from(artifact.audit_base64,'base64'));
 assert.ok((await archive.file('word/document.xml').async('string')).includes('Internal report linked'));
});
