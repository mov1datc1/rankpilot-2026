require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const {NextRequest}=require('next/server');
let state, extracted, failCreate=false, failUpdate=false, conflict=false;
const reset=()=>{state={submission:{id:'s',userId:'u',updatedAt:new Date('2026-01-01'),targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',chambersData:{original_b10:'old',release_verdict:{passed:true,status:'passed'}}},matters:[{id:'old',client:'Original',submissionId:'s'}]};extracted={success:true,ingestion_quality:{status:'ready_for_review',matters_found:1},matters:[{client:'New',summary:'Source narrative',confidentialityConfirmed:false,publish_status:'confirmation_required',isConfidential:false}]};failCreate=false;failUpdate=false;conflict=false;};
const apiFor=box=>({submission:{findUnique:async()=>({...box.submission,matters:box.matters}),updateMany:async({data})=>{if(conflict)return {count:0};Object.assign(box.submission,data);return {count:1};},update:async({data})=>{if(failUpdate)throw Error('Injected write failure');Object.assign(box.submission,data);return box.submission;}},matter:{deleteMany:async()=>{box.matters=[];return {count:1};},create:async({data})=>{if(failCreate)throw Error('Injected create failure');const m={id:'new',...data};box.matters.push(m);return m;},updateMany:async({where,data})=>{const m=box.matters.find(m=>m.id===where.id);if(m)Object.assign(m,data);return {count:m?1:0};}},user:{findUnique:async()=>null,upsert:async()=>({id:'u'})}});
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async fn=>{const pending=structuredClone(state);const result=await fn(apiFor(pending));state=pending;return result;}:apiFor(state)[key]});
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:prisma};if(name==='@/utils/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})};return load.call(this,name,...args);};
const {POST}=require('../../src/app/api/extract-document/route.ts');
const {GET}=require('../../src/app/api/generate-docx/route.ts');
const {updateSubmissionValidatedData}=require('../../src/app/actions/submissions.ts');
global.fetch=async()=>new Response(JSON.stringify(extracted),{headers:{'Content-Type':'application/json'}});
const extract=()=>POST(new NextRequest('http://localhost/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'s',text:'source'})}));
test('empty successful extractor response preserves old draft',async()=>{reset();extracted.matters=[];assert.equal((await extract()).status,422);assert.equal(state.matters[0].id,'old');});
test('partial extraction preserves previous draft and reports sources',async()=>{reset();extracted.partial=true;extracted.source_errors=[{source:'missing.docx'}];const res=await extract();assert.equal(res.status,422);assert.equal((await res.json()).code,'PARTIAL_EXTRACTION');assert.equal(state.matters[0].id,'old');});
test('create failure rolls back deletion',async()=>{reset();failCreate=true;assert.equal((await extract()).status,500);assert.equal(state.matters[0].id,'old');});
test('revision conflict never deletes matters',async()=>{reset();conflict=true;assert.equal((await extract()).status,409);assert.equal(state.matters[0].id,'old');});
test('successful extraction restricts unknown permission and invalidates approval',async()=>{reset();assert.equal((await extract()).status,200);const m=state.submission.chambersData.matters[0];assert.equal(m.isConfidential,true);assert.equal(m.confidentialityConfirmed,false);assert.equal(m.publish_status,'confirmation_required');assert.equal(state.submission.chambersData.release_verdict.passed,false);});
test('failed save rolls back matter edits and returns explicit failure',async()=>{reset();failUpdate=true;const res=await updateSubmissionValidatedData('s',{matters:[{id:'old',client:'Edited'}]});assert.equal(res.success,false);assert.equal(state.matters[0].client,'Original');});
test('saving empty B10 clears it and invalidates approval',async()=>{reset();const res=await updateSubmissionValidatedData('s',{b10Text:''});assert.equal(res.success,true);assert.equal(state.submission.chambersData.enhanced_b7,'');assert.equal(state.submission.chambersData.original_b10,'old');assert.equal(state.submission.chambersData.release_verdict.passed,false);});
test('blocked verdict prevents optimized download despite existing matters',async()=>{reset();state.submission.chambersData.release_verdict={passed:false,status:'passed'};const res=await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=submission',{headers:{accept:'application/json'}}));assert.equal(res.status,409);});

test('stale browser revision cannot overwrite a newer draft',async()=>{reset();state.submission.chambersData.draft_revision=3;const res=await updateSubmissionValidatedData('s',{expectedRevision:2,b10Text:'stale'});assert.equal(res.success,false);assert.equal(state.submission.chambersData.original_b10,'old');});
const {deliveryInputHash,artifactHash}=require('../../src/lib/audit/artifact-binding.ts');
function approve(){
 state.submission.chambersData.matters=[{id:'old',client:'Original',isConfidential:false,publish_status:'publishable'}];
 const bytes=Buffer.from('opaque QA artifact');
 state.submission.chambersData.approved_artifact={base64:bytes.toString('base64'),sha256:artifactHash(bytes),input_hash:deliveryInputHash(state.submission)};
 return bytes;
}
test('final download serves the exact approved bytes',async()=>{reset();const bytes=approve();const res=await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=submission',{headers:{accept:'application/json'}}));assert.equal(res.status,200);assert.deepEqual(Buffer.from(await res.arrayBuffer()),bytes);});
test('changing source facts invalidates a previously approved artifact',async()=>{reset();approve();state.submission.chambersData.matters[0].client='Changed';const res=await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=submission',{headers:{accept:'application/json'}}));assert.equal(res.status,409);});
test('tampering with approved bytes blocks download',async()=>{reset();approve();state.submission.chambersData.approved_artifact.base64=Buffer.from('changed').toString('base64');const res=await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=submission',{headers:{accept:'application/json'}}));assert.equal(res.status,409);});
const {POST:verifyRanking}=require('../../src/app/api/verify-ranking/route.ts');
const rankingRequest=body=>verifyRanking(new NextRequest('http://localhost/api/verify-ranking',{method:'POST',body:JSON.stringify({submissionId:'s',edition:'2027',country:'Mexico',expectedRevision:0,...body})}));
test('ranking comparison requires explicit edition',async()=>{reset();assert.equal((await rankingRequest({edition:''})).status,400);});
test('ranking lookup never overwrites a stale browser revision',async()=>{reset();state.submission.chambersData.draft_revision=2;assert.equal((await rankingRequest({expectedRevision:0})).status,409);});
test('official mismatch is persisted distinctly and invalidates approval',async()=>{reset();state.submission.currentBand='Band 2';const original=global.fetch;global.fetch=async()=>Response.json({success:true,ranking_verification:{status:'verified_mismatch',declared_band:'Band 2',observed_band:'Band 3',checked_at:'2026-10-03T00:00:00Z'}});try{assert.equal((await rankingRequest({declaredBand:'Band 2'})).status,200);const data=state.submission.chambersData;assert.equal(data.ranking_verification.observed_band,'Band 3');assert.equal(state.submission.currentBand,'Band 2');assert.equal(data.release_verdict.passed,false);assert.equal(data.approved_artifact,null);}finally{global.fetch=original;}});
test('invalid research window is rejected without changing draft',async()=>{reset();const result=await updateSubmissionValidatedData('s',{researchPeriod:{from:'2026-10-01',to:'2026-01-01'}});assert.equal(result.success,false);assert.equal(state.submission.chambersData.research_period,undefined);});
test('research window preserves user provenance and invalidates approval',async()=>{reset();const result=await updateSubmissionValidatedData('s',{researchPeriod:{from:'2025-10-01',to:'2026-09-30'}});assert.equal(result.success,true);assert.equal(state.submission.chambersData.research_period.source,'User-confirmed submission instructions');assert.equal(state.submission.chambersData.release_verdict.passed,false);});
test('upstream no-matter response stays actionable and preserves the saved draft',async()=>{reset();const original=global.fetch;global.fetch=async()=>Response.json({code:'NO_LEGAL_MATTERS',error:'Internal provider text'},{status:422});try{const r=await extract();const body=await r.json();assert.equal(r.status,422);assert.equal(body.code,'NO_LEGAL_MATTERS');assert.ok(body.error.includes('Añade un documento'));assert.equal(state.matters[0].id,'old');}finally{global.fetch=original;}});

test('wizard resolution persists attribution and clears active conflicts without replacing source evidence',async()=>{
 reset();const original={id:'old',client:'Original',rawNotes:'Table USD 100; narrative MXN 5000',value:'USD 100',isConfidential:true,valueConflict:'Table and narrative disagree'};state.submission.chambersData.matters=[original];
 const result=await updateSubmissionValidatedData('s',{matters:[{...original,value:'MXN 5000',optimizedText:'Outdated prose',valueResolution:{confirmed:true,value:'MXN 5000',reason:'Source A page 3 confirms the amount in MXN.'}}]});
 assert.equal(result.success,true);const saved=state.submission.chambersData.matters[0];assert.equal(saved.valueConflict,'');assert.equal(saved.valueResolution.originalConflict,original.valueConflict);assert.equal(saved.valueResolution.confirmedBy,'u');assert.ok(saved.valueResolution.confirmedAt);assert.equal(saved.rawNotes,original.rawNotes);assert.equal(saved.optimizedText,'');assert.equal(state.matters[0].value,'MXN 5000');assert.deepEqual(result.matters,state.submission.chambersData.matters);
});
test('partial save retains unresolved discrepancy even if browser removes the flag',async()=>{
 reset();state.submission.chambersData.matters=[{id:'old',valueConflict:'Source discrepancy',isConfidential:true}];const result=await updateSubmissionValidatedData('s',{matters:[{id:'old',value:'USD 100',isConfidential:true}]});assert.equal(result.success,true);assert.equal(state.submission.chambersData.matters[0].valueConflict,'Source discrepancy');
});
test('server retains saved confidential status even when review requests publication',async()=>{reset();state.submission.chambersData.matters=[{id:'old',isConfidential:true,confidentialityConfirmed:true,publish_status:'confidential'}];const result=await updateSubmissionValidatedData('s',{matters:[{id:'old',isConfidential:false,confidentialityConfirmed:true,publish_status:'publishable',confidentialityStatus:'publishable'}]});assert.equal(result.success,true);assert.equal(state.matters[0].isConfidential,true);assert.equal(result.matters[0].publish_status,'confidential');});
test('technical preflight rejection preserves draft and explains affected file',async()=>{reset();const original=global.fetch;global.fetch=async()=>Response.json({code:'SOURCE_PREFLIGHT_FAILED',source_errors:[{source:'draft.pdf',code:'SOURCE_OCR_REQUIRED',pages:[2,4]}]},{status:422});try{const response=await extract();const body=await response.json();assert.equal(response.status,422);assert.ok(body.error.includes('draft.pdf'));assert.ok(body.error.includes('OCR'));assert.ok(body.error.includes('2, 4'));assert.equal(state.matters[0].id,'old');}finally{global.fetch=original;}});
test('successful but unvalidated extraction never replaces the draft',async()=>{reset();delete extracted.ingestion_quality;assert.equal((await extract()).status,422);assert.equal(state.matters[0].id,'old');});
test('source diagnostics and provenance survive successful extraction',async()=>{reset();extracted.source_reports=[{source:'draft.doc',detected_format:'doc',matter_count:1}];extracted.matters[0].source_document='draft.doc';assert.equal((await extract()).status,200);assert.deepEqual(state.submission.chambersData.source_reports,extracted.source_reports);assert.equal(state.submission.chambersData.matters[0].source_document,'draft.doc');});
test('new extraction cannot reuse department facts or approved bytes from an older source',async()=>{reset();Object.assign(state.submission.chambersData,{confirmed_source_b10:'Older confirmed department',enhanced_b7:'Older optimized department',approved_artifact:{base64:'old'}});assert.equal((await extract()).status,200);const data=state.submission.chambersData;assert.equal(data.original_b10,'');assert.equal(data.enhanced_b7,'');assert.equal(data.confirmed_source_b10,null);assert.equal(data.approved_artifact,null);});

test('confidentiality recheck reads only persisted sources and never writes the draft',async()=>{
 reset();state.submission.chambersData.sources=[{text:'Saved original source',name:'original.txt'}];
 extracted.confidentiality_contract_version=1;
 const before=structuredClone(state);const original=global.fetch;let payload;
 global.fetch=async(url,options)=>{payload=JSON.parse(options.body);return Response.json(extracted);};
 try {
  const r=await POST(new NextRequest('http://localhost/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'s',mode:'confidentiality_review',sources:[{text:'Untrusted replacement'}],text:'Untrusted replacement'})}));
  assert.equal(r.status,200);assert.deepEqual((await r.json()).matters,extracted.matters);assert.deepEqual(state,before);assert.deepEqual(payload.sources,before.submission.chambersData.sources);assert.notEqual(payload.user_input,'Untrusted replacement');
 } finally {global.fetch=original;}
});
test('confidentiality recheck without saved sources cannot create or replace a draft',async()=>{
 reset();const before=structuredClone(state);
 const r=await POST(new NextRequest('http://localhost/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'s',mode:'confidentiality_review',text:'Ignored inline source'})}));
 assert.equal(r.status,400);assert.deepEqual(state,before);
});
test('confidentiality provenance survives normal extraction persistence',async()=>{
 reset();extracted.matters[0].confidentialityEvidence={version:1,basis:'client_register',client_register:[{quote:'Synthetic | Y'}]};
 assert.equal((await extract()).status,200);assert.deepEqual(state.submission.chambersData.matters[0].confidentialityEvidence,extracted.matters[0].confidentialityEvidence);
});
test('confidentiality recheck cannot report success against an older backend',async()=>{
 reset();state.submission.chambersData.sources=[{text:'Saved source'}];const before=structuredClone(state);
 const r=await POST(new NextRequest('http://localhost/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'s',mode:'confidentiality_review'})}));
 assert.equal(r.status,503);assert.deepEqual(state,before);
});

test('role correction records the user, source and prior role without silently confirming an incomplete edit',async()=>{
 reset();state.submission.chambersData.lawyers=[{name:'Sofia Vega',isPartner:false,is_partner:false}];
 let result=await updateSubmissionValidatedData('s',{lawyers:[{name:'Sofia Vega',role:'Partner',isPartner:true}]});
 assert.equal(result.success,true);assert.equal(result.lawyers[0].roleResolution.confirmed,false);
 result=await updateSubmissionValidatedData('s',{lawyers:[{...result.lawyers[0],roleResolution:{role:'Partner',reason:'Official team listing reviewed for this period',confirmed:true}}]});
 const lawyer=result.lawyers[0];assert.equal(lawyer.roleResolution.confirmedBy,'u');assert.ok(lawyer.roleResolution.confirmedAt);assert.equal(lawyer.roleResolution.originalRole,'Associate');assert.equal(lawyer.is_partner,true);
 assert.equal(state.submission.chambersData.release_verdict.passed,false);
});

test('Audit download serves the companion bytes, never regenerates approved prose',async()=>{
 reset();approve();const data=state.submission.chambersData, bytes=Buffer.from('paired audit bytes');
 data.approved_artifact.audit_base64=bytes.toString('base64');data.approved_artifact.audit_sha256=artifactHash(bytes);
 const result=await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=audit'));
 assert.equal(result.status,200);assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes);
 data.approved_artifact.audit_base64=Buffer.from('tampered').toString('base64');
 assert.equal((await GET(new NextRequest('http://localhost/api/generate-docx?id=s&type=audit'))).status,409);
});

test('missing initial filters fail before extraction or database creation',async()=>{
 reset();const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json(extracted);};
 try {const result=await POST(new NextRequest('http://local/api/extract-document',{method:'POST',body:JSON.stringify({text:'Source text'})}));assert.equal(result.status,422);assert.equal((await result.json()).code,'SCOPE_REQUIRED');assert.equal(calls,0);}finally{global.fetch=original;}
});
test('contradictory source scope preserves the entire prior register and selected filters',async()=>{
 reset();const before=structuredClone(state);extracted.source_reports=[{source:'different.docx',source_scope:{practice_area:{value:'Labour & Employment',quote:'Practice Area: Labour & Employment'}}}];
 const result=await extract();assert.equal(result.status,422);const body=await result.json();assert.equal(body.code,'SCOPE_CONFLICT');assert.match(body.error,/different.docx/);assert.deepEqual(state,before);
});
test('browser context cannot override saved scope sent to the extractor',async()=>{
 reset();const original=global.fetch;let payload;global.fetch=async(_,options)=>{payload=JSON.parse(options.body);return Response.json(extracted);};
 try {const result=await POST(new NextRequest('http://local/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'s',text:'source',context:{practice_area:'Labour & Employment',directory:'Legal 500',jurisdiction:'Chile'}})}));assert.equal(result.status,200);assert.equal(payload.context.practice_area,'Tax');assert.equal(payload.context.directory,'Chambers');assert.equal(payload.context.jurisdiction,'Mexico');}finally{global.fetch=original;}
});
