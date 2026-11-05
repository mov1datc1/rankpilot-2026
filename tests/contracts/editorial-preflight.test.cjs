require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {editorialPreparationIssues,matterSourceText,preparationInputIssues}=require('../../src/lib/audit/preparation-input.ts');
const {calculateEvidenceReadiness}=require('../../src/lib/docx/evidence-readiness.ts');
const {scopeIssues}=require('../../src/lib/audit/analysis-scope.ts');
const {DIRECTORIES,EDITORIAL_DIRECTORIES}=require('../../src/lib/constants.ts');
const source='The team represented the employer in employment litigation.';
const data={firm_name:'Fictional Firm',practice_area:'Labour & Employment',original_b10:'The department advises employers.'};
test('original notes and descriptions have the same preflight status as a narrative',()=>{
 for(const key of ['source_excerpt','rawNotes','summary','notes','description']) {
  const matter={id:'m',client:'Fictional Employer',source_excerpt:' ',[key]:source};
  assert.equal(matterSourceText(matter),source);
  assert.deepEqual(editorialPreparationIssues(data,[matter]),[]);
  assert.equal(calculateEvidenceReadiness([matter],[],data.original_b10).canOptimize,true);
 }
});
test('a partial empty record is identified before spending and optional fields do not create a quota',()=>{
 const complete={id:'one',client:'Fictional Employer',rawNotes:source};
 assert.deepEqual(editorialPreparationIssues(data,[complete]),[]);
 const matters=[complete,{id:'empty',client:'Second Employer',rawNotes:' '}];
 assert.match(editorialPreparationIssues(data,matters).join(' '),/Second Employer/);
 assert.equal(calculateEvidenceReadiness(matters,[],data.original_b10).canOptimize,false);
});
test('department-source requirement is early and does not promise generation while blocking it',()=>{
 const matter={id:'m',client:'Fictional Employer',rawNotes:source};
 const missing={...data,original_b10:'',enhanced_b7:'Generated prose is not source evidence.'};
 assert.equal(preparationInputIssues(missing,[matter]).length,0);
 assert.match(editorialPreparationIssues(missing,[matter]).join(' '),/Revisar expediente/);
 const readiness=calculateEvidenceReadiness([matter],[],'');
 assert.equal(readiness.canOptimize,false);assert.doesNotMatch(readiness.warnings.join(' '),/IA.*estructur/);
 assert.deepEqual(editorialPreparationIssues({...missing,confirmed_source_b10:'User-supplied department facts.'},[matter]),[]);
});
test('only configured editorial targets start, while historical sources from other guides remain usable in option B',()=>{
 const scope={directory:'Chambers & Partners',practice_area:'Tax',jurisdiction:'Mexico',modality:'scratch'};
 for(const directory of EDITORIAL_DIRECTORIES) assert.deepEqual(scopeIssues({...scope,directory}),[]);
 for(const directory of DIRECTORIES.filter(d=>!EDITORIAL_DIRECTORIES.includes(d)))
  assert.equal(scopeIssues({...scope,directory})[0].code,'DIRECTORY_UNSUPPORTED');
 assert.deepEqual(scopeIssues(scope,[{source_scope:{directory:{value:'Leaders League',quote:'Original Leaders League submission'}}}]),[]);
});
