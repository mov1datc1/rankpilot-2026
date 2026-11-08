require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {canResumeSelectionProgress}=require('../../src/lib/editorial/selection-recovery.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
function fixture(){
 const ids=['a','b','c','d','new'];
 const checks=Object.fromEntries(ids.map(id=>[id,{status:['b','new'].includes(id)?'repair_required':'supported',evidence_bound:true}]));
 const state={selection_diagnostic_invalid:false,selection_validated:false,selection_review_validated:false,selection_review_attempts:2,selection_repair_attempts:1,
  selection_failure_history:[['a','b','c','d'],['b','new']],trace:[{usage:{total_tokens:55}}],strategy:{matters:ids.map(matter_id=>({matter_id,disposition:'core'}))},
  selection_review:{checks},selection_feedback:{failed_checks:{b:checks.b,new:checks.new}}};
 const source={id:'s',userId:'u',targetDirectory:'Chambers',practiceArea:'Labour & Employment',matters:[],chambersData:{matters:ids.map(id=>({id,rawNotes:'The firm negotiated collective agreements.'})),review_checkpoint:{created_at:Date.now(),step_keys:{strategy:'saved-key'},state}}};
 const sourceHash=stableHash(sourceSnapshot(source));
 const job={id:'j',submissionId:'s',userId:'u',status:'failed',stage:'selection',cursor:0,tasks:['selection'],sourceHash,ledger:[{stage:'selection',worker_commit:'old-build',trace:{usage:{total_tokens:55}}}],issue:{owner:'rankpilot',code:'SELECTION_REJECTED',retryable:false}};
 return {source,state,sourceHash,job};
}
test('smaller mixed batch can continue only after fix with original remaining allowances',()=>{
 const {source,state,sourceHash,job}=fixture(),before=structuredClone({source,job});
 assert.equal(canResumeSelectionProgress(job,source.chambersData,sourceHash,'fixed-build'),true);
 assert.deepEqual({source,job},before);
 for(const changed of [{...job,status:'running'},{...job,cursor:1},{...job,issue:{...job.issue,owner:'user'}},{...job,ledger:[...job.ledger,{status:'selection_progress_recovery_requested'}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{unknown_calls:1}}}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:1200000}}}]}]) assert.equal(canResumeSelectionProgress(changed,source.chambersData,sourceHash,'fixed-build'),false);
 for(const delta of [{selection_review_attempts:3},{selection_repair_attempts:2},{selection_diagnostic_invalid:true},{selection_failure_history:[['a','b'],['b','new']]},{selection_review:{checks:{}}},{trace:[]}]) assert.equal(canResumeSelectionProgress(job,{...source.chambersData,review_checkpoint:{state:{...state,...delta}}},sourceHash,'fixed-build'),false);
 for(const created_at of [Date.now()-86400001,Date.now()+60000,undefined]) assert.equal(canResumeSelectionProgress(job,{...source.chambersData,review_checkpoint:{...source.chambersData.review_checkpoint,created_at}},sourceHash,'fixed-build'),false);
 assert.equal(canResumeSelectionProgress(job,source.chambersData,'changed-source','fixed-build'),false);
 assert.equal(canResumeSelectionProgress(job,source.chambersData,sourceHash,'old-build'),false);
});
test('progress continuation enqueues exactly once without replacing job, source, ledger or counters',async()=>{
 const {source,sourceHash,job,state}=fixture();let updates=0;const before=structuredClone(state);
 const db={submission:{findUnique:async()=>structuredClone(source)},$queryRaw:async(strings,...values)=>{
  const sql=strings.join('?');if(sql.includes('FOR UPDATE'))return [{id:'s'}];if(sql.includes('SELECT * FROM "EditorialJob"'))return [structuredClone(job)];
  if(sql.includes('UPDATE "EditorialJob"')){updates++;const marker=JSON.parse(values.find(v=>typeof v==='string'&&v.startsWith('[{')));job.ledger.push(...marker);job.status='queued';job.issue=null;return [structuredClone(job)];}
  throw Error('Unexpected database operation');
 }};db.$transaction=async fn=>fn(db);
 const load=Module._load,env=process.env.VERCEL_GIT_COMMIT_SHA;
 Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:db};return load.call(this,name,...args)};process.env.VERCEL_GIT_COMMIT_SHA='fixed-build';
 try{
  delete require.cache[require.resolve('../../src/lib/editorial/jobs.ts')];const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');
  const pub=publicJob(job,source);assert.equal(pub.canResumeResidual,true);assert.equal(pub.canResumeSelectionProgress,true);
  const issue=require('../../src/lib/audit/review-actions.ts').reviewIssues(source.chambersData,[],pub)[0];assert.match(issue.action,/Continuar preparación/);
  assert.equal((await enqueue(source,true)).id,'j');assert.equal((await enqueue(source,true)).id,'j');assert.equal(updates,1);
  assert.equal(job.ledger.length,2);assert.equal(job.ledger[0].trace.usage.total_tokens,55);assert.equal(job.ledger[1].status,'selection_progress_recovery_requested');assert.equal(job.cursor,0);assert.equal(job.sourceHash,sourceHash);assert.deepEqual(state,before);
 }finally{Module._load=load;if(env===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=env}
});
