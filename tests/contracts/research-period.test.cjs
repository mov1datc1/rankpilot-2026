require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {proposedResearchPeriod,validResearchPeriod,initialResearchPeriod}=require('../../src/lib/audit/research-period.ts');

// v1.0.117: the research period is proposed before generating, not asked afterwards.
test('the proposal is the twelve months that end on the deadline, or today without one',()=>{
 const today=new Date('2026-11-25T18:00:00Z');
 assert.deepEqual(proposedResearchPeriod('2027-02-15T00:00:00.000Z',today),{from:'2026-02-15',to:'2027-02-15',basis:'deadline'});
 assert.deepEqual(proposedResearchPeriod(new Date('2027-02-15T00:00:00Z'),today),{from:'2026-02-15',to:'2027-02-15',basis:'deadline'});
 assert.deepEqual(proposedResearchPeriod(null,today),{from:'2025-11-25',to:'2026-11-25',basis:'today'});
 assert.deepEqual(proposedResearchPeriod('not a date',today),{from:'2025-11-25',to:'2026-11-25',basis:'today'});
});
test('a saved period is shown as confirmed and an invalid one is replaced by the proposal',()=>{
 const today=new Date('2026-11-25T18:00:00Z');
 assert.deepEqual(initialResearchPeriod({from:'2025-10-01',to:'2026-09-30',source:'User-confirmed submission instructions'},null,today),{from:'2025-10-01',to:'2026-09-30',confirmed:true});
 assert.deepEqual(initialResearchPeriod({from:'2026-09-30',to:'2025-10-01'},null,today),{from:'2025-11-25',to:'2026-11-25',confirmed:false});
 assert.deepEqual(initialResearchPeriod(undefined,'2027-02-15',today),{from:'2026-02-15',to:'2027-02-15',confirmed:false});
});
test('only real calendar dates in order are a period',()=>{
 assert.equal(validResearchPeriod('2025-11-25','2026-11-25'),true);
 assert.equal(validResearchPeriod('2026-11-25','2025-11-25'),false);
 assert.equal(validResearchPeriod('2026-02-30','2026-11-25'),false);
 assert.equal(validResearchPeriod('','2026-11-25'),false);
 assert.equal(validResearchPeriod('25/11/2025','2026-11-25'),false);
});
