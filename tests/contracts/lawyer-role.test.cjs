require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {projectConfirmedLawyerRole}=require('../../src/lib/audit/lawyer-role.ts');
const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {reviewPackage}=require('../../src/lib/audit/review-checkpoint.ts');

test('saved role confirmation is applied consistently to review and public profile without changing the source',()=>{
 const person={name:'Sofia Vega',role:'Partner',isPartner:true,comments:'Senior Associate · Litigation specialist.',roleResolution:{role:'Partner',reason:'User confirmation',confirmed:true}};
 const original=structuredClone(person);
 assert.equal(curateLawyers([person],[],'Firm','Tax','Mexico')[0].comments,'Partner · Litigation specialist.');
 assert.equal(reviewPackage({}, {lawyers:[person]},[]).lawyers[0].comments,'Partner · Litigation specialist.');
 assert.deepEqual(person,original);
 for(const changed of [{confirmed:false},{reason:''},{role:'Associate'}]) assert.equal(projectConfirmedLawyerRole({...person,roleResolution:{...person.roleResolution,...changed}}).comments,person.comments);
 assert.equal(projectConfirmedLawyerRole({...person,comments:'Previously a Senior Associate at another firm.'}).comments,'Previously a Senior Associate at another firm.');
});
