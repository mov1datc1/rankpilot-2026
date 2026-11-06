require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Packer}=require('docx'),JSZip=require('jszip');
const {buildSubmissionDoc,stripAuditVoice,generateDynamicC2}=require('../../src/app/api/generate-docx/submission-builder.ts');
const {resolvePublication}=require('../../src/lib/audit/publication-policy.ts');
const {reviewPackage}=require('../../src/lib/audit/review-checkpoint.ts');
const {bindGeneratedFindings,renderedSubmissionFindings}=require('../../src/lib/editorial/artifact-findings.ts');
const {targetedRepair}=require('../../src/lib/editorial/jobs.ts');
const {anonymizeConfidentialClients}=require('../../src/lib/docx/lawyer-curator.ts');
const voiceRules=require('../../ai-engine/core/editorial_voice_rules.json');

test('actual voice regressions route every affected generated field to bounded repair',()=>{
 for(const text of voiceRules.reject) {
  const dev={b10:text,c2:text,matters:[{matter_id:'m',text,completion_status:text}],candidates:[{submission_bio:text}]};
  const findings=renderedSubmissionFindings(text,dev);
  assert.deepEqual(new Set(findings.map(d=>d.field_path)),new Set(['b10','c2','matters/0/text','matters/0/completion_status','candidates/0/submission_bio']),text);
  assert.ok(findings.every(d=>d.owner==='rankpilot' && d.severity==='critical' && d.retryable));
 }
 for(const text of voiceRules.allow)assert.deepEqual(renderedSubmissionFindings(text,{b10:text}),[],text);
});

for(const directory of ['Chambers','Legal 500']) for(const permissions of [{},{isConfidential:false,confidentialityConfirmed:false},{isConfidential:false,confidentialityStatus:'confirmation_required'}]) {
 test(`${directory}: uncertain permission stays restricted in actual DOCX public sections (${JSON.stringify(permissions)})`,async()=>{
  const m={id:'m',client:'ZEPHYRTEST INDUSTRIAL',name:'Permit appeal',summary:'The team represented ZEPHYRTEST INDUSTRIAL in a development permit appeal. The proceeding remains ongoing.',...permissions};
  const overview='Synthetic Firm represented ZEPHYRTEST INDUSTRIAL in a development permit appeal concerning a development site. The team challenged the decision and continues to advise on the pending proceeding. The mandate concerns the interaction between development permissions and property rights.';
  const d={firmName:'Synthetic Firm',practiceArea:'Real Estate',jurisdiction:'Mexico',enhanced_b10:overview,enhanced_b7:overview,enhanced_c2:overview+' The team supports property owners.',matters:[m]};
  const zip=await JSZip.loadAsync(await Packer.toBuffer(buildSubmissionDoc('Synthetic Firm','Real Estate',d,{targetDirectory:directory,practiceArea:'Real Estate',matters:[m]},'optimized')));
  const text=(await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g,'');
  const publicText=directory==='Chambers'?text.split('E. CONFIDENTIAL INFORMATION')[0]:text.split('DETAILED (NON-PUBLISHABLE) WORK HIGHLIGHTS')[0];
  assert.doesNotMatch(publicText,/ZEPHYRTEST/i);
  assert.match(text,/ZEPHYRTEST INDUSTRIAL/,'Identity must remain available in confidential work highlights');
 });
}
test('review input preserves permission conflicts and never fabricates confirmation',()=>{
 const m={id:'m',client:'Private',publish_status:'confidential',publishStatus:'confirmation_required',confidentialityConfirmed:false,isConfidential:true};
 const before=structuredClone(m),p=reviewPackage({targetDirectory:'Chambers'}, {},[m]).matters[0];
 assert.deepEqual(m,before);for(const k of Object.keys(m))assert.equal(p[k],m[k]);
 assert.equal(p.publication_route,'E');assert.equal(p.resolved_publication_status,'confirmation_required');
});
test('status aliases cannot hide restrictions behind casing or separators',()=>{
 for(const status of ['CONFIDENTIAL','non-publishable','unknown'])assert.notEqual(resolvePublication({isConfidential:false,confidentialityConfirmed:true,publish_status:status}),'publishable');
});
test('filtering an acceptance summary cannot turn a rejected verdict into approval',()=>{
 const {getDeliveryState}=require('../../src/lib/audit/delivery-state.ts');
 const matters=[{id:'m',client:'Synthetic Client',rawNotes:'The department represents the client in a pending tax appeal.',publish_status:'publishable',confidentialityConfirmed:true}];
 const data={firm_name:'Synthetic Firm',practice_area:'Tax',editorial_review:{},original_b10:'The department advises on tax appeals.',release_verdict:{passed:true,status:'passed',errors:[]}};
 assert.equal(getDeliveryState(data,matters).approved,true);
 data.release_verdict={passed:false,status:'needs_review',errors:['La aceptación editorial no está completa: executive_audit']};
 const result=getDeliveryState(data,matters);
 assert.equal(result.approved,false);
 assert.ok(result.errors.length);
 assert.ok(result.errors.some(message=>message.includes('sigue pendiente')));
});
test('formatting and anonymization cannot create judicial outcomes, ranks or missing facts',()=>{
 for(const text of ['Ana Pérez is identified as lead lawyer.','José Alberto Díaz Méndez is identified as lead partner.','The supplied status is ongoing and does not establish a final merits result.','The firm revoked the four suspensions.','ACME, S.A. DE C.V. In 2025, proceedings resumed.'])assert.equal(stripAuditVoice(text),text);
 const text='Ana Pérez is identified as lead lawyer and advises Bekaert Ideal S.L. on the acquisition of 80%.';
 assert.equal(anonymizeConfidentialClients(text,[]),text);
});
test('facts-scoped output defects route directly to bounded development repair',()=>{
 const claim='The firm obtained registration.',dev={version:'editorial-development-v2',matters:[{matter_id:'m',text:claim}]};
 const defect={code:'UNSUPPORTED_CLAIM',severity:'critical',owner:'rankpilot',scope:'facts',matter_id:'m',field_path:'rawNotes',source_quote:'Registration was refused.',artifact_quote:claim};
 const bound=bindGeneratedFindings([defect],dev)[0];assert.equal(bound.scope,'submission');assert.equal(bound.field_path,'matters/0/text');assert.equal(defect.field_path,'rawNotes');
 assert.deepEqual(targetedRepair({editorial_development:dev,final_artifact_review:{judge:{defects:[defect]}}}).tasks,['development','audit','artifact']);
 assert.equal(bindGeneratedFindings([{...defect,owner:'user'}],dev)[0].scope,'facts');
});

