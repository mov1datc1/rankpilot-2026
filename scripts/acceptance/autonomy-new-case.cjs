/** Isolated acceptance run using real routes, model calls, renderer and artifact judge.
 * No production database writes. Run from repository root with a local engine on 8011.
 * Requires explicit authorization for API usage; fixture contains invented names only.
 * RANKPILOT_QA_DIR controls private output; RESUME_SAVED=1 preserves original-source binding.
 */
require('../../docs/reviews/review-loader.cjs');
require('dotenv').config({path:'ai-engine/.env',quiet:true});
require('dotenv').config({quiet:true});
process.env.PYTHON_API_URL='http://127.0.0.1:8011';
const fs=require('node:fs'),Module=require('node:module');
let submission,job,calls=[],repairMode=false;
const db=()=>({submission:{findUnique:async()=>structuredClone(submission),updateMany:async({where,data})=>{if(where.updatedAt && +new Date(where.updatedAt)!==+new Date(submission.updatedAt))return{count:0};Object.assign(submission,data);return{count:1};},update:async({data})=>{Object.assign(submission,data);return structuredClone(submission);}},matter:{updateMany:async({where,data})=>{Object.assign(submission.matters.find(m=>m.id===where.id),data);return{count:1};}},user:{findUnique:async()=>null}});
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async fn=>{const old=structuredClone(submission);try{return await fn(db());}catch(e){submission=old;throw e;}}:key==='$executeRaw'?async(strings,...values)=>{
 if(strings.join('').includes('"ledger"=')) {
  if(job.status!=='running' || job.leaseToken!==values[8]) return 0;
  Object.assign(job,{status:values[0],tasks:JSON.parse(values[1]),cursor:values[2],stage:values[3],issue:JSON.parse(values[4]),resultHash:values[5],ledger:[...job.ledger,...JSON.parse(values[6])],leaseToken:null});return 1;
 }return 1;
}:db()[key]});
const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/prisma')return{__esModule:true,default:prisma};if(name==='@/utils/supabase/server')return{createClient:()=>{throw new Error('Worker must not need browser cookies');}};return load.call(this,name,...args);};
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
const {runJobStage}=require('../../src/lib/editorial/runner.ts');

async function main(){
 const dir=process.env.RANKPILOT_QA_DIR || 'docs/reviews/autonomy-new-case';fs.mkdirSync(dir,{recursive:true});
 const entries=[
 ['Meridian Circuits','The firm represented Meridian Circuits in an administrative tax appeal in Mexico. Partner Laura Vega led the challenge to a MXN 8 million assessment concerning deductible manufacturing expenses. The administrative tribunal annulled the assessment in July 2026 for defects in the authority’s evidentiary reasoning. The source does not report a final appeal by the authority.'],
 ['Harbour Logistics','The firm advises Harbour Logistics on a tax audit in Mexico concerning customs valuation and the tax treatment of freight services. Partner Laura Vega leads document review and responses to information requests. The audit began in March 2026 and remains ongoing. No assessment, settlement or recovery has been reported.'],
 ['Orion Components','The firm advised Orion Components on tax compliance procedures for a Mexican manufacturing site. Counsel Elena Soto reviewed supplier documentation and prepared an implementation checklist in September 2026. No litigation or monetary result is reported.'],
 ['Cedar Retail','The firm advised Cedar Retail on a tax dispute in Mexico. Partner Laura Vega prepared the administrative defence in February 2025. An initial source note says the challenge was dismissed; a subsequent undated note says a final decision remains pending. Both notes agree that the firm analysed the assessment and filed the defence. The sources do not establish which status is current.']
 ];
 const matters=entries.map(([client,rawNotes],i)=>({id:'new-'+i,client,name:client,rawNotes,source_excerpt:rawNotes,value:i===0?'MXN 8 million':'',leadPartner:i===2?'Elena Soto':'Laura Vega',optimizedText:'',confidentialityConfirmed:true,publish_status:'non_publishable',isConfidential:true}));
 const data={qa_synthetic:true,firm_name:'Faro Fiscal QA Fictional',guideRegion:'Latin America',matters,original_b10:'Faro Fiscal QA Fictional is a fictional Mexican tax practice advising on administrative tax litigation, tax audits and tax compliance. The department has two partners and five other qualified lawyers. Laura Vega leads tax disputes; Elena Soto is a counsel who advises on compliance documentation.',enhanced_b7:'',original_c2:'',departmentName:'Tax',numPartners:2,numLawyers:5,contacts:[{name:'QA Contact',email:'qa@example.test'}],departmentHeads:[{name:'Laura Vega'}],filing_reviewed:true,lawyers:[{name:'Laura Vega',role:'Partner',isPartner:true,bio:'Laura Vega is a partner in the tax practice and leads the Meridian Circuits, Harbour Logistics and Cedar Retail matters.'},{name:'Elena Soto',role:'Counsel',isPartner:false,bio:'Elena Soto is a counsel in the tax practice. She advised Orion Components on compliance documentation.'}],draft_revision:0};
 submission={id:'qa-isolated-new-case',userId:'qa',practiceArea:'Tax',targetDirectory:'Chambers',guideRegion:'Mexico',currentBand:'',updatedAt:new Date(),status:'Draft',matters:structuredClone(matters),chambersData:data};
 const snapshot=sourceSnapshot(submission);job={id:'qa-job',submissionId:submission.id,userId:submission.userId,snapshot,sourceHash:stableHash(snapshot),status:'running',tasks:['selection'],cursor:0,stage:'selection',leaseToken:'initial',ledger:[]};
 if(process.env.RESUME_SAVED==='1'){
  const saved=JSON.parse(fs.readFileSync(dir+'/new-case-state.json','utf8'));
  const original=JSON.parse(fs.readFileSync(dir+'/new-case-input.json','utf8'));
  if(stableHash(sourceSnapshot(saved.submission))!==stableHash(sourceSnapshot(original)))throw new Error('QA source changed; start a new test instead of silently accepting it');
  submission=saved.submission;
  const snapshot=sourceSnapshot(submission);job={...saved.job,id:'qa-resumed-job',snapshot,sourceHash:stableHash(snapshot),tasks:['selection'],stage:'selection',cursor:0,status:'running',ledger:[]};
 }else{
 fs.writeFileSync(dir+'/new-case-input.json',JSON.stringify(submission,null,2));
 }
 for(let guard=0;guard<20;guard++){
  job.status='running';job.leaseToken='lease-'+guard;
  console.log('STAGE',job.stage,new Date().toISOString());
  await runJobStage(structuredClone(job));
  fs.writeFileSync(dir+'/new-case-state.json',JSON.stringify({submission,job},null,2));
  console.log('RESULT',job.status,job.issue?.code || '',job.ledger.at(-1)?.trace?.usage?.total_tokens || 0);
  if(job.status!=='queued')break;
 }
 const pair=submission.chambersData.approved_artifact;
 if(pair){fs.writeFileSync(dir+'/new-case-Submission.docx',Buffer.from(pair.base64,'base64'));fs.writeFileSync(dir+'/new-case-Audit.docx',Buffer.from(pair.audit_base64,'base64'));}
 console.log(JSON.stringify({status:job.status,release:submission.chambersData.release_verdict,source_unchanged:stableHash(sourceSnapshot(submission))===job.sourceHash,issue:job.issue}));
 if(job.status!=='completed')process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
