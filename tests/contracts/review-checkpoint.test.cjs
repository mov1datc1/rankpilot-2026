require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const {NextRequest}=require('next/server');
let state, calls, conflict, failure, mutate, user;
function reset() {
  state={id:'s',userId:'u',updatedAt:new Date(0),targetDirectory:'Chambers',practiceArea:'Tax',matters:[{id:'m',rawNotes:'Pending appeal',confidentialityConfirmed:true,publish_status:'publishable'}],chambersData:{original_b10:'Tax team',enhanced_b7:'Tax disputes team'}};
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
  const next={strategy:'writer',writer:'editor',editor:'done'}[body.stage];
  return Response.json({success:true,next_stage:next,state:{...body.state,[body.stage]:{saved:true}}});
};
const step=()=>POST(new NextRequest('http://localhost/api/optimize/review-step',{method:'POST',body:JSON.stringify({submissionId:'s'})}));
test('resume runs one new role per call, then serves persisted completion without spending',async()=>{
  reset();for(let i=0;i<3;i++)assert.equal((await step()).status,200);
  assert.deepEqual(calls.map(c=>c.stage),['strategy','writer','editor']);
  assert.ok(calls[2].state.strategy.saved);assert.ok(calls[2].state.writer.saved);
  assert.equal((await (await step()).json()).done,true);assert.equal(calls.length,3);
});
test('quota exhaustion preserves earlier stages and returns a specific error without retry',async()=>{
  reset();await step();failure=true;
  const result=await step();assert.equal(result.status,502);assert.equal((await result.json()).code,'AI_CREDIT_EXHAUSTED');
  assert.equal(state.chambersData.review_checkpoint.stage,'writer');assert.ok(state.chambersData.review_checkpoint.state.strategy.saved);
  assert.equal(calls.length,2);failure=false;await step();assert.equal(calls[2].stage,'writer');
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
