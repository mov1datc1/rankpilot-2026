process.env.EDITORIAL_ENFORCE_TOKEN_BUDGET='true';
process.env.EDITORIAL_TOKEN_BUDGET='1200000';
require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {canRecheckDevelopment}=require('../../src/lib/editorial/development-recheck.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
function fixture(){
 const source={id:'s',userId:'u',targetDirectory:'Chambers',practiceArea:'Labour & Employment',matters:[],chambersData:{matters:[{id:'a',rawNotes:'The original source.'}],review_checkpoint:{state:{selection_validated:true,selection_review_validated:true,selection_review_attempts:3,development:{candidates:[]},development_validated:false,errors:['A local validation failed.'],trace:[{usage:{total_tokens:55}}]}}}};
 const sourceHash=stableHash(sourceSnapshot(source));
 const job={id:'j',submissionId:'s',userId:'u',status:'failed',stage:'development',cursor:1,tasks:['selection','development','audit','artifact'],sourceHash,issue:{owner:'rankpilot',code:'DEVELOPMENT_REJECTED',retryable:true},ledger:[{stage:'development',worker_commit:'old-build',trace:{usage:{total_tokens:55}}}]};
 return {source,sourceHash,job};
}
test('one saved-development recheck requires known usage, unchanged source and no unresolved semantic judge',()=>{
 const {source,sourceHash,job}=fixture(),data=source.chambersData,before=structuredClone({source,job});
 assert.equal(canRecheckDevelopment(job,data,sourceHash,'fixed-build'),true);assert.deepEqual({source,job},before);
 for(const next of [{...job,status:'running'},{...job,stage:'selection'},{...job,issue:{...job.issue,owner:'user'}},{...job,ledger:[...job.ledger,{status:'development_recheck_requested'}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{unknown_calls:1}}}]},{...job,ledger:[{worker_commit:'old-build',trace:{usage:{total_tokens:1200000}}}]}])assert.equal(canRecheckDevelopment(next,data,sourceHash,'fixed-build'),false);
 assert.equal(canRecheckDevelopment(job,data,'changed-source','fixed-build'),false);assert.equal(canRecheckDevelopment(job,data,sourceHash,'old-build'),false);
 for(const patch of [{selection_validated:false},{trace:[]},{trace:[{usage:{unknown_calls:1}}]},{judge:{passed:false}},{repair_feedback:[{severity:'critical'}]},{repair_feedback:[{artifact_quote:'Existing rejected text.'}]}])assert.equal(canRecheckDevelopment(job,{...data,review_checkpoint:{state:{...data.review_checkpoint.state,...patch}}},sourceHash,'fixed-build'),false);
 assert.equal(canRecheckDevelopment(job,{...data,final_artifact_review:{judge:{passed:false}}},sourceHash,'fixed-build'),false);
});
test('recheck enqueue preserves the same ledger, source, paid reviews and saved proposal',async()=>{
 const {source,sourceHash,job}=fixture(),state=structuredClone(source.chambersData.review_checkpoint.state);let updates=0;
 const db={submission:{findUnique:async()=>structuredClone(source)},$queryRaw:async(strings,...values)=>{
  const sql=strings.join('?');if(sql.includes('FOR UPDATE'))return [{id:'s'}];if(sql.includes('SELECT * FROM "EditorialJob"'))return [structuredClone(job)];
  if(sql.includes('UPDATE "EditorialJob"')){updates++;const marker=JSON.parse(values.find(v=>typeof v==='string'&&v.startsWith('[{')));job.status='queued';job.issue=null;job.ledger.push(...marker);return [structuredClone(job)];}throw Error('Unexpected query');
 }};db.$transaction=async fn=>fn(db);
 const original=Module._load,env=process.env.VERCEL_GIT_COMMIT_SHA;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return original.call(this,name,...args);};process.env.VERCEL_GIT_COMMIT_SHA='fixed-build';
 try{delete require.cache[require.resolve('../../src/lib/editorial/jobs.ts')];const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');const publicState=publicJob(job,source);assert.equal(publicState.canRecheckDevelopment,true);assert.equal(publicState.canResumeResidual,true);
 const issue=require('../../src/lib/audit/review-actions.ts').reviewIssues(source.chambersData,[],publicState)[0];assert.match(issue.message,/no vuelve a redactarlo/);
 assert.equal((await enqueue(source,true)).id,'j');assert.equal((await enqueue(source,true)).id,'j');assert.equal(updates,1);assert.equal(job.cursor,1);assert.equal(job.sourceHash,sourceHash);assert.equal(job.ledger[0].trace.usage.total_tokens,55);assert.equal(job.ledger[1].status,'development_recheck_requested');assert.deepEqual(source.chambersData.review_checkpoint.state,state);
 }finally{Module._load=original;if(env===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=env;}
});

test('a skipped structured correction resumes repair rather than a validator-only dead end',async()=>{
 const {source,sourceHash,job}=fixture(),s=source.chambersData.review_checkpoint.state;
 Object.assign(s.development,{case_plan:{institutional_arguments:[]},institutional_execution:[]});
 s.repair_report={corrected_paths:['candidates/0'],failed_paths:['case_plan','institutional_execution'],retry_paths:['candidates/0'],surgical_retries:1,unresolved:[]};
 let updates=0;
 const db={submission:{findUnique:async()=>structuredClone(source)},$queryRaw:async(strings,...values)=>{
  const sql=strings.join('?');if(sql.includes('FOR UPDATE'))return [{id:'s'}];if(sql.includes('SELECT * FROM "EditorialJob"'))return [structuredClone(job)];
  if(sql.includes('UPDATE "EditorialJob"')){updates++;job.status='queued';job.ledger.push(...JSON.parse(values.find(v=>typeof v==='string'&&v.startsWith('[{'))));return [structuredClone(job)];}throw Error('Unexpected query');
 }};db.$transaction=async fn=>fn(db);
 const original=Module._load,env=process.env.VERCEL_GIT_COMMIT_SHA;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:db};return original.call(this,name,...args);};process.env.VERCEL_GIT_COMMIT_SHA='fixed-build';
 try {
  delete require.cache[require.resolve('../../src/lib/editorial/jobs.ts')];const {enqueue,publicJob}=require('../../src/lib/editorial/jobs.ts');
  const visible=publicJob(job,source);assert.equal(visible.canResumeResidual,true);assert.equal(visible.canRecheckDevelopment,false);
  await enqueue(source,true);await enqueue(source,true);
  assert.equal(updates,1);assert.equal(job.ledger.at(-1).status,'residual_recovery_requested');
  assert.equal(job.cursor,1);assert.equal(job.sourceHash,sourceHash);assert.equal(job.ledger[0].trace.usage.total_tokens,55);
 } finally {Module._load=original;if(env===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=env;}
});
