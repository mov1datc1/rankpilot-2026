require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {projectDevelopment}=require('../../src/lib/editorial/development.ts');
const {sourceSnapshot,stableHash}=require('../../src/lib/editorial/contracts.ts');
const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {generateDynamicC2}=require('../../src/app/api/generate-docx/submission-builder.ts');
const data={original_b10:'Tax team',lawyers:[{name:'Sofia Vega',isPartner:true,bio:'Tax lawyer.'}],matters:[{id:'m1',client:'Private Client',publish_status:'non_publishable',isConfidential:true,source_excerpt:'Sofia Vega led negotiations; exposure fell 80%.',optimizedText:'The firm advised.'},{id:'m2',source_excerpt:'Reserve matter',optimizedText:'Existing reserve'}]};
const state={selection_validated:true,selection_review_validated:true,development_validated:true,strategy:{matters:[{matter_id:'m1',disposition:'core'},{matter_id:'m2',disposition:'reserve'}]},development:{version:'editorial-development-v1',b10:'Tax team with negotiation experience.',c2:'We request consideration based on demonstrated negotiation work.',matters:[{matter_id:'m1',text:'Sofia Vega led negotiations, reducing exposure by 80%.'}],candidates:[{name:'Sofia Vega',recommendation:'present',suggested_ranking:'Partner candidacy',submission_bio:'Sofia Vega led negotiations for Private Client, reducing exposure by 80%.'}]}};
test('development persists B9/C2 and outcomes without replacing source evidence or reserves',()=>{
 const result=projectDevelopment(data,state);
 assert.equal(result.matters[0].source_excerpt,data.matters[0].source_excerpt);
 assert.equal(result.matters[1],data.matters[1]);assert.equal(result.lawyers,data.lawyers);
 assert.equal(result.editorial_previous_drafts[0].matters[0].text,'The firm advised.');
 assert.match(result.matters[0].optimizedText,/80%/);assert.equal(result.release_verdict.passed,false);
 const submission={targetDirectory:'Chambers',practiceArea:'Tax',chambersData:data};
 assert.equal(stableHash(sourceSnapshot(submission)),stableHash(sourceSnapshot({...submission,chambersData:result})));
 const bio=curateLawyers(result.lawyers,result.matters,'Firm','Tax','Mexico',result)[0].bio;
 assert.match(bio,/80%/);assert.ok(!bio.includes('Private Client'));
 assert.equal(generateDynamicC2('Firm','Tax','Mexico',[],[],result.lawyers,result,submission),state.development.c2);
});
test('a changed human draft is retained for final review instead of overwritten',()=>{
 const modified={...data,matters:[{...data.matters[0],draft_provenance:{text_hash:stableHash('Old generated version')}},data.matters[1]]};
 assert.equal(projectDevelopment(modified,state).matters[0].optimizedText,'The firm advised.');
});
test('missing development or missing selected matter cannot be projected',()=>{
 assert.throws(()=>projectDevelopment(data,{...state,development_validated:false}),/DEVELOPMENT_REJECTED/);
 assert.throws(()=>projectDevelopment(data,{...state,development:{...state.development,matters:[]}}),/DEVELOPMENT_REJECTED/);
});

test('confirmed non-partner matter leaders remain in the team without being presented as partners',()=>{
 const {projectMatterLeadership}=require('../../src/lib/docx/lawyer-curator.ts');
 const roster=[{name:'Sofía Vega',isPartner:false},{name:'Elena Ruiz',isPartner:true}];
 assert.deepEqual(projectMatterLeadership('Sofía Vega.','N/A',roster),{lead:'',team:'Sofía Vega — lead lawyer'});
 assert.deepEqual(projectMatterLeadership('Elena Ruiz, Sofía Vega','Mateo Soto',roster),{lead:'Elena Ruiz',team:'Mateo Soto; Sofía Vega — lead lawyer'});
 assert.deepEqual(projectMatterLeadership('Unknown Lawyer','',roster),{lead:'Unknown Lawyer',team:''});
});

test('generated D8 status preserves source and does not invalidate source identity',()=>{
 const source=structuredClone(data);source.matters[0].completionDate='Conflicting final outcome from one source paragraph.';
 const proposal=structuredClone(state);proposal.development.matters[0].completion_status='Four interim orders were revoked.';
 const projected=projectDevelopment(source,proposal);
 assert.equal(projected.matters[0].completionDate,source.matters[0].completionDate);
 assert.equal(projected.matters[0].editorial_completion_status,'Four interim orders were revoked.');
 const sub={targetDirectory:'Chambers',practiceArea:'Tax',chambersData:source};
 assert.equal(stableHash(sourceSnapshot(sub)),stableHash(sourceSnapshot({...sub,chambersData:projected})));
 const {draftSourceHash}=require('../../src/lib/editorial/contracts.ts');
 assert.equal(projected.matters[0].draft_provenance.source_hash,draftSourceHash(projected.matters[0]));
});
