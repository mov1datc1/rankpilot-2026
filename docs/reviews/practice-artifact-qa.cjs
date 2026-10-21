require('./review-loader.cjs');
const fs=require('node:fs'),path=require('node:path'),{Packer}=require('docx'),JSZip=require('jszip');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
(async()=>{
 const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'practice-editorial-qa.json'))).results,results=[];
 for(const c of cases){
  if(!c.approved){results.push({practice:c.practice,rendered:false,error:'Draft review blocked',release:c.review?.release_verdict});continue;}
  const p=c.package,r=c.review;
  const data={firm_name:p.firm_name,matters:p.matters,lawyers:p.lawyers,original_b10:p.b10_source,enhanced_b7:p.b10_draft,editorial_review:r,release_verdict:r.release_verdict,canonical_matter_selection:{core_matter_ids:r.strategy.matters.filter(m=>m.disposition==='core').map(m=>m.matter_id),reserve_matter_ids:r.strategy.matters.filter(m=>m.disposition==='reserve').map(m=>m.matter_id),excluded_matter_ids:r.strategy.matters.filter(m=>m.disposition==='excluded').map(m=>m.matter_id),hero_matter_id:r.strategy.hero_matter_id}};
  try{
   const sub={practiceArea:p.practice_area,targetDirectory:p.directory,guideRegion:p.jurisdiction,matters:p.matters,chambersData:data};
   const bytes=await Packer.toBuffer(buildSubmissionDoc(p.firm_name,p.practice_area,data,sub));const zip=await JSZip.loadAsync(bytes);
   const text=(await zip.file('word/document.xml').async('string')).replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
   results.push({practice:c.practice,rendered:true,words:text.split(/\s+/).length,request:{package:{...p,rendered_artifact:text},strategy:r.strategy,letter:r.letter}});
  }catch(e){results.push({practice:c.practice,rendered:false,error:e.message});}
 }
 fs.writeFileSync(path.join(__dirname,'practice-artifact-qa.json'),JSON.stringify({scope:'Real DOCX rendering of live micro + review results. Pending final model review.',results},null,2));console.log(results.map(({request,...r})=>r));
 if(results.length!==10 || results.some(r=>!r.rendered))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
