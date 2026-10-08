require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {auditActions,recordAuditAction,auditActionHasResponse,normalizeRefereeNotes}=require('../../src/lib/audit/next-actions.ts');
const {reviewPackage,reviewStepHash,resumeReviewCheckpoint}=require('../../src/lib/audit/review-checkpoint.ts');
const {artifactHash,deliveryInputHash,previousApprovedArtifact}=require('../../src/lib/audit/artifact-binding.ts');
test('existing Audit actions have destinations including unknown wording; no task is a delivery verdict',()=>{
 const actions=auditActions({next_steps:'1. Confirmar ventana de investigación.\n2. Incorporar referencias de clientes para Ana.\n3. Definir categoría compatible con su cargo de socio.\n4. Completar contacto y número de socios.\n5. Aclarar denominación del cliente.'});
 assert.deepEqual(actions.map(a=>a.kind),['period','references','lawyers','filing','matters']);
 assert.equal(actions.some(a=>a.blocking),false);
});
test('responses require an actual change in the relevant fields, survive reload and never mark other tasks complete',()=>{
 const before={editorial_review:{letter:{next_steps:'1. Confirmar periodo.\n2. Completar contacto.'}}};const [a,b]=auditActions(before.editorial_review.letter);
 assert.deepEqual(recordAuditAction(before,{...before,lawyers:[{name:'Ana'}]},a.id,'u'),[]);
 const after={...before,research_period:{from:'2026-01-01',to:'2026-12-31'},draft_revision:2};
 after.audit_action_responses=recordAuditAction(before,after,a.id,'u');
 assert.equal(auditActionHasResponse(JSON.parse(JSON.stringify(after)),a),true);assert.equal(auditActionHasResponse(after,b),false);
 assert.equal(auditActionHasResponse({...after,research_period:null},a),false);
 assert.throws(()=>recordAuditAction(before,after,'changed recommendation','u'));
});
test('referee notes invalidate only the Audit stages, without repeating selection or development',()=>{
 const pkg=reviewPackage({targetDirectory:'Chambers',practiceArea:'Tax'},{},[]);
 const state={strategy:{matters:[],thesis:'',pending_questions:[]},selection_validated:true,selection_review_validated:true,development:{candidates:[]},development_validated:true,letter:{next_steps:'Ask references'},writer_validated:true};
 const step_keys=Object.fromEntries(['strategy','development','writer'].map(k=>[k,reviewStepHash(k,pkg,state)]));
 const updated={...pkg,internal_referee_notes:'Internal contact supplied by the firm'};
 const next=resumeReviewCheckpoint(updated,{created_at:Date.now(),state,step_keys});
 assert.equal(next.stage,'writer');assert.deepEqual(next.state.development,state.development);assert.deepEqual(next.state.strategy,state.strategy);
 assert.equal(normalizeRefereeNotes('  Contact  '),'Contact');assert.throws(()=>normalizeRefereeNotes({passed:true}));assert.throws(()=>normalizeRefereeNotes('x'.repeat(8001)));
});
test('history preserves only approved bytes bound to the pre-edit inputs and does not change approval hashes',()=>{
 const sub={practiceArea:'Tax',targetDirectory:'Chambers'};const data={release_verdict:{passed:true},lawyers:[]};
 const word=Buffer.from('test submission'),audit=Buffer.from('test audit');
 data.approved_artifact={input_hash:deliveryInputHash(sub,data),base64:word.toString('base64'),sha256:artifactHash(word),audit_base64:audit.toString('base64'),audit_sha256:artifactHash(audit)};
 const prior=previousApprovedArtifact(sub,data);assert.equal(prior.base64,data.approved_artifact.base64);assert.ok(prior.archived_at);
 assert.equal(deliveryInputHash(sub,{...data,previous_approved_artifact:prior}),deliveryInputHash(sub,data));
 assert.equal(previousApprovedArtifact(sub,{...data,lawyers:[{name:'changed'}]}),null);
 assert.equal(previousApprovedArtifact(sub,{...data,approved_artifact:{...data.approved_artifact,base64:'invalid'}}),null);
});
test('additional matter evidence retains the original extract, replaces only its own addition and requires provenance',()=>{
 const {supplementMatter}=require('../../src/lib/audit/next-actions.ts');
 const original={id:'m',rawNotes:'Original pending litigation.',source_excerpt:'Original pending litigation.',optimizedText:'Old draft'};
 const first=supplementMatter({...original,additionalEvidence:'Judgment issued.',additionalEvidenceSource:'Firm update dated 8 October'},original,'u');
 assert.equal(first.source_excerpt,original.source_excerpt);assert.equal(first.sourceNotesBeforeAddition,original.rawNotes);assert.equal(first.optimizedText,'');assert.ok(first.rawNotes.includes('Judgment issued.'));
 const second=supplementMatter({...first,additionalEvidence:'Appeal filed.'},first,'u');
 assert.ok(second.rawNotes.includes(original.rawNotes));assert.ok(!second.rawNotes.includes('Judgment issued.'));assert.ok(second.rawNotes.includes('Appeal filed.'));
 assert.equal(supplementMatter({...second,additionalEvidence:''},second,'u').rawNotes,original.rawNotes);
 assert.throws(()=>supplementMatter({...original,additionalEvidence:'New result'},original,'u'));
 assert.throws(()=>supplementMatter({additionalEvidence:'New result'},null,'u'));
});
test('new structured actions use model destinations and an empty list does not invent pending tasks',()=>{
 assert.deepEqual(auditActions({next_steps:'No actions needed',next_actions:[]}),[]);
 assert.equal(auditActions({next_actions:[{message:'Aportar el respaldo solicitado.',kind:'references'}]})[0].kind,'references');
});
