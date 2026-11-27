require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// v1.0.124 (Jonathan, 27-11): B10 follows the form's 500-word limit; B9 and C2 keep 1,000.
test('the application and the engine share the same section limits',()=>{
  const limits=require('../../src/lib/editorial/section-limits.ts');
  assert.equal(limits.B10_MAX_WORDS,500);
  assert.equal(limits.C2_MAX_WORDS,1000);
  assert.equal(limits.B9_MAX_WORDS,1000);
  const py=fs.readFileSync(path.join(__dirname,'../../ai-engine/core/section_limits.py'),'utf8');
  assert.match(py,/^B10_MAX_WORDS = 500$/m);
  assert.match(py,/^C2_MAX_WORDS = 1000$/m);
});

test('no screen still announces a 1,000-word B10',()=>{
  for(const file of ['src/components/SubmissionStudio.tsx','src/app/submissions/department/page.tsx','src/components/PostIngestionWizardModal.tsx']){
    const text=fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
    assert.doesNotMatch(text,/hasta 1\.000 palabras|1\.000 palabras \(estándar ampliado\)|\/ 1\.000 words/,file);
  }
});
