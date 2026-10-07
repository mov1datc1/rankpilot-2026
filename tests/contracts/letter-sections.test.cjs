require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeLetterSections}=require('../../src/lib/audit/letter-sections.ts');
const shifted={executive_assessment:'**Evaluación ejecutiva**\nAssessment.\n\n**Cartera**\nClient S.A. de C.V.',portfolio:'**Liderazgo**\nPerson.',leadership:'**Brechas de evidencia**\nGap.',evidence_gaps:'**Próximos pasos**\nAction.',next_steps:''};
test('explicit misplaced sections map to correct fields without rewriting facts',()=>{
  const result=normalizeLetterSections(shifted);
  assert.deepEqual(result,{executive_assessment:'Assessment.',portfolio:'Client S.A. de C.V.',leadership:'Person.',evidence_gaps:'Gap.',next_steps:'Action.'});
  assert.equal(shifted.next_steps,'');
  assert.deepEqual(normalizeLetterSections(result),result);
});
test('partial, ambiguous or unlabelled content remains untouched',()=>{
  for(const value of [{...shifted,portfolio:'Person.'},{...shifted,next_steps:'**Cartera**\nOther.'},{...shifted,executive_assessment:'Unlabelled preface\n'+shifted.executive_assessment}]) assert.equal(normalizeLetterSections(value),value);
});
