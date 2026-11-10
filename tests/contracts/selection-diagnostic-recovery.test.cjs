process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {canResumeSelectionDiagnostic}=require('../../src/lib/editorial/selection-recovery.ts');
const {SELECTION_DIAGNOSTIC_CONTRACT}=require('../../src/lib/audit/review-versions.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');

function fixture(){
 const source={id:'s',userId:'u',targetDirectory:'Chambers',practiceArea:'Labour & Employment',matters:[],chambersData:{matters:[{id:'a',rawNotes:'The team negotiated collective agreements.'}],review_checkpoint:{state:{selection_diagnostic_invalid:true,selection_validated:false,selection_review_attempts:2,selection_diagnostic_rechecks:1,selection_repair_attempts:0,trace:[{usage:{total_tokens:55}}],strategy:{matters:[{matter_id:'a',disposition:'core'}]},selection_review:{checks:{a:{status:'repair_required'}}}}}}};
 const sourceHash=stableHash(sourceSnapshot(source));
 const job={id:'j',submissionId:'s',userId:'u',status:'failed',stage:'selection',cursor:0,tasks:['selection'],sourceHash,ledger:[{stage:'selection',worker_commit:'old-build',trace:{usage:{total_tokens:55}}}],issue:{owner:'rankpilot',code:'SELECTION_DIAGNOSTIC_INVALID',retryable:false}};
 return {source,data:source.chambersData,sourceHash,job};
}
test('only an old known diagnostic with remaining normal allowances can continue',()=>{
 const {source,data,sourceHash,job}=fixture(),before=structuredClone({source,job});
 assert.equal(canResumeSelectionDiagnostic(job,data,sourceHash,'fixed-build'),true);
 assert.deepEqual({source,job},before);
 for(const changed of [{...job,status:'running'},{...job,stage:'development'},{...job,cursor:1},{...job,tasks:['selection','audit']},{...job,issue:{...job.issue,owner:'user'}},{...job,issue:{...job.issue,code:'SELECTION_REJECTED'}},{...job,ledger:[...job.ledger,{status:'selection_diagnostic_recovery_requested'}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:1200000}}}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{unknown_calls:1}}}]}]) assert.equal(canResumeSelectionDiagnostic(changed,data,sourceHash,'fixed-build'),false);
 assert.equal(canResumeSelectionDiagnostic(job,data,'changed-source','fixed-build'),false);
 assert.equal(canResumeSelectionDiagnostic(job,data,sourceHash,'old-build'),false);
 for(const changes of [{selection_review_attempts:3},{selection_repair_attempts:2},{selection_diagnostic_contract:SELECTION_DIAGNOSTIC_CONTRACT},{trace:[]},{trace:[{usage:{unknown_calls:1}}]},{selection_review:{checks:{}}}]){
  assert.equal(canResumeSelectionDiagnostic(job,{...data,review_checkpoint:{state:{...data.review_checkpoint.state,...changes}}},sourceHash,'fixed-build'),false);
 }
 assert.equal(require('../../ai-engine/config/editorial_rules.v1.json').selection_diagnostic_contract,SELECTION_DIAGNOSTIC_CONTRACT);
});

test('enqueue resumes once with the same job, cursor, checkpoints and accumulated ledger',async()=>{
 const {source,sourceHash,job}=fixture(),state=structuredClone(source.chambersData.review_checkpoint.state);let updates=0;
 const db={submission:{findUnique:async()=>structuredClone(source)},$queryRaw:async(strings,...values)=>{
  const sql=strings.join('?');
  if(sql.includes('FOR UPDATE'))return [{id:source.id}];
  if(sql.includes('SELECT * FROM "EditorialJob"'))return [structuredClone(job)];
  if(sql.includes('UPDATE "EditorialJob"')){
   updates++;const serialized=values.find(v=>typeof v==='string' && v.startsWith('[{'));
   const marker=JSON.parse(serialized);job.ledger.push(...marker);job.status='queued';job.issue=null;
   return [structuredClone(job)];
  }
  throw Error('Unexpected database operation');
 }};db.$transaction=async fn=>fn(db);
 const load=Module._load,env=process.env.VERCEL_GIT_COMMIT_SHA;
 Module._load=function(name,...args){if(name==='@/lib/prisma')return {__esModule:true,default:db};return load.call(this,name,...args);};
 process.env.VERCEL_GIT_COMMIT_SHA='fixed-build';
 try{
  delete require.cache[require.resolve('../../src/lib/editorial/jobs.ts')];
  const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');
  const publicBefore=publicJob(job,source);
  assert.equal(publicBefore.canResumeResidual,true);assert.equal(publicBefore.canResumeSelectionDiagnostic,true);
  const issues=require('../../src/lib/audit/review-actions.ts').reviewIssues(source.chambersData,[],publicBefore);
  assert.match(issues[0].action,/Continuar preparación/);
  const first=await enqueue(source,true),second=await enqueue(source,true);
  assert.equal(first.id,'j');assert.equal(second.id,'j');assert.equal(updates,1);
  assert.equal(job.cursor,0);assert.equal(job.sourceHash,sourceHash);assert.equal(job.ledger.length,2);
  assert.equal(job.ledger[0].trace.usage.total_tokens,55);assert.equal(job.ledger[1].status,'selection_diagnostic_recovery_requested');
  assert.deepEqual(source.chambersData.review_checkpoint.state,state);
 }finally{Module._load=load;if(env===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=env;}
});
