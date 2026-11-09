require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {editorialNextAction}=require('../../src/lib/editorial/next-action.ts');
test('only queued or running work promises automatic continuation',()=>{
 for(const status of ['queued','running'])assert.equal(editorialNextAction({status}).automatic,true);
 for(const status of ['failed','needs_review','indeterminate','superseded','completed'])assert.equal(editorialNextAction({status}).automatic,false);
});
test('reconstruction, source input, real resume and delivery expose distinct next actions',()=>{
 const ledger=[{supervision:{action:'repair',repair_strategy:'source_reconstruction'}}];
 assert.match(editorialNextAction({status:'running',ledger}).title,/Reconstruyendo/);
 assert.equal(editorialNextAction({status:'needs_review',ledger:[{supervision:{action:'needs_input'}}]}).kind,'answer');
 assert.equal(editorialNextAction({status:'failed'},{canResume:true}).kind,'continue');
 assert.equal(editorialNextAction({status:'completed'}).kind,'download');
 assert.equal(editorialNextAction({status:'completed'},{sourceMatches:false}).kind,'review_changes');
});
test('exhaustion and an unknown provider result never invite another paid click',()=>{
 const budget=editorialNextAction({status:'needs_review',ledger:[{supervision:{action:'pause',reason:'token_budget'}}]});
 assert.equal(budget.kind,'technical_review');assert.match(budget.description,/presupuesto autorizado/);
 const unknown=editorialNextAction({status:'indeterminate'});
 assert.match(unknown.description,/antes de repetirla/);assert.equal(unknown.automatic,false);
});
