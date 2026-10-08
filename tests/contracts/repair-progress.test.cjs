require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {generatedContentHash,mayRepairAutomatically}=require('../../src/lib/editorial/repair-progress.ts');
test('automatic repair continues only with content progress and within bounded attempts',()=>{
 const before={editorial_review:{letter:{portfolio:'Old'}},draft_revision:1};
 const review={stage:'artifact',generated_content_hash:generatedContentHash(before)};
 assert.equal(mayRepairAutomatically([],before),true);
 assert.equal(mayRepairAutomatically([review],{...before,draft_revision:2}),false);
 const after={editorial_review:{letter:{portfolio:'Corrected'}}};
 assert.equal(mayRepairAutomatically([review],after),true);
 assert.equal(mayRepairAutomatically([review,review,review],after),false);
});
