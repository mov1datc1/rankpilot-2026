require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
let submission,job,calls=[],repairMode=false;
const db=()=>({submission:{findUnique:async()=>structuredClone(submission),updateMany:async({where,data})=>{if(where.updatedAt && +new Date(where.updatedAt)!==+new Date(submission.updatedAt))return{count:0};Object.assign(submission,data);return{count:1};},update:async({data})=>{Object.assign(submission,data);return structuredClone(submission);}},matter:{updateMany:async({where,data})=>{Object.assign(submission.matters.find(m=>m.id===where.id),data);return{count:1};}},user:{findUnique:async()=>null}});
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async fn=>{const old=structuredClone(submission);try{return await fn(db());}catch(e){submission=old;throw e;}}:key==='$executeRaw'?async(strings,...values)=>{
 if(strings.join('').includes('"ledger"=')) {
  if(job.status!=='running' || job.leaseToken!==values[9]) return 0;
  Object.assign(job,{status:values[0],tasks:JSON.parse(values[1]),cursor:values[2],stage:values[3],issue:JSON.parse(values[4]),resultHash:values[5],ledger:[...job.ledger,...JSON.parse(values[6])],leaseToken:null,leaseUntil:values[7]});return 1;
 }return 1;
}:db()[key]});
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:prisma};if(name==='@/utils/supabase/server')return{createClient:()=>{throw new Error('Worker must not need browser cookies');}};return load.call(this,name,...args);};
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
const {runJobStage}=require('../../src/lib/editorial/runner.ts');
function reset(){
 calls=[];repairMode=false;
 const matters=Array.from({length:3},(_,i)=>({id:`m${i}`,client:`Synthetic client ${i}`,rawNotes:`Client ${i} retained the team for a pending appeal. No decision has been issued.`,optimizedText:'',confidentialityConfirmed:true,publish_status:'non_publishable',isConfidential:true}));
 submission={id:'s',userId:'u',practiceArea:'Tax',targetDirectory:'Chambers',guideRegion:'Mexico',currentBand:'',updatedAt:new Date('2026-01-01'),status:'Draft',matters:structuredClone(matters),chambersData:{matters,firm_name:'Synthetic Firm',original_b10:'The team advises on tax appeals.',enhanced_b7:'',draft_revision:0}};
 const snapshot=sourceSnapshot(submission);job={id:'job',submissionId:'s',userId:'u',snapshot,sourceHash:stableHash(snapshot),status:'running',tasks:['selection'],cursor:0,stage:'selection',leaseToken:'initial',ledger:[]};
}
global.fetch=async(url,options)=>{
 const payload=JSON.parse(options.body);calls.push({url,payload});
 if(url.endsWith('/review-step')) {
  const state={...payload.state};
  if(payload.stage==='strategy') {
   state.strategy={matters:submission.matters.map((m,i)=>({matter_id:m.id,disposition:i<2?'core':'reserve',rationale:'Pending appeal',source_quote:'No decision has been issued.'})),hero_matter_id:'m0',thesis:'Tax appeals'};state.selection_validated=true;state.selection_review_validated=true;
  } else if(payload.stage==='development') {state.development_validated=true;state.development={version:'editorial-development-v1',candidates:[],b10:submission.chambersData.original_b10,c2:'Our case is supported by pending tax appeals.',matters:submission.matters.slice(0,2).map(m=>({matter_id:m.id,text:repairMode && m.id==='m0'?'The team won the appeal.':m.rawNotes}))};} else {state.letter={executive_assessment:'Tax appeals',portfolio:'Synthetic client 0 and Synthetic client 1. Synthetic client 2 is in reserve.',leadership:'No individual attribution supplied.',evidence_gaps:'Outcomes pending',next_steps:'Update outcomes when available.'};state.render_gate={passed:true,errors:[]};state.release_verdict={passed:false,status:'awaiting_artifact_review',errors:[]};}
  state.trace=[...(state.trace || []),{role:payload.stage,usage:{total_tokens:100},provider_request_id:`fake-${payload.stage}`}];
  return Response.json({success:true,next_stage:({strategy:'development',development:'writer',writer:'done'})[payload.stage],state});
 }
 if(url.endsWith('/optimize/matter'))return Response.json({success:true,optimized_text:repairMode && payload.matter.id==='m0'?'The team won the appeal.':payload.matter.rawNotes,trace:{usage:{total_tokens:30}}});
 if(url.endsWith('/optimize/b10'))return Response.json({success:true,enhanced_b10:payload.original_b10,trace:{usage:{total_tokens:20}}});
 assert.ok(url.endsWith('/verify-rendered-package'));
 assert.ok(payload.package.rendered_audit.includes('Synthetic client 0'));
 assert.ok(payload.package.rendered_artifact.includes('Synthetic client 0'));
 if(repairMode) return Response.json({success:true,judge:{passed:false,defects:[{code:'UNSUPPORTED_CLAIM',owner:'rankpilot',severity:'critical',scope:'submission',matter_id:'m0',source_quote:'No decision has been issued.',artifact_quote:'The team won the appeal.',message:'La fuente indica que no hay decisión; retirar la victoria.'}]},trace:[{role:'editor',usage:{total_tokens:150}}]});
 return Response.json({success:true,judge:{passed:true,defects:[]},trace:[{role:'editor',usage:{total_tokens:150}},{role:'portfolio_reviewer',usage:{total_tokens:25}}]});
};
async function stage(){job.status='running';job.leaseToken=`lease-${job.cursor}`;await runJobStage(structuredClone(job));}
test('a transient internal failure queues recovery on the same job and completes without a resume request',async()=>{
 reset();await stage();
 const sourceHash=job.sourceHash,normalFetch=global.fetch;
 try {
  global.fetch=async()=>Response.json({success:false,code:'AI_REVIEW_UNAVAILABLE',error:'Temporary upstream failure'},{status:502});
  const before=Date.now();await stage();
  assert.equal(job.status,'queued');assert.equal(job.cursor,1);assert.ok(+new Date(job.leaseUntil)>=before+330000);
  global.fetch=normalFetch;
  for(let i=0;i<5 && job.status==='queued';i++)await stage();
  assert.equal(job.status,'completed');assert.equal(job.id,'job');assert.equal(job.sourceHash,sourceHash);
  assert.equal(calls.filter(c=>c.payload.stage==='strategy').length,1);
  assert.equal(job.ledger.filter(e=>e.issue?.code==='AI_REVIEW_UNAVAILABLE').length,1);
  assert.ok(submission.chambersData.approved_artifact.audit_base64);
 } finally {global.fetch=normalFetch;}
});
test('worker completes real paired DOCX with strategy first, reserves untouched, no browser authentication',async()=>{
 reset();for(let guard=0;guard<9;guard++){await stage();if(job.status!=='queued')break;}
 assert.equal(job.status,'completed',JSON.stringify(job));assert.ok(submission.chambersData.approved_artifact.audit_base64);
 assert.equal(submission.chambersData.matters[2].optimizedText,'');
 assert.deepEqual(calls.map(c=>c.url.split('/').pop()),['review-step','review-step','review-step','verify-rendered-package']);
 assert.deepEqual(job.ledger.map(s=>s.stage),['selection','development','audit','artifact']);
 assert.equal(job.ledger.reduce((sum,s)=>sum+(s.trace?.usage?.total_tokens||0),0),475);
});
test('recreated coordinator continues from persisted cursor without rerunning selection',async()=>{
 reset();await stage();await stage();
 const saved=structuredClone(job);const count=calls.length;job=JSON.parse(JSON.stringify(saved));
 await stage();assert.equal(calls.length,count+1);assert.equal(calls.at(-1).payload.stage,'writer');assert.equal(calls.filter(c=>c.payload.stage==='strategy').length,1);
});
test('source changes stop the next stage before a paid request',async()=>{
 reset();await stage();const count=calls.length;submission.chambersData.matters[0].rawNotes='Corrected source';
 await stage();assert.equal(job.status,'superseded');assert.equal(calls.length,count);
});

