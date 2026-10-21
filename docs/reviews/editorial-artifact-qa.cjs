require('./review-loader.cjs');
const fs=require('node:fs');const {Packer}=require('docx');const JSZip=require('jszip');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {buildAuditDoc}=require('../../src/app/api/generate-docx/audit-builder.ts');
(async()=>{
const review=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'editorial-graph-live-qa.json'))).results.find(r=>r.case==='grounded');
const source='Synthetic Aurora Legal represented Synthetic Buyer in a tax appeal before the Mexican Federal Administrative Justice Court in 2026. Partner Sofia Vega led the representation. The disputed assessment is MXN 1000000. The appeal remains pending; no ruling or financial recovery has occurred. Publication is explicitly authorized.';
const b10='Synthetic Aurora Legal advises on tax disputes in Mexico. Partner Sofia Vega leads the department. The supplied mandate is a pending tax appeal. No broader team size, geographic footprint or market ranking is claimed.';
const matters=[{id:'qa-1',client:'Synthetic Buyer',name:'Tax appeal',rawNotes:source,summary:source,source_excerpt:source,optimizedText:source,leadPartner:'Sofia Vega',value:'MXN 1000000',publish_status:'publishable',confidentialityConfirmed:true,isConfidential:false}];
const lawyers=[{name:'Sofia Vega',is_partner:true,isPartner:true}];
const data={firm_name:'Synthetic Aurora Legal',matters,lawyers,original_b10:b10,enhanced_b7:b10,canonical_matter_selection:{core_matter_ids:['qa-1'],hero_matter_id:review.strategy.hero_matter_id},release_verdict:review.release,editorial_review:{letter:review.letter},hero_matter_id:review.strategy.hero_matter_id};
const sub={practiceArea:'Tax',guideRegion:'Mexico',targetDirectory:'Chambers',matters,chambersData:data};
const result={scope:'Real DOCX builders with live-reviewed synthetic package',artifacts:[]};
for(const type of ['submission','audit']){
 try{
 const doc=type==='submission'?buildSubmissionDoc(data.firm_name,'Tax',data,sub):buildAuditDoc(data.firm_name,'Tax',{}, {},{},sub);
 const buffer=await Packer.toBuffer(doc);const zip=await JSZip.loadAsync(buffer);const xml=await zip.file('word/document.xml').async('string');const text=xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
 fs.writeFileSync(`/private/tmp/rankpilot-reviewed-${type}.docx`,buffer);
 result.artifacts.push({type,rendered:true,words:text.split(/\s+/).length,text});
 if(type==='submission')fs.writeFileSync(require('node:path').join(__dirname,'rendered-editorial-package-qa.json'),JSON.stringify({package:{directory:'Chambers',practice_area:'Tax',b10_source:b10,matters,lawyers,rendered_artifact:text},strategy:review.strategy,letter:review.letter},null,2));
 }catch(e){result.artifacts.push({type,rendered:false,error:e.message});}
}
fs.writeFileSync(require('node:path').join(__dirname,'editorial-artifact-qa.json'),JSON.stringify(result,null,2));console.log(result.artifacts.map(({text,...r})=>r));
})().catch(e=>{console.error(e);process.exitCode=1});