test('an internal candidacy attribution routes to its whole candidate and does not strand an Audit correction',()=>{
 const role='Lead lawyer of the litigation platform.';
 const dev={candidates:[{submission_bio:'Ana advises employers.',supporting_matters:[{matter_id:'m',personal_role:role,source_quote:'Laura led the matter.'}]}]};
 const defect={code:'UNSUPPORTED_CLAIM',severity:'critical',owner:'rankpilot',scope:'strategy',field_path:'leadPartner',matter_id:'m',source_quote:'Laura led the matter.',artifact_quote:role};
 const bound=bindGeneratedFindings([defect],dev)[0];
 assert.equal(bound.scope,'submission');assert.equal(bound.field_path,'candidates/0');
 assert.deepEqual(targetedRepair({editorial_development:dev,final_artifact_review:{judge:{defects:[defect,{code:'SELECTION_MISMATCH',severity:'critical',owner:'rankpilot',scope:'letter',artifact_quote:'Core matter incorrectly called reserve.'}]}}}).tasks,['development','audit','artifact']);
 assert.deepEqual(renderedSubmissionFindings('Ana advises employers.',dev),[]);
});
test('exact-text preflight finds known styles cheaply without deleting source-backed content',()=>{
 const text='The record separately lists a header amount. The mandate is ongoing and no final outcome is stated.';
 const dev={matters:[{matter_id:'m',text}]};const faults=renderedSubmissionFindings(text,dev);
 assert.equal(faults.length,1);assert.equal(faults[0].field_path,'matters/0/text');assert.equal(faults[0].artifact_quote,text);
 assert.equal(renderedSubmissionFindings('A different document.',dev).length,0);
 assert.equal(renderedSubmissionFindings('The team audited payroll and presented evidence to the court.',{matters:[{matter_id:'m',text:'The team audited payroll and presented evidence to the court.'}]}).length,0);
});
test('C2 fallback does not invent peer standing, partner leadership or invite referees',()=>{
 const c2=generateDynamicC2('Synthetic Firm','Tax','Mexico',[],[],[],{},{});
 assert.doesNotMatch(c2,/partner-led|measurable commercial outcomes|ranked market peers|invite|welcome|seasoned/i);
});
test('confidential source snippets cannot reidentify projects in a public lawyer profile',()=>{
 const {buildLawyerStandoutWork}=require('../../src/lib/docx/lawyer-curator.ts');
 const result=buildLawyerStandoutWork('Sofia Vega',[{id:'m',client:'Private Client',isConfidential:true,leadPartner:'Sofia Vega',optimizedText:'The Energía Mayakan project and Cuxtal II expansion involved USD2 billion across six named states.'}],['Private Client'],'','Sofia Vega advises employers on multi-site integrations.','Labour & Employment');
 assert.equal(result,'');
});
test('a reviewed candidacy bio is not supplemented with unreviewed source snippets',()=>{
 const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
 const [lawyer]=curateLawyers([{name:'Sofia Vega',bio:'Old biography.'}],
  [{id:'m',client:'Public Client',publish_status:'publishable',confidentialityConfirmed:true,leadPartner:'Sofia Vega',optimizedText:'A separate source narrative.'}],
  'Synthetic Firm','Tax','Mexico',{editorial_development:{candidates:[{name:'Sofia Vega',submission_bio:'Sofia Vega leads the documented tax appeal.',recommendation:'present'}]}});
 assert.equal(lawyer.bio,'Sofia Vega leads the documented tax appeal.');
 assert.equal(lawyer.standoutWork,'');
});
test('a rejected current claim can be repaired without overwriting unaffected human edits or source fields',()=>{
 const {projectDevelopment}=require('../../src/lib/editorial/development.ts');
 const data={matters:[{id:'m',rawNotes:'The appeal is pending.',optimizedText:'The team won.',draft_provenance:{text_hash:'older-hash'}}]};
 const state={development_validated:true,strategy:{matters:[{matter_id:'m',disposition:'core'}]},development:{version:'editorial-development-v2',matters:[{matter_id:'m',text:'The team represents the client in a pending appeal.'}]}};
 assert.equal(projectDevelopment(data,state).matters[0].optimizedText,'The team won.');
 const fixed=projectDevelopment(data,{...state,repair_feedback:[{owner:'rankpilot',severity:'critical',scope:'facts',matter_id:'m',artifact_quote:'The team won.'}]});
 assert.equal(fixed.matters[0].optimizedText,state.development.matters[0].text);assert.equal(fixed.matters[0].rawNotes,data.matters[0].rawNotes);
 assert.equal(data.matters[0].optimizedText,'The team won.');
});

