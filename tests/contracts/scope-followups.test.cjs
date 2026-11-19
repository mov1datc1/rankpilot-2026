require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {matchPracticeArea}=require('../../src/lib/audit/analysis-scope.ts');

// v1.0.106: two risks found by an external review of PR79.
test('a detected practice is mapped through the scope aliases, never claimed when absent',()=>{
 const options=['Tax','Real Estate','Labour & Employment','Environment'];
 assert.equal(matchPracticeArea('Derecho Fiscal',options),'Tax');
 assert.equal(matchPracticeArea('Fiscal',options),'Tax');
 assert.equal(matchPracticeArea('Labor and Employment',options),'Labour & Employment');
 assert.equal(matchPracticeArea('Energy & Natural Resources',options),null);
 const builder=fs.readFileSync(require.resolve('../../src/app/builder/page.tsx'),'utf8');
 assert.match(builder,/const target = matchPracticeArea\(detected/);
 assert.doesNotMatch(builder,/Cambiamos la práctica a «\$\{detected\}»/);
});
test('the confidentiality re-check reuses stored scope answers and never re-asks after a paid extraction',()=>{
 const route=fs.readFileSync(require.resolve('../../src/app/api/extract-document/route.ts'),'utf8');
 assert.match(route,/\(submission\.chambersData as any\)\?\.scope_confirmations/);
 assert.match(route,/const scopeConflicts=confidentialityOnly \? \[\] : unconfirmedScopeIssues/);
});
