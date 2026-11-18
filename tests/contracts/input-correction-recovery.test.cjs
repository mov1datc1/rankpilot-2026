require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {canVerifyInputCorrections,waitingForSourceInput,publicJob}=require('../../src/lib/editorial/jobs.ts');
const {editorialNextAction}=require('../../src/lib/editorial/next-action.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');

// Shape of Ángela's DeForest job (18-11, v1.0.98): the artifact judge found a
// user-owned publication question plus generated defects; the pre-v1.0.99
// supervisor scheduled ['development','audit'] without the judge and the job
// ended as needs_review at audit with no files and a "refresh" next step.
const correction={action:'repair',reason:'generated_corrections_before_source_input',repair:{tasks:['development','audit'],letter:true}};
const stoppedJob=(sourceHash)=>({id:'j',status:'needs_review',stage:'audit',cursor:6,sourceHash,
 tasks:['selection','development','audit','artifact','development','audit'],
 ledger:[{stage:'artifact',supervision:correction,trace:{usage:{total_tokens:10}}},{stage:'development',trace:{usage:{total_tokens:10}}},{stage:'audit',status:'needs_review',trace:{usage:{total_tokens:10}}}]});
const savedData=()=>({final_review_stale:true,
 final_artifact_review:{judge:{defects:[{severity:'critical',owner:'user',code:'PUBLICATION_PERMISSION',message:'Megacable'}]}},
 review_checkpoint:{state:{selection_validated:true,development_validated:false,development_delivery_ready:true,writer_validated:false,writer_delivery_ready:true}}});

test('a job stopped after the correction preceding a source question resumes once with only the judge',()=>{
 const job=stoppedJob('h'),data=savedData();
 assert.equal(canVerifyInputCorrections(job,data,'h'),true);
 assert.equal(canVerifyInputCorrections(job,data,'changed-source'),false);
 assert.equal(canVerifyInputCorrections({...job,status:'running'},data,'h'),false);
 // Once requested, the marker prevents a second free judge.
 assert.equal(canVerifyInputCorrections({...job,ledger:[...job.ledger,{status:'input_corrections_verification_requested'}]},data,'h'),false);
 // New behaviour already includes the judge: nothing to recover.
 assert.equal(canVerifyInputCorrections({...job,ledger:[{supervision:{...correction,repair:{tasks:['development','audit','artifact'],letter:true}}}]},data,'h'),false);
 // Unknown provider usage is never resumed automatically.
 assert.equal(canVerifyInputCorrections({...job,ledger:[...job.ledger,{trace:{usage:{unknown_calls:1}}}]},data,'h'),false);
 // The judge cannot run without delivery-ready construction.
 const notReady=savedData();notReady.review_checkpoint.state.development_delivery_ready=false;
 assert.equal(canVerifyInputCorrections(job,notReady,'h'),false);
});

test('the Studio says the corrections are being verified, never a refresh loop',()=>{
 const source={targetDirectory:'Chambers',practiceArea:'Labour & Employment',chambersData:{...savedData(),matters:[{id:'m',rawNotes:'Original.'}]}};
 const job=stoppedJob(stableHash(sourceSnapshot(source)));
 const view=publicJob(job,source);
 assert.equal(view.nextAction.kind,'wait');assert.match(view.nextAction.title,/Verificando las correcciones/);
});

test('a real pending answer after a correction asks for the answer instead of a refresh',()=>{
 const ledger=[{supervision:correction}];
 assert.equal(editorialNextAction({status:'needs_review',ledger},{}).kind,'refresh');
 assert.equal(editorialNextAction({status:'needs_review',ledger},{waitingForInput:true}).kind,'answer');
 assert.equal(editorialNextAction({status:'needs_review',ledger},{waitingForInput:true,documentsAvailable:true}).kind,'download');
 const job={status:'needs_review',sourceHash:'h',ledger};
 assert.equal(waitingForSourceInput(job,savedData(),'h'),true);
});
