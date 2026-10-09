require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Packer}=require('docx');
const JSZip=require('jszip');
const {buildAuditDoc}=require('../../src/app/api/generate-docx/audit-builder.ts');
const {curateMatters}=require('../../src/lib/docx/matter-curator.ts');
const {anonymizeConfidentialClients}=require('../../src/lib/docx/lawyer-curator.ts');
const {getDeliveryState}=require('../../src/lib/audit/delivery-state.ts');
const {judgeSolExtractionAudit}=require('../../src/lib/audit/extraction-auditor.ts');
const {evaluateStrategicSufficiency}=require('../../src/lib/audit/evidence-sufficiency-gate.ts');
const practices=['Real Estate','Labour & Employment','Tax','Corporate/M&A','Banking','Energy','Competition','Intellectual Property','Data Protection','Disputes'];
const matter=(id,extra={})=>({id,client:`Synthetic ${id}`,name:`Matter ${id}`,summary:'The team represented the client in proceedings. The outcome is pending.',publish_status:'publishable',isConfidential:false,...extra});
for(const practice of practices) {
 for(const count of [0,1,8,20]) test(`${practice}: audit with ${count} matters contains only supplied facts`,async()=>{
  const matters=Array.from({length:count},(_,i)=>matter(String(i)));
  const doc=buildAuditDoc('Synthetic Firm',practice,{score:12},{},{},{practiceArea:practice,matters,chambersData:{release_verdict:{passed:false,status:'blocked'}}});
  const zip=await JSZip.loadAsync(await Packer.toBuffer(doc));const text=(await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g,'');
  assert.ok(text.includes(`${count} distinct source matters`));
  assert.ok(text.includes('not approved for final delivery'));
  assert.doesNotMatch(text,/Eduardo Garduño|José Pablo Ramos|Raymundo Carreño|Certified Defensibility Score|Band 5|Band 4/);
 });
 for(const mode of ['A','B']) for(const variant of ['complete','empty','duplicate','excluded','unconfirmed','canonical']) test(`${practice}/${mode}/${variant}: register and release invariants`,()=>{
  // Mode labels exercise the shared contract, not browser uploads or parsers.
  let matters=[matter('1'),matter('2')];let data={release_verdict:{passed:true,status:'passed'}};
  if(variant==='empty')matters=[];
  if(variant==='duplicate')matters.push(matter('1'));
  if(variant==='excluded')matters[0].isExcluded=true;
  if(variant==='unconfirmed')Object.assign(matters[0],{confidentialityConfirmed:false,publish_status:'confirmation_required'});
  if(variant==='canonical')data.canonical_matter_selection={core_matter_ids:['2']};
  const c=curateMatters(matters,practice,data);
  const selected=[...c.officialPubMatters,...c.officialConfMatters];const rest=[...c.surplusPubMatters,...c.surplusConfMatters];
  assert.equal(new Set([...selected,...rest].map(m=>m.id)).size,selected.length+rest.length);
  if(variant==='excluded')assert.ok(rest.some(m=>m.id==='1'));
  if(variant==='canonical')assert.deepEqual(selected.map(m=>m.id),['2']);
  if(variant==='unconfirmed')assert.ok(c.officialConfMatters.some(m=>m.id==='1'));
  assert.equal(getDeliveryState(data,matters).approved,!['empty','duplicate','unconfirmed'].includes(variant));
 });
}
test('rename and reorder do not rewrite canonical selection',()=>{
 const data={canonical_matter_selection:{core_matter_ids:['b','a'],hero_matter_id:'a'}};
 for(const name of ['Schaeffler','El Cielo','Unseen Client']) {
  const original=[matter('a',{client:name}),matter('b')];
  const c=curateMatters(original.reverse(),'Real Estate',data);
  assert.deepEqual(c.officialPubMatters.map(m=>m.id),['b','a']);
  assert.equal(c.officialPubMatters.find(m=>m.isHero).id,'a');
  assert.equal(original[1].isHero,undefined);
 }
});
test('all-public canonical selection retains twenty',()=>{
 const matters=Array.from({length:20},(_,i)=>matter(String(i)));
 assert.equal(curateMatters(matters,'Tax',{canonical_matter_selection:{core_matter_ids:matters.map(m=>m.id)}}).totalOfficialCount,20);
});
test('unknown confidentiality stays unconfirmed and restricted',()=>{
 const m=judgeSolExtractionAudit({matters:[matter('1',{confidentialityConfirmed:false,publish_status:'confirmation_required'})],practiceArea:'Tax'}).healedMatters[0];
 assert.equal(m.isConfidential,true);assert.equal(m.confidentialityConfirmed,false);assert.equal(m.publish_status,'confirmation_required');
});
test('no entity substitutions without supplied confidentiality; short names masked',()=>{
 const input='Our office is in Hermosillo. We advised Volkswagen and VW.';
 assert.equal(anonymizeConfidentialClients(input,[]),input);
 assert.ok(!anonymizeConfidentialClients(input,['VW']).includes(' VW.'));
});
test('empty records cannot support strategic sufficiency',()=>{
 assert.equal(evaluateStrategicSufficiency({matters:Array.from({length:20},(_,i)=>({id:String(i)})),practiceArea:'Tax'}).status,'insufficient');
});
test('contradictory release cannot pass',()=>{
 assert.equal(getDeliveryState({release_verdict:{passed:false,status:'passed'}},[matter('1')]).approved,false);
 assert.equal(getDeliveryState({release_verdict:{passed:true,status:'blocked'}},[matter('1')]).approved,false);
});
const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {buildSubmissionDoc,ensureEnglishMatterSummary}=require('../../src/app/api/generate-docx/submission-builder.ts');
test('roster does not infer rank, biography or partner role from a team mention',()=>{
 const roster=curateLawyers([{name:'Synthetic Lawyer'}],[matter('1',{teamMembers:'Synthetic Associate'})],'Synthetic Firm','Tax','Mexico',{});
 assert.equal(roster[0].currentRank,'');assert.equal(roster[0].suggestedRank,'');assert.equal(roster[0].bio,'');assert.equal(roster[0].isRanked,null);
 assert.equal(roster.find(l=>l.name==='Synthetic Associate'),undefined);
});
test('renderer cannot invent a translation from a known client name',()=>{
 const input='Representamos a Constructora FH3. No consta resultado.';
 assert.equal(ensureEnglishMatterSummary(input),input);
});
test('known client name does not change currency, outcome, timeline or lawyer ranking in DOCX',async()=>{
 for(const client of ['Coats','El Cielo','Unseen Client']){
  const source='A resolution is expected in early 2023. The matter remains pending.';
  const m=matter('1',{client,rawNotes:source,summary:source,optimizedText:source,value:'MXN 675,000',leadPartner:'Synthetic Lawyer'});
  const data={matters:[m],lawyers:[{name:'Synthetic Lawyer',isPartner:true}],canonical_matter_selection:{core_matter_ids:['1']},enhanced_b7:'The firm advises on tax appeals. The source does not state a final outcome.'};
  const doc=buildSubmissionDoc('Synthetic Firm','Tax',data,{practiceArea:'Tax',guideRegion:'Mexico',targetDirectory:'Chambers',matters:[m]},'optimized');
  const zip=await JSZip.loadAsync(await Packer.toBuffer(doc));const text=(await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g,'');
  assert.ok(text.includes(source));assert.ok(text.includes('MXN 675,000'));assert.doesNotMatch(text,/USD 675|July 2024|Suggested ranking: Band|Current ranking: Unranked/);
 }
});
test('public biographies suppress source-derived client aliases and mixed unconfirmed identity lists',()=>{
 const text='A partner advises clients such as XYZ, Unknown Client and Acme. XYZ retained the team.';
 const result=anonymizeConfidentialClients(text,['XYZ Industrial','Acme Manufacturing']);
 assert.doesNotMatch(result,/XYZ|Unknown Client|Acme/);
 assert.match(result,/A partner advises a range of clients/);
 assert.equal(anonymizeConfidentialClients('She is the Partner of the employment practice.',[]),'She is a partner in the employment practice.');
 assert.match(anonymizeConfidentialClients('Public Client retained the team.',['XYZ Industrial']),/Public Client/);
});

