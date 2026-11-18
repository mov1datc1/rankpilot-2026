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

test('city and state within an explicitly named country match that country',()=>{
 const source_scope={jurisdiction:{value:'Guadalajara, Estate of Jalisco, Mexico',quote:'A3 Location (Jurisdiction)\nGuadalajara, Estate of Jalisco, Mexico'}};
 assert.deepEqual(scopeIssues({...selected,jurisdiction:'Latin America — Mexico'},[{source_scope}]),[]);
 assert.equal(scopeIssues({...selected,jurisdiction:'Chile'},[{source_scope}])[0].field,'jurisdiction');
});

test('v1.0.98: one confirmable question before spending, recommended by source majority',()=>{
 const {unconfirmedScopeIssues,scopeQuestion}=require('../../src/lib/audit/analysis-scope.ts');
 const env={directory:'Chambers & Partners',practice_area:'Environment',jurisdiction:'Latin America — Mexico',modality:'scratch'};
 const template={source:'Chambers ENR template.docx',source_scope:{practice_area:{value:'Energy & Natural Resources',quote:'A2 Practice Area\nEnergy & Natural Resources'},jurisdiction:{value:'Mexico',quote:'A3 Location (Jurisdiction)\nMexico'}}};
 const reports=[template,...['a','b','c','d','e'].map(n=>({source:`${n}.docx`,source_scope:{}}))];
 const issues=scopeIssues(env,reports,'scratch');
 assert.equal(issues.length,1);
 const q=scopeQuestion(issues,reports);
 assert.equal(q.confirmable,true);
 assert.equal(q.items[0].recommendation,'continue');
 assert.match(q.items[0].message,/5 de 6 fuentes no indican otra práctica; recomendamos continuar con «Environment»/);
 assert.deepEqual(unconfirmedScopeIssues(issues,q.confirmations),[]);
 // A confirmation answers only that exact conflict.
 assert.equal(unconfirmedScopeIssues(issues,[{...q.confirmations[0],detected:'Tax'}]).length,1);
 assert.equal(unconfirmedScopeIssues(issues,'nonsense').length,1);
 // Majority declaring another practice recommends changing the filter.
 const majority=[template,{...template,source:'x.docx'},{source:'y.docx',source_scope:{}}];
 assert.equal(scopeQuestion(scopeIssues(env,majority,'scratch'),majority).items[0].recommendation,'change');
});

test('v1.0.98: directory conflicts and missing scope are never confirmable',()=>{
 const {unconfirmedScopeIssues,scopeQuestion}=require('../../src/lib/audit/analysis-scope.ts');
 const draft={directory:'Chambers & Partners',practice_area:'Tax',jurisdiction:'Mexico',modality:'draft'};
 const reports=[{source:'l500.docx',source_scope:{directory:{value:'Legal 500',quote:'Legal 500 submission'}}}];
 const issues=scopeIssues(draft,reports,'draft');
 assert.equal(scopeQuestion(issues,reports).confirmable,false);
 assert.equal(unconfirmedScopeIssues(issues,[{field:'directory',selected:'Chambers & Partners',detected:'Legal 500',source:'l500.docx'}]).length,1);
 assert.equal(scopeQuestion(scopeIssues(selectedScope({}),[]),[]).confirmable,false);
});

test('v1.0.98: later stages honour the stored intake confirmation, only for the same selected scope',()=>{
 const {savedScopeIssues}=require('../../src/lib/audit/analysis-scope.ts');
 const submission={targetDirectory:'Chambers & Partners',practiceArea:'Environment',guideRegion:'Latin America — Mexico',chambersData:{modality:'scratch'}};
 const source_reports=[{source:'ENR template.docx',source_scope:{practice_area:{value:'Energy & Natural Resources',quote:'A2 Practice Area\nEnergy & Natural Resources'}}}];
 const scope_confirmations=[{field:'practice_area',selected:'Environment',detected:'Energy & Natural Resources',source:'ENR template.docx'}];
 assert.equal(savedScopeIssues(submission,{source_reports}).length,1);
 assert.deepEqual(savedScopeIssues(submission,{source_reports,scope_confirmations}),[]);
 assert.equal(savedScopeIssues({...submission,practiceArea:'Tax'},{source_reports,scope_confirmations}).length,1);
});