test('draft download preserves the saved pair and refuses corruption or stale inputs',()=>{
 const {artifactHash,draftInputHash,storedDraftBytes}=require('../../src/lib/audit/artifact-binding.ts');
 const sub={practiceArea:'Tax',targetDirectory:'Chambers'}, data={enhanced_b10:'Current prose.',release_verdict:{passed:false}};
 const bytes=Buffer.from('exact saved draft bytes');
 data.draft_artifact={base64:bytes.toString('base64'),sha256:artifactHash(bytes),audit_base64:bytes.toString('base64'),audit_sha256:artifactHash(bytes)};
 data.draft_artifact.input_hash=draftInputHash(sub,data);
 assert.deepEqual(storedDraftBytes(sub,data,'submission'),bytes);
 assert.deepEqual(storedDraftBytes(sub,data,'audit'),bytes);
 data.enhanced_b10='Edited prose.';assert.equal(storedDraftBytes(sub,data,'submission'),null);
 data.enhanced_b10='Current prose.';data.draft_artifact.base64=Buffer.from('corrupted').toString('base64');
 assert.throws(()=>storedDraftBytes(sub,data,'submission'),/DRAFT_ARTIFACT_CORRUPTED/);
 assert.equal(data.release_verdict.passed,false);
});

test('starting a failed repair preserves exact draft bytes including E8, but source or prose edits invalidate them',()=>{
 const {artifactHash,deliveryInputHash,draftInputHash,storedDraftBytes}=require('../../src/lib/audit/artifact-binding.ts');
 const sub={practiceArea:'Tax',targetDirectory:'Chambers'};
 for(const legacy of [false,true]) {
  const data={matters:[{id:'m',rawNotes:'Interim relief granted.',editorial_completion_status:'Interim relief granted.'}],completed_review_input_hash:'review-revision',review_checkpoint:{state:{development_validated:true}}};
  const bytes=Buffer.from('Exact reviewed E8 and narrative');
  const binding=legacy?deliveryInputHash(sub,data):draftInputHash(sub,data);
  data.draft_artifact={base64:bytes.toString('base64'),sha256:artifactHash(bytes),input_hash:binding,revision_id:'review-revision'};
  data.completed_review_input_hash=null;data.review_checkpoint.state.development_validated=false;
  data.release_verdict={passed:false,status:'repairing'};
  assert.deepEqual(storedDraftBytes(sub,data,'submission'),bytes);
  for(const key of ['rawNotes','editorial_completion_status']) {
   const edited=structuredClone(data);edited.matters[0][key]='Changed';
   assert.equal(storedDraftBytes(sub,edited,'submission'),null);
  }
  assert.equal(data.release_verdict.passed,false);
 }
});

test('source semantics survive generated-field binding for sector and outcome repairs',()=>{
 const claim='The disputed claim.',dev={matters:[{matter_id:'m',text:claim}]};
 for(const [field,resolution] of [['client_sector','omit_nonessential_descriptor'],['outcome','qualify_disputed_outcome']]){
  const defect={code:'SOURCE_CONFLICT',severity:'critical',owner:'rankpilot',scope:'submission',matter_id:'m',field_path:field,artifact_quote:claim,conflicting_artifact_term:'disputed',conflict_resolution:resolution,qualification_validated:true};
  const bound=bindGeneratedFindings([defect],dev)[0];
  assert.equal(bound.field_path,'matters/0/text');assert.equal(bound.source_field_path,field);
  assert.equal(bindGeneratedFindings([bound],dev)[0].source_field_path,field);
  assert.equal(defect.field_path,field);assert.equal(defect.source_field_path,undefined);
  assert.deepEqual(targetedRepair({editorial_development:dev,final_artifact_review:{judge:{defects:[bound]}}}),{tasks:['development','audit','artifact'],letter:true});
  if(field==='outcome')assert.equal(targetedRepair({editorial_development:dev,final_artifact_review:{judge:{defects:[{...bound,qualification_validated:false}]}}}),null);
 }
});
