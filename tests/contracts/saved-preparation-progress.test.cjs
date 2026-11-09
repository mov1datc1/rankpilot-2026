require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {savedPreparationProgress}=require('../../src/lib/audit/optimization-state.ts');
test('saved internal drafts show progress only for current selected records, never approve them',()=>{
 const data={review_checkpoint:{state:{selection_validated:true,selection_review_validated:true,strategy:{matters:[{matter_id:'a',disposition:'core'},{matter_id:'b',disposition:'core'},{matter_id:'c',disposition:'reserve'}]},development:{b10:'Saved pending text',matters:[{matter_id:'a',text:'Draft'},{matter_id:'a',text:'Duplicate'},{matter_id:'c',text:'Reserve'}]}}}};
 assert.deepEqual(savedPreparationProgress(data,true),{selected:2,prepared:1,hasB10:true});
 for(const match of [false,null,undefined])assert.equal(savedPreparationProgress(data,match),null);
 assert.equal(savedPreparationProgress(data,true,true),null);data.review_checkpoint.state.selection_review_validated=false;assert.equal(savedPreparationProgress(data,true),null);
});