test('artifact repair is targeted, carries evidence, and stops after one attempt',async()=>{
 reset();repairMode=true;
 for(let guard=0;guard<15;guard++){await stage();if(job.status!=='queued')break;}
 assert.equal(job.status,'needs_review',JSON.stringify(job));
 assert.equal(calls.filter(c=>c.url.endsWith('/verify-rendered-package')).length,2);
 const developments=calls.filter(c=>c.payload.stage==='development');
 assert.equal(developments.length,2);
 const repair=developments[1].payload.state;
 assert.equal(repair.development_reusable,true);
 assert.equal(repair.repair_feedback[0].matter_id,'m0');
 assert.equal(repair.repair_feedback[0].source_quote,'No decision has been issued.');
 assert.deepEqual(repair.development,developments[0].payload.state.development || submission.chambersData.editorial_development);
 assert.equal(calls.filter(c=>c.url.endsWith('/optimize/matter')).length,0);
 assert.equal(calls.filter(c=>c.payload.stage==='strategy').length,1);
 assert.equal(submission.chambersData.approved_artifact,null);
});

test('a new job after rejected development reuses selection and keeps each paid role in its own stage',async()=>{
 reset();await stage();await stage();
 const checkpoint=submission.chambersData.review_checkpoint;
 checkpoint.state.development_validated=false;checkpoint.state.errors=['Cita decisiva sin vínculo literal: m0'];
 job={...job,tasks:['selection'],cursor:0,stage:'selection',ledger:[],status:'queued'};
 const count=calls.length;
 await stage();assert.equal(calls.length,count);assert.equal(job.cursor,1);assert.equal(job.ledger[0].trace,null);
 await stage();assert.equal(calls.length,count+1);assert.equal(calls.at(-1).payload.stage,'development');assert.equal(job.ledger.at(-1).stage,'development');
 assert.equal(calls.at(-1).payload.state.development_reusable,true);
 await stage();assert.equal(calls.at(-1).payload.stage,'writer');
});

