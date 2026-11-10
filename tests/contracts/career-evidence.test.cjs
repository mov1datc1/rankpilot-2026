require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {careerMentions,withoutCareerMentions}=require('../../src/lib/docx/career-evidence.ts');
const {anonymizeConfidentialClients,curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');

const source='Ana served as Legal Director at Example Manufacturing for twenty years.';
const person={name:'Ana Prado',bio:source};
const quote='Ana previously served as Legal Director at Example Manufacturing.';
const candidate={name:person.name,submission_bio:quote+' The firm advises Example Manufacturing in confidential proceedings.',
  profile_coverage:[{reference:'P01',relationship:'former_employer',entity_name:'Example Manufacturing',decision:'retain',privacy_basis:null,source_quote:source,public_quote:quote}]};

test('bound former employer survives but the same identity as a client is anonymized',()=>{
  const mentions=careerMentions(person,candidate);
  const result=anonymizeConfidentialClients(candidate.submission_bio,['Example Manufacturing'],mentions);
  assert.ok(result.startsWith(quote));
  assert.ok(result.includes('The firm advises a confidential client'));
  assert.equal(result.match(/Example Manufacturing/g).length,1);
  const publicCheck=withoutCareerMentions(candidate.submission_bio,mentions);
  assert.ok(publicCheck.includes('The firm advises Example Manufacturing')); // still a detected leak
  assert.ok(!withoutCareerMentions(result,mentions).includes('Example Manufacturing'));
  assert.equal(anonymizeConfidentialClients(result,['Example Manufacturing'],mentions),result); // second rendering pass
});

test('unbound, restricted, another person or ambiguous career evidence cannot exempt a name',()=>{
  for (const alter of [
    c=>{c.name='Other Person';},
    c=>{c.profile_coverage[0].source_quote='Not in the original profile';},
    c=>{c.profile_coverage[0].relationship='client';},
    c=>{c.profile_coverage[0].decision='generalize';},
    c=>{c.profile_coverage[0].privacy_basis={kind:'profile_restriction'};},
  ]) {
    const c=structuredClone(candidate);alter(c);assert.deepEqual(careerMentions(person,c),[]);
  }
  const duplicate=candidate.submission_bio+' '+quote;
  assert.ok(!anonymizeConfidentialClients(duplicate,['Example Manufacturing'],careerMentions(person,candidate)).includes('Example Manufacturing'));
  assert.ok(!anonymizeConfidentialClients('Example Manufacturing leads the market.',['Example Manufacturing'],careerMentions(person,candidate)).includes('Example Manufacturing'));
});

test('Word B9 retains a sourced career credential through curation and rendering',async()=>{
  const {Packer}=require('docx');const JSZip=require('jszip');
  const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
  const data={lawyers:[person],matters:[],editorial_development:{candidates:[candidate],b10:'A sourced practice description.',c2:'Coverage requested for the practice.'}};
  // Add a confidential mandate involving the employer; it must not turn the
  // person's separate career into a confidential client reference.
  data.matters=[{id:'m1',client:'Example Manufacturing',publish_status:'confidential',confidentialityConfirmed:true,isConfidential:true,summary:'Confidential employment work.'}];
  const lawyers=curateLawyers(data.lawyers,data.matters,'Firm','Labour & Employment','Mexico',data);
  assert.ok(lawyers[0].bio.includes(quote));
  const bytes=await Packer.toBuffer(buildSubmissionDoc('Firm','Labour & Employment',data,{practiceArea:'Labour & Employment',chambersData:data},'draft'));
  const xml=await(await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
  assert.ok(xml.includes(quote));
  assert.ok(!xml.includes('The firm advises Example Manufacturing'));
});
