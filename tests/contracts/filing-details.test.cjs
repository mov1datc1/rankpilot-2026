require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeFilingDetails,filingDetailsGaps}=require('../../src/lib/audit/filing-details.ts');
const {runArtifactIntegrityCheck}=require('../../src/lib/docx/artifact-integrity-check.ts');
const {reviewPackage,resumeReviewCheckpoint,reviewStepHash}=require('../../src/lib/audit/review-checkpoint.ts');
test('filing data preserves explicit zero, ignores approval injection and does not invent roster counts',()=>{
 const result=normalizeFilingDetails({departmentName:' Tax ',numPartners:0,numLawyers:'',contacts:[{name:'Ana',email:'ana@example.test'}],departmentHeads:[],target_band:'Band 1',approved_artifact:{passed:true}});
 assert.equal(result.numPartners,0);assert.equal(result.numLawyers,'');assert.equal(result.departmentName,'Tax');assert.equal(result.approved_artifact,undefined);
 assert.deepEqual(filingDetailsGaps(result),['B3: número de otros abogados','B7: responsables del departamento']);
 assert.throws(()=>normalizeFilingDetails({...result,numPartners:-1}));
});
test('requested target is separate from current ranking and participates in checkpoint invalidation',()=>{
 const pkg=reviewPackage({targetDirectory:'Chambers',practiceArea:'Tax',currentBand:'Band 2'},{target_band:'Band 1'},[]);
 assert.equal(pkg.requested_target,'Band 1');assert.equal(pkg.current_band,'Band 2');
 assert.notEqual(reviewStepHash('strategy',pkg),reviewStepHash('strategy',{...pkg,requested_target:'Band 3'}));
});
test('structurally valid legacy selection cannot skip semantic source review',()=>{
 const pkg={matters:[]}; const state={strategy:{matters:[]},selection_validated:true};
 const saved={created_at:Date.now(),state,step_keys:{strategy:reviewStepHash('strategy',pkg,state)}};
 assert.equal(resumeReviewCheckpoint(pkg,saved).stage,'strategy');
});
test('renderer allows a sourced foreign authority but blocks an unsupported one',()=>{
 const m={id:'m',client:'Synthetic Exporter',summary:'Advice concerning SAT registration in Mexico.',optimizedText:'Advice concerning SAT registration in Mexico.',isConfidential:true,source_excerpt:'Advice concerning SAT registration in Mexico.'};
 const options={practiceArea:'Tax',jurisdiction:'Venezuela'};
 const supported=runArtifactIntegrityCheck([], [m], [],options);
 assert.equal(supported.criticalErrors.some(x=>x.field==='Jurisdiction Purity Guardrail'),false);
 const invalid=runArtifactIntegrityCheck([], [{...m,source_excerpt:'Domestic registration advice.'}], [],options);
 assert.equal(invalid.criticalErrors.some(x=>x.field==='Jurisdiction Purity Guardrail'),true);
});
test('renderer does not reclassify a validated mixed property mandate by client name',()=>{
 const m={id:'m',client:'Conciencia Ambiental',summary:'The firm defended property boundaries.',isConfidential:true};
 const result=runArtifactIntegrityCheck([], [m], [],{practiceArea:'Real Estate'});
 assert.equal(result.criticalErrors.some(x=>x.field==='Real Estate Core Purity'),false);
});
test('stage usage accounts for selector and independent reviewer, without recounting old calls',()=>{
 const {stageTraceDelta}=require('../../src/lib/audit/review-checkpoint.ts');
 const old={role:'old',usage:{total_tokens:500}};
 const result=stageTraceDelta([old],[old,{role:'strategist',usage:{input_tokens:10,output_tokens:5,total_tokens:15}},{role:'selection_reviewer',usage:{input_tokens:7,output_tokens:3,total_tokens:10}}]);
 assert.equal(result.usage.total_tokens,25);assert.equal(result.calls.length,2);
 assert.equal(stageTraceDelta([old],[old]),null);
});
test('missing filing data is reviewed before paid preparation, with explicit deferral allowed',()=>{
 const {filingPreparationNeeded}=require('../../src/lib/audit/filing-details.ts');
 assert.equal(filingPreparationNeeded({}),true);
 assert.equal(filingPreparationNeeded({filing_reviewed:true}),false);
 assert.equal(filingPreparationNeeded({departmentName:'Tax',numPartners:0,numLawyers:0,contacts:[{name:'Ana',email:'a@example.test'}],departmentHeads:[{name:'Ana'}]}),false);
});