test('client aliases do not turn arbitrary first words of compound names into identities',()=>{
 const {clientAliases}=require('../../src/lib/docx/client-aliases.ts');
 assert.ok(!clientAliases(['American Widgets']).includes('American'));
 assert.ok(!clientAliases(['Richard Example']).includes('Richard'));
 assert.ok(clientAliases(['XYZ Industrial']).includes('XYZ'));
 assert.ok(clientAliases(['Fictional de México']).includes('Fictional'));
 assert.ok(clientAliases(['Example (ABC)']).includes('ABC'));
});

test('empty public section describes placement without inventing client instructions',async()=>{
 const m=matter('1',{publish_status:'non_publishable',isConfidential:true,confidentialityConfirmed:true});
 const data={matters:[m],canonical_matter_selection:{core_matter_ids:['1']}};
 const doc=buildSubmissionDoc('Synthetic Firm','Tax',data,{practiceArea:'Tax',guideRegion:'Mexico',targetDirectory:'Chambers',matters:[m]},'optimized');
 const zip=await JSZip.loadAsync(await Packer.toBuffer(doc));
 const text=(await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g,'');
 assert.match(text,/No publishable matters submitted/);
 assert.match(text,/Confidential matters are listed in Section E/);
 assert.doesNotMatch(text,/client confidentiality mandates|in accordance with client/);
});

