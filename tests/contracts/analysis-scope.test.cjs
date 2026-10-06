require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {selectedScope,scopeIssues}=require('../../src/lib/audit/analysis-scope.ts');
const selected={directory:'Chambers & Partners',practice_area:'Labour & Employment',jurisdiction:'México'};
test('missing scope cannot silently become Chambers/General/Global',()=>{
 assert.equal(scopeIssues(selectedScope({})).length,3);
 assert.equal(scopeIssues(selectedScope({directory:'Chambers',practice:'General',jurisdiction:'Mexico'}))[0].field,'practice_area');
});
test('equivalent names match without converting missing evidence to confirmation',()=>{
 const source_scope={directory:{value:'Chambers',quote:'Directory: Chambers'},practice_area:{value:'Labor & Employment',quote:'Practice Area: Labor & Employment'},jurisdiction:{value:'Mexico',quote:'Country: Mexico'}};
 assert.deepEqual(scopeIssues(selected,[{source:'source.docx',source_scope}]),[]);
 assert.deepEqual(scopeIssues(selected,[{source_scope:{jurisdiction:{value:'Chile'}}}]),[]);
});
test('every source is compared; conflicts carry selected value, literal evidence and recovery',()=>{
 const issues=scopeIssues(selected,[{source:'A.docx',source_scope:{practice_area:{value:'Labour & Employment',quote:'Practice Area: Labour & Employment'}}},{source:'B.docx',source_scope:{practice_area:{value:'Tax',quote:'Practice Area: Tax'},jurisdiction:{value:'Chile',quote:'Country: Chile'}}}]);
 assert.equal(issues.length,2);assert.equal(issues[0].source,'B.docx');assert.equal(issues[0].selected,'Labour & Employment');assert.equal(issues[0].detected,'Tax');assert.match(issues[0].message,/Corrige el filtro/);
});
test('changing the persisted scope changes strategy cache dependencies',()=>{
 const {reviewPackage,reviewStepHash}=require('../../src/lib/audit/review-checkpoint.ts');
 const submission={targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico'};
 const key=reviewStepHash('strategy',reviewPackage(submission,{},[]));
 for(const [field,value] of [['targetDirectory','Legal 500'],['practiceArea','Banking & Finance'],['guideRegion','Chile']])
  assert.notEqual(key,reviewStepHash('strategy',reviewPackage({...submission,[field]:value},{},[])));
});

test('explicit guide declarations must agree with the selected guide',()=>{
 const report={source:'guide.docx',source_scope:{guide_region:{value:'Europe',quote:'Guide: Europe'}}};
 const issues=scopeIssues({...selected,guide_region:'Latin America'},[report]);
 assert.equal(issues.length,1);assert.equal(issues[0].field,'guide_region');
});
