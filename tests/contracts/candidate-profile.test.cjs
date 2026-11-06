require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {anonymizeConfidentialClients,curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {wordTableProfiles,wordXmlText}=require('../../src/lib/docx/xml-text.ts');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {Packer}=require('docx'),JSZip=require('jszip');
const {supportedDevelopment}=require('../../src/lib/editorial/development.ts');

test('career and professional association mentions cannot become invented clients',()=>{
 const input='Her background includes nearly four decades at Example Motors, including service as General Legal Director. She chairs a commission at Example Federation.';
 const out=anonymizeConfidentialClients(input,['Example Motors','Example Federation']);
 assert.match(out,/four decades at a confidential entity/);assert.match(out,/General Legal Director/);
 assert.match(out,/commission at a confidential entity/);assert.doesNotMatch(out,/confidential client|Example Motors|Example Federation/);
 assert.equal(anonymizeConfidentialClients(out,['Example Motors','Example Federation']),out);
 assert.doesNotMatch(anonymizeConfidentialClients('She advised Example Motors as an in-house employee.',['Example Motors']),/confidential client/);
 assert.match(anonymizeConfidentialClients('The firm advises Example Motors.',['Example Motors']),/advises a confidential client/);
});
test('an unspecified pending category stays internal rather than being printed as a nomination',()=>{
 const lawyers=[{name:'Sofia Vega',isPartner:true,bio:'Sofia is a Partner.'}];
 const data={editorial_development:{version:'editorial-development-v4',candidates:[{name:'Sofia Vega',recommendation:'present',suggested_ranking:'Category pending',submission_bio:'Sofia is a Partner with a documented career.'}]}};
 assert.equal(curateLawyers(lawyers,[],'Firm','Tax','Mexico',data)[0].suggestedRank,'');
 data.editorial_development.candidates[0].suggested_ranking='Band 5 candidate';
 assert.equal(curateLawyers(lawyers,[],'Firm','Tax','Mexico',data)[0].suggestedRank,'Band 5 candidate');
 for(const version of ['v1','v2','v3','v4'])assert.ok(supportedDevelopment({version:'editorial-development-'+version}));
});
test('final profile projection is taken from the exact Word after anonymization',async()=>{
 const matter={id:'m',client:'Example Motors',isConfidential:true,publish_status:'confidential',rawNotes:'The team led negotiations.',optimizedText:'The team led negotiations.'};
 const bio='Her background includes nearly four decades at Example Motors, including service as General Legal Director.';
 const data={lawyers:[{name:'Sofia Vega',isPartner:true,bio}],matters:[matter],enhanced_b10:'The practice handles negotiations.',enhanced_c2:'The firm requests coverage.',editorial_development:{version:'editorial-development-v4',candidates:[{name:'Sofia Vega',recommendation:'develop',submission_bio:bio}]},canonical_matter_selection:{core_matter_ids:['m'],hero_matter_id:'m'}};
 const doc=buildSubmissionDoc('Synthetic Firm','Tax',data,{targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',matters:[matter]},'optimized');
 const zip=await JSZip.loadAsync(await Packer.toBuffer(doc)),xml=await zip.file('word/document.xml').async('string');
 const profiles=wordTableProfiles(xml,['Sofia Vega']);assert.ok(profiles['Sofia Vega']);
 assert.match(profiles['Sofia Vega'],/four decades at a confidential entity/);assert.doesNotMatch(profiles['Sofia Vega'],/Example Motors|confidential client/);
 assert.ok(wordXmlText(xml).includes(profiles['Sofia Vega'].split('\n').find(x=>x.includes('four decades'))));
});
test('contact and interview rows do not substitute for biography rows',()=>{
 const xml='<w:tr><w:tc><w:p><w:t>Sofia Vega</w:t></w:p></w:tc><w:tc><w:p><w:t>sofia@example.test</w:t></w:p></w:tc></w:tr>';
 assert.deepEqual(wordTableProfiles(xml,['Sofia Vega']),{});
});
