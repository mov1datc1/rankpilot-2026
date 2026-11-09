require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {engineFetch}=require('../../src/lib/editorial/engine.ts');
const {editorialIdentity}=require('../../src/lib/editorial/identity.ts');
test('only the trusted worker can attach a generation allowance',async()=>{
 const original=global.fetch,seen=[];
 global.fetch=async(url,init)=>{seen.push(new Headers(init.headers));return Response.json({success:false},{status:400});};
 try {
  await engineFetch('https://fixture.invalid',{headers:{'X-RankPilot-Token-Allowance':'999999999'}});
  await editorialIdentity.run({userId:'u',submissionId:'s',tokenAllowance:1234},()=>engineFetch('https://fixture.invalid',{headers:{'X-RankPilot-Token-Allowance':'999999999'}}));
  assert.equal(seen[0].get('X-RankPilot-Token-Allowance'),null);
  assert.equal(seen[1].get('X-RankPilot-Token-Allowance'),'1234');
  assert.equal(editorialIdentity.getStore(),undefined);
 } finally {global.fetch=original;}
});
