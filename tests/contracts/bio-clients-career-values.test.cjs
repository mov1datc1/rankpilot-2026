require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {departmentCareerMentions,bioOnlyClientNames,withoutCareerMentions}=require('../../src/lib/docx/career-evidence.ts');
const {anonymizeConfidentialClients}=require('../../src/lib/docx/lawyer-curator.ts');
const {implausibleValueWarnings}=require('../../src/lib/audit/value-plausibility.ts');

// Fictional shapes of the DeForest 18-11 defects (v1.0.100).
const development={candidates:[{name:'Ana Prado',profile_coverage:[
  {relationship:'client',entity_name:'Example Cable'},{relationship:'client',entity_name:'Open Foods'},
  {relationship:'former_employer',entity_name:'Example Motors'}]}]};

test('a client named only in a lawyer profile is anonymized as a client unless its own matter is publishable',()=>{
  const names=bioOnlyClientNames(development,['Open Foods']);
  assert.deepEqual(names,['Example Cable']);
  const bio='Ana also leads preventive frameworks for Example Cable and advises Open Foods.';
  const result=anonymizeConfidentialClients(bio,names,[],names);
  assert.equal(result,'Ana also leads preventive frameworks for a confidential client and advises Open Foods.');
  assert.deepEqual(bioOnlyClientNames({candidates:[{profile_coverage:[{relationship:'client',entity_name:'AB'}]}]}),[]);
});

test('a department sentence keeps a lawyer\'s former employer that is also a confidential client; client work does not',()=>{
  const lawyers=[{name:'Ana Prado',career:[{entity:'Example Motors',quote:'Ana spent decades at Example Motors.'}]}];
  const b10='Ana Prado brings nearly four decades of labour-relations experience at Example Motors, including as General Legal Director. We advise Example Motors on collective disputes.';
  const mentions=departmentCareerMentions(b10,lawyers);
  assert.equal(mentions.length,1);
  const result=anonymizeConfidentialClients(b10,['Example Motors'],mentions);
  assert.ok(result.startsWith('Ana Prado brings nearly four decades of labour-relations experience at Example Motors'));
  assert.ok(result.includes('We advise a confidential entity on collective disputes.') || result.includes('We advise a confidential client on collective disputes.'));
  // The integrity check still sees the client-work occurrence as a leak.
  assert.ok(withoutCareerMentions(b10,mentions).includes('We advise Example Motors'));
  assert.ok(!withoutCareerMentions(result,mentions).includes('Example Motors'));
  // No lawyer name, no career marker, or firm work in the same sentence: no exemption.
  for (const sentence of ['The team brings decades of experience at Example Motors.','Ana Prado works with Example Motors.','Ana Prado spent years advising Example Motors.'])
    assert.deepEqual(departmentCareerMentions(sentence,lawyers),[]);
});

test('a declared value out of all proportion to the matter is flagged; distinct concepts are not',()=>{
  const flagged=implausibleValueWarnings([{client:'Example HR',value:'US$ 104,000,000.45',rawNotes:'Matter value: US$ 104,000,000.45. Inspections concluded without fines despite exposure approaching MXN 2 million.'}]);
  assert.equal(flagged.length,1);assert.match(flagged[0],/Example HR/);
  assert.deepEqual(implausibleValueWarnings([
    {client:'Pipeline',value:'approx. USD 252,000',rawNotes:'Project valued at USD 2.5 billion.'},
    {client:'Metro',value:'US$ 1,144,523.00',rawNotes:'A USD 552 million development; exposure of MXN 21.5 million.'},
    {client:'Only value',value:'US$ 9,000,000',rawNotes:'No other figures.'},
    {client:'Small',value:'US$ 40,000',rawNotes:'Litigation valued at MXN 750,000.'},
  ]),[]);
});
