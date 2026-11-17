require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {groupFindings}=require('../../src/lib/audit/finding-groups.ts');
const src='Our firm was able to establish a very important legal precedent, even though the Supreme Court of Justice of Mexico ruled against it.';
test('findings on the same field and source passage become one card with the related wording kept',()=>{
 const groups=groupFindings([
  {message:'En B9, calificar la referencia a los criterios.',field_path:'candidates/0/submission_bio',source_quote:src},
  {message:'B9 afirma los criterios obtenidos sin la reserva.',field_path:'candidates/0/submission_bio',source_quote:src+'  '},
  {message:'No se proporcionó el período de investigación.',field_path:'research_period'},
  {message:'La aceptación editorial no está completa: b9_development, source_fidelity'}]);
 assert.equal(groups.length,2);
 assert.deepEqual(groups[0].related,['B9 afirma los criterios obtenidos sin la reserva.']);
 assert.ok(!groups.some(g=>/aceptación editorial/.test(g.message)));
});
test('the generic summary stays when it is the only finding',()=>{
 assert.equal(groupFindings([{message:'La aceptación editorial no está completa: c2_argument'}]).length,1);
});
