require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resumeReviewCheckpoint,reviewStepHash}=require('../../src/lib/audit/review-checkpoint.ts');
const fixture=require('./fixtures/linked-execution-legacy-checkpoint.json');

test('linked argument upgrade retains validated selection and consumption while replacing old development',()=>{
  const {payload,saved}=structuredClone(fixture);
  assert.equal(reviewStepHash('strategy',payload,saved.state),saved.step_keys.strategy);
  assert.notEqual(reviewStepHash('development',payload,saved.state),saved.step_keys.development);
  const resumed=resumeReviewCheckpoint(payload,saved,10000);
  assert.equal(resumed.stage,'development');
  assert.equal(resumed.state.development_reusable,false);
  assert.deepEqual(resumed.state.strategy,saved.state.strategy);
  assert.equal(resumed.state.selection_review_attempts,2);
  assert.deepEqual(resumed.state.trace,saved.state.trace);
  assert.equal(resumed.state.development,undefined);
  assert.equal(resumed.state.letter,undefined);
  assert.deepEqual(resumed.step_keys,{strategy:saved.step_keys.strategy});
});
