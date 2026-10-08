// Offline app-renderer integration harness. Inputs and outputs remain private.
require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Packer}=require('docx'),JSZip=require('jszip');
const {projectDevelopment}=require('../../src/lib/editorial/development.ts');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {buildAuditDoc}=require('../../src/app/api/generate-docx/audit-builder.ts');
async function main(){
 const directory=path.resolve(process.argv[2]),name=process.argv[3];
 const read=s=>JSON.parse(fs.readFileSync(path.join(directory,`${name}-${s}.json`),'utf8'));
 const state=read('writer'),input=read('package'),pkg=state.package;
 const decisions=state.strategy.matters;
 const selection={hero_matter_id:state.strategy.hero_matter_id};
 for(const disposition of ['core','reserve','excluded'])selection[`${disposition}_matter_ids`]=decisions.filter(d=>d.disposition===disposition).map(d=>d.matter_id);
 const data=projectDevelopment({...input.submission.chambersData,matters:pkg.matters,lawyers:pkg.lawyers,canonical_matter_selection:selection,hero_matter_id:state.strategy.hero_matter_id,editorial_review:{strategy:state.strategy,letter:state.letter},original_b10:pkg.b10_source,original_c2:pkg.c2_source},state);
 data.ranking_verification=state.ranking_verification || pkg.ranking_verification;
 const submission={...input.submission,chambersData:data,matters:data.matters};
 const files=[];
 for(const kind of ['Submission','Audit']){
  const doc=kind==='Submission'?buildSubmissionDoc(pkg.firm_name,pkg.practice_area,data,submission):buildAuditDoc(pkg.firm_name,pkg.practice_area,{}, {},{},submission);
  const bytes=await Packer.toBuffer(doc),zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file('word/document.xml').async('string');
  const text=xml.replace(/<\/w:p>/g,'\n').replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<w:br\b[^>]*\/>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  fs.writeFileSync(path.join(directory,`${name}-${kind}.next.docx`),bytes);
  fs.writeFileSync(path.join(directory,`${name}-${kind}.next.txt`),text);
  files.push({kind,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),words:text.split(/\s+/).filter(Boolean).length});
  state.package[kind==='Submission'?'rendered_artifact':'rendered_audit']=text;
 }
 fs.writeFileSync(path.join(directory,`${name}-rendered.next.json`),JSON.stringify({files,state},null,2));
 console.log(name,files);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
