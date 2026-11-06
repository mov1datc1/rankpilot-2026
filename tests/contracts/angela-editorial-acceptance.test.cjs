require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {curateLawyers,buildLawyerStandoutWork}=require('../../src/lib/docx/lawyer-curator.ts');
const {stripAuditVoice,generateDynamicB10}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {renderedSubmissionFindings}=require('../../src/lib/editorial/artifact-findings.ts');
const {runArtifactIntegrityCheck}=require('../../src/lib/docx/artifact-integrity-check.ts');

test('editorial faults are routed to source-grounded repair, never erased by formatting',()=>{
 const text='The source frames the objective as preservation of operational stability while the matter continues.';
 assert.equal(stripAuditVoice(text),text);
 const findings=renderedSubmissionFindings(text,{matters:[{matter_id:'m',text}]});
 assert.equal(findings.length,1);assert.equal(findings[0].severity,'critical');assert.equal(findings[0].field_path,'matters/0/text');
});
test('confirmed partner who heads the department retains both source-backed functions',()=>{
 const bio='Sofia Vega is a partner and heads the Labour & Employment practice.';
 const raw=[{name:'Sofia Vega',role:'Partner',comments:bio}];
 const curated=curateLawyers(raw,[],'Synthetic Firm','Labour & Employment','Mexico',{departmentHeads:[{name:'Sofia Vega'}]});
 assert.equal(curated[0].comments,bio);assert.match(curated[0].comments,/partner and heads/);
});
test('B10 preserves the reviewed argument and documented scale instead of replacing its opening',()=>{
 const text='The department advises industrial employers on collective negotiations and constitutional labour litigation. It supported an integration affecting more than 5,000 employees, coordinating employment documentation, active disputes and workforce governance across several manufacturing sites.';
 assert.equal(generateDynamicB10('Synthetic Firm','Labour & Employment','Mexico',[],[],{editorial_development:{b10:text}},{}),text);
});
test('Real Estate standout work excludes an unrelated energy claim and preserves the attributed mandate',()=>{
 const result=buildLawyerStandoutWork('Synthetic Lawyer',[{client:'Residential Development',summary:'Administrative litigation protecting urban development permissions.',leadPartner:'Synthetic Lawyer',isConfidential:false,confidentialityConfirmed:true,publish_status:'publishable'}],[], 'Energy projects in excess of US$ 2 billion dollars including power plants.','Bio','Real Estate');
 assert.doesNotMatch(result,/billion dollars|power plants/);assert.match(result,/Residential Development/);
});
test('artifact integrity detects concrete auditor commentary in public prose',()=>{
 const result=runArtifactIntegrityCheck([{id:'m',client:'Client',title:'Permit appeal',summary:'The team advised.'}],[],[],{practiceArea:'Real Estate',firmName:'Synthetic Firm',publicSections:[{name:'B10',content:'Our verified evidentiary record demonstrates an active practice.'}]});
 assert.equal(result.passed,false);assert.ok(result.criticalErrors.some(x=>x.field.includes('Auditor Commentary')));
});
test('roles and procedural limits remain immutable until a source-grounded rewrite',()=>{
 for(const text of ['José Alberto Díaz Méndez is identified as lead partner.','Ana Pérez is identified as lead lawyer.','The supplied status is ongoing and does not establish a final merits result.']) assert.equal(stripAuditVoice(text),text);
});