test('anonymization preserves employment roles without inventing a client relationship',()=>{
 const names=['Synthetic Motors de México and Example Financial Services'];
 const result=anonymizeConfidentialClients('Maria was General Legal Director of Synthetic Motors de México for nearly four decades. The firm advises Synthetic Motors de México on confidential matters.',names);
 assert.match(result,/General Legal Director of a company for nearly four decades/);
 assert.match(result,/advises a confidential client on confidential matters/);
 assert.doesNotMatch(result,/Synthetic Motors|a confidential client de México|a company de México/);
});

test('Studio rejects historical artifact approval after a review contract update',()=>{
 const versions=require('../../src/lib/audit/review-versions.ts');
 const data={release_verdict:{passed:true},approved_artifact:{input_hash:'saved'},completed_review_policy_version:versions.REVIEW_POLICY_VERSION,completed_renderer_version:versions.RENDERER_VERSION,completed_artifact_review_version:versions.ARTIFACT_REVIEW_VERSION};
 assert.equal(getDeliveryState(data,[matter('1')],true).approved,true);
 for(const key of ['completed_review_policy_version','completed_renderer_version','completed_artifact_review_version']) {
   const stale={...data,[key]:'previous'};
   assert.equal(getDeliveryState(stale,[matter('1')],true).approved,false);
   assert.match(getDeliveryState(stale,[matter('1')],true).errors.join(' '),/revisión anterior/);
 }
});

test('open tabs follow the server review contract without accepting stale documents',()=>{
 const {REVIEW_CONTRACT}=require('../../src/lib/audit/review-versions.ts');
 const next={...REVIEW_CONTRACT,artifact:REVIEW_CONTRACT.artifact+1};
 const data={release_verdict:{passed:true},approved_artifact:{input_hash:'saved'},completed_review_policy_version:next.policy,completed_renderer_version:next.renderer,completed_artifact_review_version:next.artifact};
 assert.equal(getDeliveryState(data,[matter('1')],true).approved,false);
 assert.equal(getDeliveryState(data,[matter('1')],true,next).approved,true);
 assert.equal(getDeliveryState({...data,completed_artifact_review_version:REVIEW_CONTRACT.artifact},[matter('1')],true,next).approved,false);
 assert.equal(getDeliveryState({...data,release_verdict:{passed:false,errors:['Unresolved source conflict']}},[matter('1')],true,next).approved,false);
});

