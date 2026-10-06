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
