require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {canResumeConstructionPlan}=require('../../src/lib/editorial/construction-recovery.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
const missing='Faltan comparaciones de reservas frente a su alternativa pertinente del núcleo.';
function fixture(){
 const matters=Array.from({length:31},(_,i)=>({id:'m'+i,rawNotes:'Original evidence '+i}));
 const plan={matters:matters.slice(0,20).map(m=>({matter_id:m.id})),candidates:[],comparisons:matters.slice(20,23).map(m=>({alternative_id:m.id,selected_id:'m0'}))};
 const state={selection_validated:true,selection_review_validated:true,development:{},development_validated:false,errors:[missing],
  strategy:{matters:matters.map((m,i)=>({matter_id:m.id,disposition:i<20?'core':'reserve'}))},
  trace:[{usage:{total_tokens:283847}}],repair_continuation:{version:'editorial-construction-v1',source_key:'source',content_hash:'empty-work',work:{},
  completed_units:[],pending_groups:[],failed_unit:{kind:'plan'},rejected_response:plan,validation_error:missing}};
 const source={id:'s',userId:'u',targetDirectory:'Chambers',practiceArea:'Labour & Employment',matters:[],chambersData:{matters,review_checkpoint:{state}}};
 const sourceHash=stableHash(sourceSnapshot(source));
 const job={id:'j',submissionId:'s',userId:'u',status:'failed',stage:'development',cursor:1,tasks:['selection','development','audit','artifact'],sourceHash,
  issue:{owner:'rankpilot',code:'DEVELOPMENT_REJECTED',retryable:false},ledger:[{stage:'development',worker_commit:'previous',trace:{usage:{total_tokens:283847}}}]};
 return {source,sourceHash,job};
}
test('retained 3-of-11 plan has one continuation after the contract fix',()=>{
 const {source,sourceHash,job}=fixture(),before=structuredClone({source,job});
 assert.equal(canResumeConstructionPlan(job,source.chambersData,sourceHash,'fixed'),true);
 assert.deepEqual({source,job},before);
 for(const change of [{status:'running'},{sourceHash:'changed'},{stage:'selection'},
  {ledger:[...job.ledger,{status:'construction_plan_recovery_requested'}]},
  {ledger:[{worker_commit:'previous',trace:{usage:{unknown_calls:1}}}]}]){
  assert.equal(canResumeConstructionPlan({...job,...change},source.chambersData,sourceHash,'fixed'),false);
 }
 assert.equal(canResumeConstructionPlan(job,source.chambersData,sourceHash,'previous'),false);
});
test('coverage recovery never reopens a source defect or an attempted completion',()=>{
 for(const mutation of ['other_error','completed_units','completion_attempted','foreign_id','duplicate','wrong_selected','missing_core']){
  const {source,sourceHash,job}=fixture(),p=source.chambersData.review_checkpoint.state.repair_continuation;
  if(mutation==='other_error')p.validation_error+='; Unbound personal attribution';
  if(mutation==='completed_units')p.completed_units=[{kind:'matters'}];
  if(mutation==='completion_attempted')p.plan_comparison_recovery={attempted:true};
  if(mutation==='foreign_id')p.rejected_response.comparisons[0].alternative_id='foreign';
  if(mutation==='duplicate')p.rejected_response.comparisons[1].alternative_id=p.rejected_response.comparisons[0].alternative_id;
  if(mutation==='wrong_selected')p.rejected_response.comparisons[0].selected_id='m21';
  if(mutation==='missing_core')p.rejected_response.matters.pop();
  assert.equal(canResumeConstructionPlan(job,source.chambersData,sourceHash,'fixed'),false,mutation);
 }
});
test('status offers an effective continuation; duplicate clicks preserve ledger and cursor',async()=>{
 const {source,sourceHash,job}=fixture(),before=structuredClone(source);let updates=0;
 const db={submission:{findUnique:async()=>structuredClone(source)},$queryRaw:async(strings,...values)=>{
  const sql=strings.join('?');if(sql.includes('FOR UPDATE'))return [{id:source.id}];
  if(sql.includes('SELECT * FROM "EditorialJob"'))return [structuredClone(job)];
  if(sql.includes('UPDATE "EditorialJob"')){
   assert.match(sql,/"ledger"="ledger" \|\|/);assert.doesNotMatch(sql,/"cursor"=/);
   updates++;job.status='queued';job.issue=null;
   job.ledger.push(...JSON.parse(values.find(v=>typeof v==='string'&&v.startsWith('[{'))));return [structuredClone(job)];
  }throw Error('Unexpected query');
 }};db.$transaction=async fn=>fn(db);
 const original=Module._load,env=process.env.VERCEL_GIT_COMMIT_SHA;
 Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return original.call(this,name,...args);};
 process.env.VERCEL_GIT_COMMIT_SHA='fixed';
 try {
  delete require.cache[require.resolve('../../src/lib/editorial/jobs.ts')];const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');
  const view=publicJob(job,source);assert.equal(updates,0);assert.equal(view.canResumeConstructionPlan,true);
  assert.equal(view.canResumeResidual,true);assert.equal(view.canRecheckDevelopment,false);
  assert.equal(view.nextAction.kind,'continue');assert.match(view.nextAction.description,/comparaciones pendientes/);
  const issue=require('../../src/lib/audit/review-actions.ts').reviewIssues(source.chambersData,[],view)[0];
  assert.equal(issue.destination,'retry-review');assert.match(issue.action,/Continuar preparación/);
  assert.equal((await enqueue(source,true)).id,'j');assert.equal((await enqueue(source,true)).id,'j');
  assert.equal(updates,1);assert.equal(job.cursor,1);assert.equal(job.sourceHash,sourceHash);
  assert.equal(job.ledger[0].trace.usage.total_tokens,283847);
  assert.equal(job.ledger.at(-1).status,'construction_plan_recovery_requested');
  assert.deepEqual(source,before);
 } finally {Module._load=original;if(env===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=env;}
});