test('company profiles and locations never become confidential entity aliases',()=>{
 const {clientAliases}=require('../../src/lib/docx/client-aliases.ts');
 const aliases=clientAliases([
  'EXAMPLE HOLDINGS, S.A. DE C.V. Company engaged in the acquisition, administration, construction, development and leasing of real estate.',
  'SAMPLE PACKAGING MEXICO, located in Tlaquepaque, Jalisco. A packaging company.',
  'A global leader in the manufacture of packaging, design and processes. It is located in Jalisco.',
  'TRANSPORTES EXAMPLE (https://example.com/). It is a company based in Guadalajara.',
 ]);
 for(const word of ['administration','construction','development','processes','Jalisco','https://example.com/']) assert.ok(!aliases.includes(word),word);
 assert.ok(aliases.includes('EXAMPLE HOLDINGS, S.A. DE C.V.'));
 assert.ok(aliases.includes('SAMPLE PACKAGING MEXICO'));
 assert.ok(aliases.includes('TRANSPORTES EXAMPLE'));
 assert.match(anonymizeConfidentialClients('SAMPLE PACKAGING MEXICO retained us. Construction matters involve development.',aliases),/a confidential client retained us\. Construction matters involve development\./);
});

test('Word rendering never substitutes known lawyer names or surname order',()=>{
 const builder=require('../../src/app/api/generate-docx/submission-builder.ts');
 const checker=require('../../src/lib/docx/artifact-integrity-check.ts');
 for(const name of ['Daniel Peña Rocha','Mónica Dariane Cárdenas Fragoso','Edgar Adrian Moro','Unseen Person']) {
  assert.equal(builder.cleanLawyerNames(name),name);assert.equal(checker.cleanLawyerNames(name),name);
 }
});

test('D8 uses source-bound editorial status; original export and stale proposals retain source',async()=>{
 const {draftSourceHash}=require('../../src/lib/editorial/contracts.ts');
 const m=matter('status',{rawNotes:'Four interim orders were revoked. Sources disagree on the final outcome.',optimizedText:'The firm obtained revocation of four interim orders.',completionDate:'Original disputed final victory.',editorial_completion_status:'Four interim orders were revoked.'});
 m.draft_provenance={origin:'generated',source_hash:draftSourceHash(m)};
 for(const [mode,changed,expected] of [['optimized',false,'Four interim orders were revoked.'],['original',false,'Original disputed final victory.'],['optimized',true,'Corrected source status.']]) {
  const current=changed?{...m,completionDate:'Corrected source status.'}:m;
  const data={matters:[current],canonical_matter_selection:{core_matter_ids:['status']}};
  const zip=await JSZip.loadAsync(await Packer.toBuffer(buildSubmissionDoc('Example','Tax',data,{practiceArea:'Tax',guideRegion:'Mexico',targetDirectory:'Chambers',matters:[current]},mode)));
  const xml=await zip.file('word/document.xml').async('string');const text=xml.replace(/<[^>]+>/g,'');
  const status=text.slice(text.indexOf('D8 Date of completion or current status'));
  assert.ok(status.includes(expected),status);
  if(mode==='optimized'&&!changed)assert.ok(!status.includes('Original disputed final victory.'));
 }
});
test('legacy Word hyperlink instructions render as one literal link without losing adviser names',()=>{
 const {cleanTablePipes}=require('../../src/app/api/generate-docx/submission-builder.ts');
 assert.equal(cleanTablePipes('Example Advisors - HYPERLINK "https://example.test/a?lang=es"https://example.test/a?lang=es'), 'Example Advisors - https://example.test/a?lang=es');
 assert.equal(cleanTablePipes('HYPERLINK "https://example.test" Display label'), 'https://example.test Display label');
 assert.equal(cleanTablePipes('HYPERLINK is the name of an unrelated product'), 'HYPERLINK is the name of an unrelated product');
});