test('a completed but truncated response retries only that role once and accounts for failed usage',async()=>{
 reset();const originalFetch=global.fetch;let attempts=0;
 global.fetch=async(url,options)=>{const p=JSON.parse(options.body);if(url.endsWith('/review-step')&&p.stage==='writer'&&attempts++===0){calls.push({url,payload:p});return Response.json({success:false,code:'AI_OUTPUT_LIMIT',error:'Incomplete response',trace:{role:'writer',usage:{total_tokens:200}}},{status:502});}return originalFetch(url,options);};
 try {for(let i=0;i<8;i++){await stage();if(job.status!=='queued')break;}
 assert.equal(job.status,'completed',JSON.stringify(job));const writers=calls.filter(c=>c.payload.stage==='writer');assert.equal(writers.length,2);assert.equal(writers[1].payload.state.output_recovery_attempt,1);assert.equal(calls.filter(c=>c.payload.stage==='strategy').length,1);assert.equal(job.ledger.find(l=>l.issue?.code==='AI_OUTPUT_LIMIT').trace.usage.total_tokens,200);
 }finally{global.fetch=originalFetch;}
});
test('repeated truncation stops after the bounded recovery and never approves a partial document',async()=>{
 reset();const originalFetch=global.fetch;let attempts=0;
 global.fetch=async(url,options)=>{const p=JSON.parse(options.body);if(url.endsWith('/review-step')&&p.stage==='writer'){attempts++;return Response.json({success:false,code:'AI_OUTPUT_LIMIT',error:'Incomplete response',trace:{role:'writer',usage:{total_tokens:200}}},{status:502});}return originalFetch(url,options);};
 try{for(let i=0;i<8;i++){await stage();if(job.status!=='queued')break;}assert.equal(attempts,2);assert.equal(job.status,'failed');assert.ok(!submission.chambersData.approved_artifact);}finally{global.fetch=originalFetch;}
});

test('truncated final review retries the judge without regenerating approved upstream work',async()=>{
 reset();const originalFetch=global.fetch;let attempts=0,recovery;
 global.fetch=async(url,options)=>{const p=JSON.parse(options.body);if(url.endsWith('/verify-rendered-package')){attempts++;if(attempts===1)return Response.json({success:false,code:'AI_OUTPUT_LIMIT',trace:{role:'editor',usage:{total_tokens:201}}},{status:502});recovery=p.output_recovery;}return originalFetch(url,options);};
 try{for(let i=0;i<8;i++){await stage();if(job.status!=='queued')break;}assert.equal(job.status,'completed',JSON.stringify(job));assert.equal(attempts,2);assert.equal(recovery,true);assert.equal(calls.filter(c=>c.payload.stage==='writer').length,1);assert.equal(job.ledger.find(l=>l.issue?.code==='AI_OUTPUT_LIMIT').trace.usage.total_tokens,201);}finally{global.fetch=originalFetch;}
});

test('unstarted semantic review is checkpointed and automatically continued without user cooldown',async()=>{
 reset();const normal=global.fetch;let attempts=0;
 global.fetch=async(url,options)=>{
  const response=await normal(url,options);if(!url.endsWith('/review-step') || ++attempts!==1)return response;
  const result=await response.json();const s=result.state;
  s.selection_validated=false;s.selection_review_validated=false;s.selection_review_unavailable=true;s.selection_review_deferred=true;
  s.errors=['Review deferred before provider request'];s.selection_feedback={strategy:s.strategy,errors:s.errors,semantic_rejection:false};
  return Response.json({...result,next_stage:'done',state:s});
 };
 try{
  await stage();assert.equal(job.status,'queued');assert.equal(job.issue.code,'SELECTION_REVIEW_DEFERRED');
  assert.ok(submission.chambersData.review_checkpoint.state.strategy);
  await stage();assert.equal(job.status,'queued');assert.equal(job.stage,'development');
  assert.ok(calls[1].payload.state.selection_feedback.strategy);
  assert.equal(calls[1].payload.state.selection_feedback.semantic_rejection,false);
 }finally{global.fetch=normal;}
});
