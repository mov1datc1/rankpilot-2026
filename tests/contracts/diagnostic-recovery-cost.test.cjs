require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Packer}=require('docx'),JSZip=require('jszip');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {wordTableProfiles}=require('../../src/lib/docx/xml-text.ts');
const {recoveryPlan,spentTokens,hasUnknownProviderUsage}=require('../../src/lib/editorial/recovery.ts');

test('a fully developed thousand-word B9 survives exact Word rendering through its final contribution',async()=>{
 const opening='Sofia Vega led negotiations that prevented a strike.';
 const ending='Constitutional relief restored the employer right to present its defence.';
 const bio=opening+' '+Array(1000-opening.split(/\s+/).length-ending.split(/\s+/).length).fill('evidence').join(' ')+' '+ending;
 assert.equal(bio.split(/\s+/).length,1000);
 const matter={id:'m',client:'Restricted Entity',isConfidential:true,publish_status:'confidential',rawNotes:opening,optimizedText:opening};
 const d={lawyers:[{name:'Sofia Vega',isPartner:true,bio}],matters:[matter],enhanced_b10:'The employment practice.',enhanced_c2:'The firm requests coverage.',
  editorial_development:{version:'editorial-development-v4',personal_quality_contract:'complete-personal-case-v1',candidates:[{name:'Sofia Vega',recommendation:'develop',suggested_ranking:'Category pending',submission_bio:bio}]},
  canonical_matter_selection:{core_matter_ids:['m'],hero_matter_id:'m'}};
 const doc=buildSubmissionDoc('Synthetic Firm','Labour & Employment',d,{targetDirectory:'Chambers',practiceArea:'Labour & Employment',guideRegion:'Mexico',matters:[matter]},'optimized');
 const zip=await JSZip.loadAsync(await Packer.toBuffer(doc));const xml=await zip.file('word/document.xml').async('string');
 const profiles=wordTableProfiles(xml,['Sofia Vega']);assert.ok(profiles['Sofia Vega'].includes(bio));
 assert.ok(profiles['Sofia Vega'].includes(ending));assert.doesNotMatch(profiles['Sofia Vega'],/Restricted Entity|Category pending/);
});

test('an exhausted scoped diagnostic cannot buy a full retry or erase known and unknown usage',()=>{
 const ledger=[{stage:'artifact',cursor:3,trace:{usage:{total_tokens:112},calls:[{role:'editor',usage:{total_tokens:100}},{role:'diagnostic_reviewer',usage:{total_tokens:12}}]}}];
 const job={stage:'artifact',cursor:3,ledger,issue:{owner:'rankpilot',retryable:false}};
 assert.equal(recoveryPlan(job,'AI_REVIEW_INVALID','new-build'),null);assert.equal(spentTokens(ledger),112);
 const lost=[{...ledger[0],trace:{usage:{total_tokens:100,unknown_calls:1}}}];
 assert.equal(hasUnknownProviderUsage(lost),true);assert.equal(spentTokens(lost),100);
 assert.equal(recoveryPlan({...job,ledger:lost},'AI_REVIEW_INVALID','another-build'),null);
});
