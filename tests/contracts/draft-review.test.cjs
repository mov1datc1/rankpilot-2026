require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {currentReviewDraft}=require('../../src/lib/audit/draft-review.ts');
const {reviewPackage,reviewInputHash}=require('../../src/lib/audit/review-checkpoint.ts');
const {buildAuditDoc}=require('../../src/app/api/generate-docx/audit-builder.ts');
const {Packer}=require('docx'),JSZip=require('jszip');
function fixture(){
 const matter={id:'m',client:'Synthetic Client',rawNotes:'The team led negotiations.',optimizedText:'The team led negotiations.'};
 const sub={id:'s',targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',matters:[matter]};
 const data={firm_name:'Synthetic Firm',matters:[matter],original_b10:'Source department narrative.'};
 const state={selection_validated:true,selection_review_validated:true,development_validated:true,writer_validated:true,
  strategy:{matters:[{matter_id:'m',disposition:'core'}],hero_matter_id:'m'},development:{version:'editorial-development-v3'},
  letter:{executive_assessment:'A source-based proposal.',portfolio:'The negotiated mandate.',leadership:'The named lead.',evidence_gaps:'No reserves.',next_steps:'Confirm the period.'}};
 data.review_checkpoint={stage:'done',state,input_hash:reviewInputHash(reviewPackage(sub,data,[matter]))};return {sub,data};
}
test('current writer proposal renders the executive draft without conferring approval',async()=>{
 const {sub,data}=fixture(),before=structuredClone(data),candidate=currentReviewDraft(sub,data);assert.ok(candidate);
 assert.equal(candidate.approved_artifact,null);assert.equal(candidate.release_verdict.passed,false);
 assert.equal(candidate.canonical_matter_selection.hero_matter_id,'m');assert.deepEqual(data,before);
 const bytes=await Packer.toBuffer(buildAuditDoc('Synthetic Firm','Tax',{}, {},{}, {...sub,chambersData:candidate}));
 const xml=await(await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
 assert.match(xml,/Strategic Audit Letter/);assert.match(xml,/A source-based proposal/);assert.doesNotMatch(xml,/Internal Evidence Review/);
});
test('source changes or incomplete stages cannot expose stale strategy as current draft',()=>{
 for(const change of ['source','writer','selection','foreign']){
  const {sub,data}=fixture();if(change==='source')data.matters[0].rawNotes='A changed original fact.';
  if(change==='writer')data.review_checkpoint.state.writer_validated=false;
  if(change==='selection')data.review_checkpoint.state.selection_review_validated=false;
  if(change==='foreign')data.review_checkpoint.state.strategy.matters[0].matter_id='foreign';
  assert.equal(currentReviewDraft(sub,data),null,change);
 }
});
