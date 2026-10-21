// Runs real application functions and HTTP handlers with in-memory DB/auth stubs.
// No network, model calls or production writes. Optional private DB snapshot for replay.
const { root } = require('./review-loader.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const JSZip = require('jszip');
const { Packer } = require('docx');
const { buildAuditDoc } = require(path.join(root, 'src/app/api/generate-docx/audit-builder.ts'));
const { curateMatters } = require(path.join(root, 'src/lib/docx/matter-curator.ts'));
const { evaluateStrategicSufficiency } = require(path.join(root, 'src/lib/audit/evidence-sufficiency-gate.ts'));
const { judgeSolExtractionAudit } = require(path.join(root, 'src/lib/audit/extraction-auditor.ts'));
const { NextRequest } = require('next/server');
const results = [];
const record = (id, passed, observed, layer = 'real_function') => results.push({id, passed, observed, layer});
async function textOf(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file('word/document.xml').async('string')).replace(/<\/w:p>/g, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
}
const makeMatter = (n, practice) => ({id:`test-${n}`,name:`Matter ${n}`,client:`Synthetic Client ${n}`,leadPartner:'',value:'',
  summary:`The team advised on ${practice} proceedings. No quantified outcome or lawyer identity is supplied.`,isConfidential:false,publish_status:'publishable'});
async function main() {
  const practices = ['Labour & Employment','Real Estate','Tax','Banking & Finance','Corporate/M&A','Energy & Natural Resources','Data Protection','Intellectual Property','Competition','Dispute Resolution'];
  for (const practice of practices) for (const count of [0,1,8,20]) {
    const matters = Array.from({length:count},(_,i)=>makeMatter(i+1,practice));
    const submission = {createdAt:'2026-10-02',practiceArea:practice,guideRegion:'Mexico',currentBand:'Unranked',targetDirectory:'Chambers',matters,chambersData:{}};
    const text = await textOf(await Packer.toBuffer(buildAuditDoc('Synthetic Unrelated Firm',practice,{score:12},{},{},submission)));
    const defects = [];
    if (text.includes('Certified Defensibility Score: 90/100')) defects.push('score_12_certified_as_90');
    if (count!==20 && text.includes('exactly 20 official matters')) defects.push('false_count_20');
    if (/Eduardo Garduño|José Pablo Ramos|Raymundo Carreño/.test(text)) defects.push('unsupported_named_lawyer');
    if (count<5 && /substantiates a defensible position|possesses a defensible/.test(text)) defects.push('unsupported_positive_verdict');
    record(`audit:${practice}:${count}`,defects.length===0,{input_matters:count,defects},'real_docx_builder');
  }
  const unconfirmed = {id:'unknown',client:'Synthetic Client',summary:'Advice',isConfidential:false,publish_status:'confirmation_required',confidentialityStatus:'confirmation_required',confidentialityConfirmed:false};
  const audited = judgeSolExtractionAudit({matters:[unconfirmed],practiceArea:'Tax'});
  record('unconfirmed_confidentiality_not_public',audited.healedMatters[0].isConfidential===true,{isConfidential:audited.healedMatters[0].isConfidential,status:audited.healedMatters[0].publish_status});
  const emptyMatters=Array.from({length:10},(_,i)=>({id:`empty-${i}`,client:'',summary:'',isConfidential:true}));
  const sufficient=evaluateStrategicSufficiency({matters:emptyMatters,chambersData:{},practiceArea:'Tax',firmName:'Synthetic'});
  record('ten_empty_records_are_not_sufficient',sufficient.status!=='sufficient',{status:sufficient.status,band:sufficient.recommendedBand});
  const public20=Array.from({length:20},(_,i)=>makeMatter(i,'Intellectual Property'));
  const c=curateMatters(public20,'Intellectual Property',{canonical_matter_selection:{core_matter_ids:public20.map(m=>m.id)}});
  record('canonical_twenty_public_matters_preserved',c.totalOfficialCount===20,{official:c.totalOfficialCount,reserve:c.surplusPubMatters.length});
  const sameTitle=[{...makeMatter(1,'Tax'),title:'Tax advice'},{...makeMatter(2,'Tax'),title:'Tax advice'}];
  const dedup=curateMatters(sameTitle,'Tax',{});
  const retained=[...dedup.officialPubMatters,...dedup.officialConfMatters,...dedup.surplusPubMatters,...dedup.surplusConfMatters];
  record('different_clients_same_title_preserved',retained.length===2,{input:2,retained:retained.length});

  // Real Next handlers; dependencies below are explicitly stubbed to avoid production mutation.
  let currentSubmission, created=[];
  const authUser={id:'synthetic-user'};
  const prisma={submission:{findUnique:async()=>currentSubmission,update:async()=>currentSubmission},
    user:{findUnique:async()=>authUser},matter:{deleteMany:async()=>({count:0}),create:async({data})=>{const r={id:`db-${created.length}`,...data};created.push(r);return r}}};
  const load=Module._load;
  Module._load=function(name,...args){
    if(name==='@/lib/prisma')return {__esModule:true,default:prisma};
    if(name==='@/utils/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user:authUser}})}})};
    return load.call(this,name,...args);
  };
  const {POST}=require(path.join(root,'src/app/api/extract-document/route.ts'));
  currentSubmission={id:'synthetic',userId:authUser.id,practiceArea:'Tax',targetDirectory:'Chambers',guideRegion:'Mexico',currentBand:'Unranked',chambersData:{}};
  global.fetch=async()=>new Response(JSON.stringify({success:true,metadata:{},matters:[unconfirmed]}),{headers:{'Content-Type':'application/json'}});
  const extracted=await POST(new NextRequest('http://localhost/api/extract-document',{method:'POST',body:JSON.stringify({submissionId:'synthetic',text:'synthetic source'})}));
  const extractionBody=await extracted.json();
  record('http_extraction_preserves_unknown_confidentiality',created[0]?.isConfidential===true,{http:extracted.status,persistedConfidential:created[0]?.isConfidential,responseKeys:Object.keys(extractionBody)},'real_http_handler_stubbed_extractor_db_auth');
  const {GET}=require(path.join(root,'src/app/api/generate-docx/route.ts'));
  currentSubmission={...currentSubmission,createdAt:'2026-10-02',matters:[makeMatter(1,'Tax')],chambersData:{release_verdict:{passed:false,status:'blocked'},analysis:{score:12}}};
  const auditResponse=await GET(new NextRequest('http://localhost/api/generate-docx?id=synthetic&type=audit'));
  const auditText=auditResponse.status===200?await textOf(Buffer.from(await auditResponse.arrayBuffer())):'';
  record('http_blocked_dossier_not_certified',!auditText.includes('Certified Defensibility Score:'),{http:auditResponse.status,certified:auditText.includes('Certified Defensibility Score:')},'real_http_handler_stubbed_db_auth');
  if(process.argv[2]){
    const data=JSON.parse(fs.readFileSync(process.argv[2]));
    for(const s of data.submissions){
      authUser.id=s.userId;
      currentSubmission={...s,matters:data.matters.filter(m=>m.submissionId===s.id)};
      for(const type of ['audit','submission']){
        const response=await GET(new NextRequest(`http://localhost/api/generate-docx?id=${s.id}&type=${type}`));
        let observation={practice:s.practiceArea,type,http:response.status,dbMatters:currentSubmission.matters.length,jsonMatters:s.chambersData?.matters?.length,releasePassed:s.chambersData?.release_verdict?.passed};
        if(response.status===200){const text=await textOf(Buffer.from(await response.arrayBuffer()));observation={...observation,words:text.split(/\s+/).length,claimsExactly20:text.includes('exactly 20 official matters'),certifiedScore:(text.match(/Certified Defensibility Score: ([^\n]+)/)||[])[1]};}
        record(`snapshot_replay:${s.practiceArea}:${type}`,response.status===200,observation,'real_http_handler_private_snapshot_stubbed_db_auth_not_browser');
      }
    }
  }
  const report={baseline:'af13685',meaning:'Contract failures describe current defects; snapshot replay pass means HTTP generation only, not editorial approval.',total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  fs.writeFileSync(path.join(__dirname,'stress-contracts-2026-10-02.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,non_matrix:results.filter(r=>!r.id.startsWith('audit:'))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
