require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reviewIssues}=require('../../src/lib/audit/review-actions.ts');

test('missing valid automatic review does not tell the user to edit source data',()=>{
  const issues=reviewIssues({},['Falta una revisión final válida.'],{status:'failed',stage:'artifact',issue:{code:'AI_REVIEW_INVALID',owner:'rankpilot'}});
  assert.equal(issues.length,1);assert.equal(issues[0].owner,'RankPilot');
  assert.equal(issues[0].destination,'retry-review');
  assert.match(issues[0].action,/no pide corregir datos/);
});

test('an internal review failure does not hide an actual source-confirmation request',()=>{
  const message='Confirma el desenlace del asunto.';
  const data={final_artifact_review:{judge:{defects:[{owner:'user',severity:'critical',scope:'facts',code:'SOURCE_CONFLICT',message}]}}};
  const issues=reviewIssues(data,['Falta una revisión final válida.']);
  assert.equal(issues.length,2);
  const source=issues.find(i=>i.message===message);assert.equal(source.destination,'wizard');
  assert.notEqual(source.owner,'RankPilot');
  assert.equal(issues.find(i=>i.message==='Falta una revisión final válida.').owner,'RankPilot');
});
