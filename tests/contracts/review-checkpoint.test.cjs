require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const {NextRequest}=require('next/server');
let state, calls, conflict, failure, mutate, user;
function reset() {
  state={id:'s',userId:'u',updatedAt:new Date(0),targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',matters:[{id:'m',rawNotes:'Pending appeal',confidentialityConfirmed:true,publish_status:'publishable'}],chambersData:{original_b10:'Tax team',enhanced_b7:'Tax disputes team'}};
  calls=[];conflict=false;failure=false;mutate=false;user={id:'u'};
}
const prisma={user:{findUnique:async()=>null},submission:{
  findUnique:async()=>structuredClone(state),
  updateMany:async({where,data})=>{
    if(conflict || where.updatedAt.getTime()!==state.updatedAt.getTime()) return {count:0};
    Object.assign(state,data);state.updatedAt=new Date(Math.max(Date.now(),where.updatedAt.getTime()+1));return {count:1};
  }
}};
const load=Module._load;
Module._load=function(name,...args){
  if(name==='@/lib/prisma')return {__esModule:true,default:prisma};
  if(name==='@/utils/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user}})}})};
  return load.call(this,name,...args);
};
const {POST}=require('../../src/app/api/optimize/review-step/route.ts');
const {reviewInputHash,reviewPackage}=require('../../src/lib/audit/review-checkpoint.ts');
global.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(mutate){state.chambersData.original_b10='Concurrent new source';state.updatedAt=new Date(state.updatedAt.getTime()+1);}
  if(failure)return Response.json({success:false,code:'AI_CREDIT_EXHAUSTED',error:'No credit'},{status:502});
  const next={strategy:'development',development:'writer',writer:'done'}[body.stage];
  const output=body.stage==='strategy'?{strategy:{saved:true,matters:[{matter_id:'m',disposition:'core'}]},selection_validated:true}:body.stage==='development'?{development_validated:true,development:{version:'editorial-development-v1',matters:[{matter_id:'m',text:'Pending appeal'}],candidates:[],b10:'Tax disputes team',c2:'Our coverage case.'}}:body.stage==='writer'?{letter:{saved:true},render_gate:{passed:true,errors:[]},release_verdict:{passed:false,status:'awaiting_artifact_review',errors:[]}}:{judge:{passed:true,defects:[]},release_verdict:{passed:true,errors:[]}};
  return Response.json({success:true,next_stage:next,state:{...body.state,...output}});
};
const step=()=>POST(new NextRequest('http://localhost/api/optimize/review-step',{method:'POST',body:JSON.stringify({submissionId:'s'})}));
test('resume runs one new role per call, then serves persisted completion without spending',async()=>{
  reset();for(let i=0;i<3;i++)assert.equal((await step()).status,200);
  assert.deepEqual(calls.map(c=>c.stage),['strategy','development','writer']);
  assert.ok(calls[1].state.strategy.saved);assert.ok(state.chambersData.review_checkpoint.state.letter.saved);
  assert.equal((await (await step()).json()).done,true);assert.equal(calls.length,3);
});
test('quota exhaustion preserves earlier stages and returns a specific error without retry',async()=>{
  reset();await step();failure=true;
  const result=await step();assert.equal(result.status,502);assert.equal((await result.json()).code,'AI_CREDIT_EXHAUSTED');
  assert.equal(state.chambersData.review_checkpoint.stage,'development');assert.ok(state.chambersData.review_checkpoint.state.strategy.saved);
  assert.equal(calls.length,2);failure=false;await step();assert.equal(calls[2].stage,'development');
});
test('active lease does not launch a duplicate paid request',async()=>{
  reset();const payload=reviewPackage(state,state.chambersData,state.matters);
  state.chambersData.review_checkpoint={input_hash:reviewInputHash(payload),stage:'strategy',state:{},lease_until:Date.now()+300000};
  assert.equal((await step()).status,202);assert.equal(calls.length,0);
});
test('source edit invalidates checkpoints and concurrent edit wins over stale generation',async()=>{
  reset();await step();state.chambersData.original_b10='New source';await step();assert.equal(calls[1].stage,'strategy');
  mutate=true;assert.equal((await step()).status,409);assert.equal(state.chambersData.original_b10,'Concurrent new source');
});
test('ownership, missing session and conflicting acquisition prevent model calls',async()=>{
  reset();user=null;assert.equal((await step()).status,401);
  user={id:'stranger'};assert.equal((await step()).status,404);
  user={id:'u'};conflict=true;assert.equal((await step()).status,409);assert.equal(calls.length,0);
});

test('editing prose reuses strategy and audit without a pre-render model call',async()=>{
  reset();for(let i=0;i<3;i++)await step();calls=[];
  state.chambersData.enhanced_b7='Edited department prose, same original source';
  const result=await step();assert.equal((await result.json()).done,true);
  assert.equal(calls.length,0);
  assert.ok(state.chambersData.review_checkpoint.state.strategy.saved);assert.ok(state.chambersData.review_checkpoint.state.letter.saved);
});

test('editing a candidate role reconsiders selection, personal strategy and leadership',async()=>{
  reset();state.chambersData.lawyers=[{name:'Sofia Vega',isPartner:false}];
  for(let i=0;i<3;i++)await step();calls=[];
  state.chambersData.lawyers[0].isPartner=true;
  await step();await step();await step();await step();assert.deepEqual(calls.map(c=>c.stage),['strategy','development','writer']);
  assert.equal(calls[0].state.strategy,undefined);assert.equal(calls[0].state.letter,undefined);
});

test('changing source facts invalidates every dependent deliverable',async()=>{
  reset();for(let i=0;i<3;i++)await step();calls=[];
  state.chambersData.matters[0].rawNotes='New source: a ruling has now been issued';
  for(let i=0;i<3;i++)await step();assert.deepEqual(calls.map(c=>c.stage),['strategy','development','writer']);
});

test('expired evidence restarts verification and active edited requests cannot duplicate a paid role',async()=>{
  reset();for(let i=0;i<3;i++)await step();calls=[];
  state.chambersData.review_checkpoint.created_at=Date.now()-86400001;
  await step();assert.equal(calls[0].stage,'strategy');
  state.chambersData.review_checkpoint.lease_until=Date.now()+300000;
  state.chambersData.original_b10='A source edited during generation';
  assert.equal((await step()).status,202);assert.equal(calls.length,1);
});

test('review criteria version is shared with Python and old editorial outputs are rerun',async()=>{
 const {REVIEW_POLICY_VERSION}=require('../../src/lib/audit/review-checkpoint.ts');
 assert.equal(REVIEW_POLICY_VERSION,require('../../ai-engine/config/editorial_rules.v1.json').version);
 reset();await step();await step();await step();calls=[];
 // Previous release hashed role inputs without the review policy version.
 const {createHash}=require('node:crypto');
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
 const source=reviewPackage(state,state.chambersData,state.matters);
 delete source.b10_draft;delete source.c2_draft;delete source.lawyers;
 const legacyKey=createHash('sha256').update(JSON.stringify(stable({version:2,payload:{policy:'role-deliverables-v2-single-judge',stage:'strategy',source}}))).digest('hex');
 state.chambersData.review_checkpoint.step_keys.strategy=legacyKey;
 await step();await step();await step();assert.deepEqual(calls.map(c=>c.stage),['strategy','development','writer']);
 await step();assert.equal(calls.length,3);
});

test('failed selection retries once on the next request with diagnostics and no source edits',async()=>{
 reset();await step();const source=structuredClone(state.matters);
 const saved=state.chambersData.review_checkpoint;
 saved.stage='done';saved.state.selection_validated=false;saved.state.errors=['Missing decision; mixed quote'];
 saved.state.letter={stale:true};calls=[];
 await step();assert.equal(calls.length,1);assert.equal(calls[0].stage,'strategy');
 assert.deepEqual(calls[0].state.selection_feedback.errors,['Missing decision; mixed quote']);
 assert.equal(calls[0].state.letter,undefined);assert.deepEqual(state.matters,source);
 await step();await step();await step();assert.deepEqual(calls.map(c=>c.stage),['strategy','development','writer']);
});

test('transport references resolve by the original register, never by source labels or sorted strategy',()=>{
 const {displayStrategyReferences}=require('../../src/lib/audit/review-checkpoint.ts');
 const matters=Array.from({length:26},(_,i)=>({id:`id-${i}`,client:`Client ${i}`,source_label:`MATTER NUMBER ${26-i}`}));
 matters[25].client='Hero Client';
 const strategy={hero_matter_id:'id-25',thesis:'M26 is the hero; M01 supports it. M260 is unknown.',pending_questions:['Confirm M26 activity.'],matters:[{matter_id:'id-25',rationale:'M26 leads.',source_quote:'M26 is a literal source token.'}]};
 const result=displayStrategyReferences(strategy,matters);
 assert.equal(result.thesis,'Hero Client is the hero; Client 0 supports it. M260 is unknown.');
 assert.equal(result.hero_matter_id,strategy.hero_matter_id);assert.equal(result.matters[0].source_quote,strategy.matters[0].source_quote);assert.equal(strategy.thesis.startsWith('M26'),true);
});
