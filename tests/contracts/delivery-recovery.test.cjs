require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
const {reviewIssues,describeReviewIssue}=require('../../src/lib/audit/review-actions.ts');
const person={name:'Sofia Vega',isPartner:true,isRanked:false,currentRank:'Unranked',suggestedRank:'Associate to Watch'};
const project=(people,matters=[],data={})=>curateLawyers(people,matters,'Synthetic Legal','Tax','Latin America — Mexico',data);
test('unavailable individual evidence cannot become Unranked or Ranked N in B9',()=>{
  const input=structuredClone(person);const [result]=project([input]);
  assert.equal(result.currentRank,'');assert.equal(result.isRanked,null);assert.equal(result.suggestedRank,'');assert.deepEqual(input,person);
});
test('confidential and public matter mentions cannot manufacture a B9 identity or partner',()=>{
  const mentions=[{leadPartner:'Private Lawyer',teamMembers:'Other Lawyer',isConfidential:true},{leadPartner:'Public Mention',isConfidential:false}];
  assert.deepEqual(project([],mentions),[]);assert.equal(project([person],mentions).length,1);
});
test('only exact scoped individual observations print the observed rank',()=>{
  const observation={lawyer_name:'Sofia Vega',firm_name:'Synthetic Legal',practice_area:'Tax',jurisdiction:'Mexico',requested_edition:'current',subject_type:'individual',status:'verified_mismatch',observed_band:'Band 3',evidence:{source_url:'https://chambers.com/legal-rankings/synthetic'}};
  const read=item=>project([person],[],{ranking_verification:{individuals:[item]}})[0];
  assert.equal(read(observation).currentRank,'Band 3');assert.equal(read(observation).isRanked,true);
  for(const change of [{practice_area:'Employment'},{lawyer_name:'Another Person'},{firm_name:'Other Firm'},{requested_edition:'2020'},{status:'not_found'},{subject_type:'firm'}]) assert.equal(read({...observation,...change}).isRanked,null);
});
test('a role finding mentioning the period opens people, not the period control',()=>{
  assert.equal(describeReviewIssue('Sofia Vega: contradicción de seniority. Confirmar su cargo para este período.').destination,'lawyers');
  assert.equal(describeReviewIssue('research_period es null; confirmar elegibilidad temporal.').destination,'period');
});
test('structured findings replace the legacy concatenated error without losing warnings',()=>{
  const defects=[{severity:'critical',message:'Current ranking: Unranked no verificado'},{severity:'critical',message:'research_period es null'},{severity:'warning',message:'Contacto opcional'}];
  const result=reviewIssues({final_artifact_review:{judge:{defects}}},['El documento no superó la validación final: todo concatenado','Genera y revisa el archivo final antes de descargar.']);
  assert.equal(result.length,2);assert.equal(result[0].owner,'RankPilot');assert.equal(result[1].destination,'period');
});

const {focusedReviewScope}=require('../../src/lib/audit/review-actions.ts');
test('focused correction includes the named lawyer and only supplied related matters',()=>{
 const people=[{name:'Sofía Vega'},{name:'Ana Sol'}];
 const matters=[{id:'lead',leadPartner:'Sofia Vega'},{id:'team',teamMembers:'Sofía Vega; Ana Sol'},{id:'named',client:'Synthetic Industries'},{id:'other',leadPartner:'Ana Sol'},{id:'partial',leadPartner:'Sofia'}];
 const scope=focusedReviewScope('Confirmar cargo de Sofía Vega y socio responsable en Synthetic Industries.',people,matters);
 assert.deepEqual(scope.lawyerNames,['Sofía Vega']);assert.deepEqual(scope.matterIds,['lead','team','named']);
});
test('unknown identity does not guess another lawyer or mutate the register',()=>{
 const matters=[{id:'one',leadPartner:'Sofia Vega',isConfidential:true}],before=structuredClone(matters);
 const scope=focusedReviewScope('Confirmar el cargo de otra persona.',[{name:'Sofia Vega'}],matters);
 assert.deepEqual(scope.lawyerNames,[]);assert.deepEqual(scope.matterIds,[]);assert.deepEqual(matters,before);
});

test('selection failures become one system-owned retry action, not source edits',()=>{
 const errors=['Strategy does not reconcile exactly with the source register.','No se pudo vincular una cita de la selección con la fuente de Client 32. Reintenta la revisión editorial.','Genera y revisa el archivo final antes de descargar.'];
 const issues=reviewIssues({},errors);
 assert.equal(issues.length,1);assert.equal(issues[0].owner,'RankPilot');assert.equal(issues[0].destination,'retry-selection');
 assert.ok(issues[0].message.includes('Client 32'));assert.ok(issues[0].action.includes('No necesitas corregir las fuentes'));
 assert.equal(describeReviewIssue('RankPilot no pudo conciliar la selección con todos los asuntos registrados.').destination,'retry-selection');
});

test('an outdated document approval is a RankPilot task, not a user answer',()=>{
 const issues=reviewIssues({},['Los documentos guardados corresponden a una revisión anterior. Prepara Submission y Audit para comprobar la versión actual.']);
 assert.equal(issues[0].owner,'RankPilot');
 assert.equal(issues[0].destination,'retry-review');
});
