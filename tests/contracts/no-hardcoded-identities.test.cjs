require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {buildSubmissionDoc}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {Packer}=require('docx'),JSZip=require('jszip');
const read=p=>fs.readFileSync(require.resolve(p),'utf8');
const code=text=>text.split('\n').filter(l=>!/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// v1.0.109: the tool works by rules for any firm; no firm, lawyer or client name may drive behaviour.
test('live renderer and scope code contain no firm, lawyer or client names',()=>{
 const files={builder:'../../src/app/api/generate-docx/submission-builder.ts',jurisdiction:'../../src/lib/jurisdiction.ts',
  curator:'../../src/lib/docx/lawyer-curator.ts',report:'../../src/app/reports/[id]/page.tsx'};
 for(const [name,path] of Object.entries(files))
  assert.doesNotMatch(code(read(path)),/deforest|araquereyna|ramos castillo|garru[ñn]o|gardu[ñn]o|carolina cano|schaeffler|bonatti|@deforest/i,name);
});
test('department heads are never invented from the firm name',async()=>{
 const data={lawyers:[],matters:[],enhanced_b10:'The practice advises employers.',enhanced_c2:'The firm requests coverage.'};
 const doc=buildSubmissionDoc('DeForest Abogados','Labour & Employment',data,{targetDirectory:'Legal 500',practiceArea:'Labour & Employment',guideRegion:'Mexico',matters:[]},'optimized');
 const xml=await (await JSZip.loadAsync(await Packer.toBuffer(doc))).file('word/document.xml').async('string');
 assert.doesNotMatch(xml,/@deforest\.law|Eduardo Gardu/);
});
test('a "Client:" form label is not printed as part of the client name',async()=>{
 const matter={id:'m',client:'Client: Example Motors',isConfidential:true,publish_status:'confidential',rawNotes:'The team led negotiations.',optimizedText:'The team led negotiations.'};
 const data={lawyers:[],matters:[matter],enhanced_b10:'The practice handles negotiations.',enhanced_c2:'The firm requests coverage.',canonical_matter_selection:{core_matter_ids:['m'],hero_matter_id:'m'}};
 const doc=buildSubmissionDoc('Synthetic Firm','Tax',data,{targetDirectory:'Chambers',practiceArea:'Tax',guideRegion:'Mexico',matters:[matter]},'optimized');
 const text=(await (await JSZip.loadAsync(await Packer.toBuffer(doc))).file('word/document.xml').async('string')).replace(/<[^>]+>/g,'|');
 assert.match(text,/\|Example Motors\|/);assert.doesNotMatch(text,/Client: Example Motors/);
});
test('the practice filter of a profile never depends on a person name',()=>{
 const lawyers=[{name:'Maria Carolina Cano',isPartner:true,bio:'She advises on corporate transactions.',suggestedRank:'Band 2'}];
 assert.equal(curateLawyers(lawyers,[],'Firm','Corporate/M&A','Venezuela',{})[0].suggestedRank,'Band 2');
});
test('the judge does not review the deterministic checklist of the Audit',()=>{
 assert.match(read('../../src/app/api/optimize/complete/route.ts'),/split\('6\. Verificaciones antes de presentar'\)\[0\]/);
});
