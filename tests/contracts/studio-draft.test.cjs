require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {studioMatters,studioDraftChanged}=require('../../src/lib/editorial/studio-draft.ts');
test('opening Studio preserves the revision order and prose despite stale database rows',()=>{
 const data={enhanced_b7:'Current B10',matters:[{id:'b',optimizedText:'Repaired',confidentialityConfirmed:true},{id:'a',optimizedText:'Current'}]};
 const db=[{id:'a',optimizedText:'Old'},{id:'b',optimizedText:'Old'}];
 const visible=studioMatters(data,db);
 assert.deepEqual(visible,data.matters);
 assert.equal(studioDraftChanged(data,db,visible,'Current B10'),false);
});
test('serialization key order does not trigger a save, real edits still do',()=>{
 const data={enhanced_b10:'Draft',matters:[{id:'a',name:'Case'}]};
 assert.equal(studioDraftChanged(data,[],[{name:'Case',id:'a'}],'Draft'),false);
 assert.equal(studioDraftChanged(data,[],[{name:'Edited',id:'a'}],'Draft'),true);
 assert.equal(studioDraftChanged(data,[],data.matters,'Edited'),true);
});
