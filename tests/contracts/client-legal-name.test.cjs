require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sanitizeClientName,recoverClientLegalName}=require('../../src/lib/audit/extraction-auditor.ts');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {Packer}=require('docx');
const JSZip=require('jszip');

test('legal suffixes, initials and ambiguous descriptions are preserved',()=>{
 for(const name of ['Example México, S.A. de C.V.','Example, S. de R.L. de C.V.','Example Inc.','J. Smith','Example. Unclassified text']) {
  assert.equal(sanitizeClientName(name).cleanClient,name);
  assert.equal(sanitizeClientName(name).wasModified,false);
 }
 assert.equal(sanitizeClientName('Example Club. A first class development').cleanClient,'Example Club');
 assert.equal(sanitizeClientName('Example, S.A. de C.V. is a company').cleanClient,'Example, S.A. de C.V.');
});

test('legacy recovery requires both the displaced suffix and an unambiguous literal source',()=>{
 const m={client:'Example, S.A',clientDescription:'de C.V.',source_excerpt:'Client: Example, S.A. de C.V.'};
 assert.equal(recoverClientLegalName(m),'Example, S.A. de C.V.');
 assert.equal(m.client,'Example, S.A');
 for(const change of [{source_excerpt:''},{source_excerpt:'Client: Other, S.A. de C.V.'},{clientDescription:'A business'},{client:'Human edited name'},{source_excerpt:m.source_excerpt+'\nClient: Other, S.A. de C.V.'}]) {
  assert.equal(recoverClientLegalName({...m,...change}),change.client||m.client);
 }
});

test('DOCX client list and matter table recover source-backed legacy names without changing stored input',async()=>{
 for(const confidential of [false,true]) {
  const m={id:'m1',client:'Example, S.A',clientDescription:'de C.V.',source_excerpt:'Client: Example, S.A. de C.V.',isConfidential:confidential,publish_status:confidential?'non_publishable':'publishable',confidentialityConfirmed:true,summary:'The team advised the client.'};
  const data={matters:[m],canonical_matter_selection:{core_matter_ids:['m1']}};
  const doc=buildSubmissionDoc('Synthetic Firm','Tax',data,{matters:[m],targetDirectory:'Chambers',guideRegion:'Mexico'},'optimized');
  const zip=await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml=await zip.file('word/document.xml').async('string');
  assert.ok((xml.match(/Example, S\.A\. de C\.V\./g)||[]).length>=2);
  assert.equal(m.client,'Example, S.A');
 }
});
