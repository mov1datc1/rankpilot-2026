require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs');const ts=require('typescript');const {test}=require('node:test');const assert=require('node:assert/strict');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {ReviewPanel}=require('../../src/components/EditorialReview.tsx');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
test('one status explains the next action once and a repaired-context continuation has one preparation button',()=>{
 const {editorialNextAction}=require('../../src/lib/editorial/next-action.ts');
 const job={id:'j',status:'failed',stage:'development',pauseReason:'stage_stopped',sourceMatches:true,canResumeResidual:true,canRecheckFieldContext:true,issue:{code:'DEVELOPMENT_REJECTED',owner:'rankpilot'}};
 job.nextAction=editorialNextAction(job,{canResume:true});
 const html=renderToStaticMarkup(React.createElement(ReviewPanel,{data:{},errors:[],warnings:[],approved:false,job,onResolve:()=>{}}));
 assert.equal(html.split(job.nextAction.description).length-1,1);
 assert.equal((html.match(/<button/g)||[]).length,1);
 assert.match(html,/Hallazgo de la revisión/);assert.match(html,/Continuar preparación/);
 assert.doesNotMatch(html,/compártela|Solicita recuperar|Revisión detenida; consulta/);
});
test('an exhausted automatic review reports a real pause without promising continuation or a paid restart',()=>{
 const {publicJob}=require('../../src/lib/editorial/jobs.ts');
 const job=publicJob({id:'j',status:'needs_review',stage:'artifact',tasks:['selection','artifact'],cursor:2,ledger:[{supervision:{action:'pause',reason:'repair_progress_limit'}}]});
 const html=renderToStaticMarkup(React.createElement(ReviewPanel,{data:{editorial_review:{letter:{}},final_artifact_review:{judge:{defects:[{code:'SOURCE_CONFLICT',severity:'critical',owner:'rankpilot',message:'Retira el descriptor sectorial discutido.'}]}}},errors:[],warnings:[],approved:false,job,onResolve:()=>{}}));
 assert.equal(job.pauseReason,'repair_progress_limit');assert.ok(html.includes('Recupera la preparación de los documentos'));
 assert.ok(html.includes('compártela con soporte'));assert.ok(html.includes('Conservamos tus fuentes'));
 assert.ok(!html.includes('continuará automáticamente'));assert.equal((html.match(/<button/g) || []).length,1);assert.match(html,/Copiar referencia/);
 assert.ok(html.includes('No se pudieron crear los dos archivos'));assert.ok(html.includes('no vuelvas a cargar el original'));
 assert.ok(!html.includes('Pulsa «Revisar y preparar documentos»'));assert.ok(!html.includes('para reanudar el proceso'));
});
const errors=['Strategy does not reconcile exactly with the source register.','No se pudo vincular una cita de la selección con la fuente de Synthetic Client. Reintenta la revisión editorial.'];
function buttons(node){if(!node||typeof node!=='object')return[];return [...(node.type==='button'?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(buttons)];}
test('selection panel renders one explicit retry button and dispatches its action',()=>{
 const calls=[];const props={data:{},errors,warnings:[],approved:false,onResolve:(...args)=>calls.push(args)};
 const tree=ReviewPanel(props);const found=buttons(tree);assert.equal(found.length,1);
 found[0].props.onClick();assert.equal(calls[0][0],'retry-selection');
 const html=renderToStaticMarkup(tree);assert.ok(html.includes('Reintentar selección'));assert.ok(html.includes('No necesitas corregir las fuentes'));
 assert.ok(!html.includes('Después de guardar las correcciones'));assert.ok(html.includes('1 tarea de RankPilot'));assert.ok(html.includes('Listo para preparar Submission y Audit'));
 assert.equal(buttons(ReviewPanel({...props,busy:true}))[0].props.disabled,true);
});

test('saved corrections display a new-review action and retain old findings as history',()=>{
 const data={lawyers:[{name:'Sofia Vega',role:'Partner',isPartner:true,roleResolution:{role:'Partner',confirmed:true,reason:'Confirmed for the period'}}],final_review_stale:true,final_artifact_review:{judge:{defects:[{severity:'critical',message:'Confirma el cargo de Sofia Vega.',owner:'user'}]}}};
 const props={data,errors:['Draft edited; validation required.'],warnings:[],approved:false,onResolve:()=>{}};
 const html=renderToStaticMarkup(ReviewPanel(props));
 assert.match(html,/Cambios guardados/);assert.match(html,/Ver hallazgos de la versión anterior/);
 assert.doesNotMatch(html,/Corregir este pendiente/);assert.match(html,/Confirma el cargo de Sofia Vega/);
 const legacy={...data,final_review_stale:undefined,release_verdict:{errors:['Draft edited; validation required.']}};
 assert.match(renderToStaticMarkup(ReviewPanel({...props,data:legacy})),/Guardado confirmado/);
});

const {recordReviewResponse,reviewIssues,focusedReviewScope}=require('../../src/lib/audit/review-actions.ts');
test('saving one answer updates its count without hiding unrelated unresolved questions',()=>{
 const defects=[{severity:'critical',owner:'user',message:'Confirma el cargo de Sofia Vega.'},{severity:'critical',owner:'user',message:'Confirma el cargo de Lucia Torres.'},{severity:'critical',owner:'rankpilot',message:'An invented outcome must be corrected.'}];
 const before={lawyers:[{name:'Sofia Vega',role:'Associate',isPartner:false},{name:'Lucia Torres',role:'Associate',isPartner:false}],matters:[],final_artifact_review:{judge:{defects}}};
 const after=structuredClone(before);after.final_review_stale=true;after.lawyers[0]={...after.lawyers[0],role:'Partner',isPartner:true,roleResolution:{role:'Partner',reason:'Confirmed',confirmed:true}};
 after.review_responses=recordReviewResponse(before,after,defects[0].message,'user');
 assert.equal(after.review_responses.length,1);
 const html=renderToStaticMarkup(ReviewPanel({data:after,errors:[],warnings:[],approved:false,onResolve:()=>{}}));
 assert.match(html,/1 pendiente por responder/);
 const issues=reviewIssues(after,[]);assert.ok(issues.some(i=>i.message===defects[1].message));assert.ok(!issues.some(i=>i.message===defects[0].message));
 after.lawyers[0].role='Associate';assert.ok(reviewIssues(after,[]).some(i=>i.message===defects[0].message));
 assert.equal(recordReviewResponse(before,before,defects[0].message,'user').length,0);
 assert.equal(recordReviewResponse(before,after,defects[2].message,'user').length,0);
});
test('every user or system finding has a direct action; known matter IDs focus even unnamed findings',()=>{
 const calls=[];const data={final_artifact_review:{judge:{defects:[{owner:'user',severity:'critical',message:'Confirma el dato documental.'},{owner:'rankpilot',severity:'critical',message:'Texto inventado.'}]}}};
 const tree=ReviewPanel({data,errors:[],warnings:[],approved:false,onResolve:(...args)=>calls.push(args)});
 const actions=buttons(tree);assert.equal(actions.length,2);actions.forEach(b=>b.props.onClick());assert.deepEqual(calls.map(c=>c[0]),['wizard','retry-review']);
 assert.deepEqual(focusedReviewScope('Confirma el dato',[],[{id:'m1',client:'One'},{id:'m2',client:'Two'}],{matter_id:'m2'}).matterIds,['m2']);
});


test('a stopped internal job remains RankPilot responsibility without a user repair button',()=>{
 const {publicJobIssue}=require('../../src/lib/editorial/jobs.ts');
 const issue=publicJobIssue({owner:'rankpilot',code:'DEVELOPMENT_REJECTED',message:'Cita decisiva sin vínculo literal: secret-id'});
 const html=renderToStaticMarkup(React.createElement(ReviewPanel,{data:{},errors:['La revisión editorial se ejecutará después de guardar la redacción.'],warnings:[],approved:false,job:{status:'failed',issue},onResolve:()=>{}}));
 assert.ok(html.includes('Preparación de documentos'));
 assert.ok(!html.includes('Reanudar preparación'));assert.ok(!html.includes('secret-id'));assert.ok(!html.includes('<button'));
 assert.ok(!html.includes('No quedan respuestas pendientes'));
});

test('a running repair asks the user to wait without suggesting another paid start',()=>{
 const data={final_artifact_review:{judge:{defects:[{severity:'critical',owner:'rankpilot',message:'Retira el descriptor discutido.'}]}}};
 const html=renderToStaticMarkup(ReviewPanel({data,errors:[],warnings:[],approved:false,job:{status:'running'},onResolve:()=>{}}));
 assert.ok(html.includes('Espera a que termine'));assert.ok(html.includes('Puedes cerrar esta pestaña'));
 assert.ok(!html.includes('para reanudar el proceso'));assert.ok(!html.includes('<button'));
});


test('a failed development offers only existing artifacts and does not invent budget exhaustion',()=>{
 const props={data:{},errors:[],warnings:[],approved:false,onResolve:()=>{},job:{id:'job',stage:'development',status:'failed',pauseReason:'DEVELOPMENT_REJECTED',issue:{owner:'rankpilot',code:'DEVELOPMENT_REJECTED'}}};
 const without=renderToStaticMarkup(React.createElement(ReviewPanel,props));
 assert.match(without,/todavía no preparó el Audit/);assert.doesNotMatch(without,/Audit disponible|descarga el Audit|dentro de los límites/);
 assert.match(without,/Copiar referencia/);assert.doesNotMatch(without,/continuará automáticamente/);
 const withAudit=renderToStaticMarkup(React.createElement(ReviewPanel,{...props,data:{editorial_review:{letter:{executive_assessment:'Saved analysis'}}}}));
 assert.match(withAudit,/Audit disponible/);assert.doesNotMatch(withAudit,/todavía no preparó el Audit/);
});

test('available documents show only availability and located observations, without paused or draft status',()=>{
 const {REVIEW_CONTRACT:c}=require('../../src/lib/audit/review-versions.ts');
 const data={draft_revision:1,completed_review_policy_version:c.policy,completed_renderer_version:c.renderer,completed_artifact_review_version:c.artifact,
  available_artifact:{base64:'bytes',audit_base64:'audit',input_hash:'bound',review_revision:1,observation_status:'with_observations'},
  final_artifact_review:{judge:{passed:false,defects:[{severity:'critical',owner:'rankpilot',scope:'submission',field_path:'b10',message:'Conserva el resultado de la fuente.',source_quote:'Achieved result.',artifact_quote:'Advised the client.'}]}},release_verdict:{passed:false,status:'needs_review'}};
 const html=renderToStaticMarkup(React.createElement(ReviewPanel,{data,errors:[],warnings:[],approved:false,job:{status:'completed',nextAction:{kind:'download'}},onResolve:()=>{}}));
 assert.match(html,/Documentos disponibles · con observaciones/);assert.match(html,/B10 · Departamento/);assert.match(html,/Achieved result/);
 assert.doesNotMatch(html,/Borrador|pausad|detenid|Solicita recuperar|Entrega pendiente/i);
});
