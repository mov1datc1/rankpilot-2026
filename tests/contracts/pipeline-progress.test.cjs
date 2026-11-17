require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {PipelineProgress}=require('../../src/components/PipelineProgress.tsx');
const render=progress=>renderToStaticMarkup(React.createElement(PipelineProgress,{progress}));

test('four real phases, the active one named, without an invented percentage',()=>{
 const html=render({current:1,total:4,stage:'Desarrollando Submission'});
 assert.match(html,/Etapa 2 de 4 · Redacción del Submission/);
 assert.match(html,/1 de 4 etapas completas/);
 for(const label of ['Selección','Redacción','Audit','Documentos'])assert.match(html,new RegExp(label));
 assert.doesNotMatch(html,/\d+\s*%</);
 assert.match(html,/Puedes salir y volver/);
 assert.match(html,/prefers-reduced-motion/);
});
test('waiting and finished states are explicit; corrections after review stay in the last phase',()=>{
 assert.match(render({current:0,total:4,waiting:true,stage:'En cola'}),/En espera de turno/);
 assert.match(render({current:4,total:4}),/Documentos listos/);
 assert.match(render({current:4,total:4}),/4 de 4 etapas completas/);
 const repairing=render({current:4,total:6,stage:'Corrigiendo'});
 assert.match(repairing,/Etapa 4 de 4 · Revisión final y Word/);
});
test('real sub-progress comes from saved construction, review and repair state',()=>{
 const {jobActivity}=require('../../src/lib/editorial/activity.ts');
 const call={trace:{calls:[{role:'development'}]}};
 const building=jobActivity({cursor:1,stage:'development',ledger:[call,call]},{review_checkpoint:{state:{repair_continuation:{version:'editorial-construction-v1',
   completed_units:[{kind:'plan'},{kind:'matters'},{kind:'matters'}],pending_groups:[{kind:'matters'},{kind:'bio'},{kind:'institutional'}]}}}});
 assert.equal(building.label,'Redactando: Asuntos');assert.equal(building.providerCalls,2);
 assert.deepEqual(building.steps.map(s=>[s.label,s.done,s.total]),[['Plan común',1,1],['Asuntos',2,3],['Biografías B9',0,1],['B10 y C2',0,1]]);
 const repairing=jobActivity({cursor:1,stage:'development',ledger:[]},{review_checkpoint:{state:{field_review_repair_calls:2,
   repair_continuation:{version:'source-field-review-v1',phase:'repair',pending_groups:[['b10'],['matters/1/text']]},
   development_build_report:{first_pass_quality:{percent_met:61.78,units:{a:{first_review:'original'},b:{first_review:'corrected_before_review'},c:{}}}}}}});
 assert.equal(repairing.firstPassPercent,61.78);
 assert.deepEqual(repairing.steps.map(s=>[s.done,s.total]),[[2,3],[2,4]]);
 const html=renderToStaticMarkup(React.createElement(PipelineProgress,{progress:{current:1,total:4,activity:repairing}}));
 assert.match(html,/Corrigiendo los hallazgos localizados/);assert.match(html,/Acierto en primera redacción: 61.78%/);assert.match(html,/2 de 4/);
 assert.equal(jobActivity(null,{}),null);
});

test('the robot says what the real job is doing',()=>{
 const {botSays}=require('../../src/components/PipelineProgress.tsx');
 const build={current:1,total:4,activity:{label:'Redactando: Asuntos',steps:[{label:'Plan común',done:1,total:1},{label:'Asuntos',done:2,total:5},{label:'Biografías B9',done:0,total:7}],firstPassPercent:null,providerCalls:3}};
 assert.equal(botSays(build,false,1),'Estoy reescribiendo cada asunto: me faltan 3 grupos de asuntos.');
 const review={current:1,total:4,activity:{label:'Revisando cada campo contra sus fuentes',steps:[{label:'Campos contrastados con sus fuentes',done:6,total:19}],firstPassPercent:null,providerCalls:9}};
 assert.equal(botSays(review,false,1),'Reviso cada campo contra sus fuentes: van 6 de 19.');
 const fixing={current:1,total:4,activity:{label:'Corrigiendo los hallazgos localizados',steps:[{label:'Campos contrastados con sus fuentes',done:19,total:19},{label:'Grupos corregidos',done:1,total:2}],firstPassPercent:61,providerCalls:12}};
 assert.equal(botSays(fixing,false,1),'Estoy corrigiendo unos campos: me queda 1 grupo.');
 assert.match(botSays({current:0,total:4},false,0),/leyendo todos los asuntos/);
 assert.match(botSays({current:4,total:4},true,3),/Listo/);
 assert.match(renderToStaticMarkup(React.createElement(PipelineProgress,{progress:review})),/van 6 de 19/);
});
test('per-stage metrics are summed from the saved ledger only',()=>{
 const {stageMetrics}=require('../../src/lib/editorial/activity.ts');
 const at='2026-11-17T10:00:00.000Z';
 const metrics=stageMetrics([
  {stage:'selection',started_at:at,duration_ms:120000,trace:{role:'selection',usage:{total_tokens:100000}}},
  {stage:'development',started_at:at,duration_ms:30000,trace:{usage:{total_tokens:50000},calls:[{role:'development'},{role:'field_review'}]}},
  {stage:'development',started_at:at,duration_ms:30000,trace:{role:'repair',usage:{total_tokens:20000}}},
  {stage:'matter:m1',started_at:at,duration_ms:6000,trace:{role:'repair',usage:{total_tokens:5000}}},
  {stage:'development',status:'queued'}]);
 assert.deepEqual(metrics.map(m=>[m.stage,m.minutes,m.tokens,m.steps,m.repairs]),[['selection',2,100000,1,0],['development',1,70000,2,1],['artifact',0.1,5000,1,1]]);
 const html=renderToStaticMarkup(React.createElement(PipelineProgress,{progress:{current:1,total:4,activity:{label:'Revisando',steps:[],firstPassPercent:null,providerCalls:3,stages:metrics}}}));
 assert.match(html,/Selección<\/strong> · 2,0 min · 100 k tokens/);
 assert.match(html,/Redacción<\/strong> · 1,0 min · 70 k tokens · 1 corr\./);
});
test('the robot says what it does after drafting, before the field review',()=>{
 const {botSays}=require('../../src/components/PipelineProgress.tsx');
 const says=botSays({current:1,total:4,activity:{label:'Preparando la revisión por campos',steps:[],firstPassPercent:null,providerCalls:0}},false,1);
 assert.match(says,/terminé de redactar/);
});
test('between selection and the first draft the robot does not claim the drafting is finished',()=>{
 const {jobActivity}=require('../../src/lib/editorial/activity.ts');
 const {botSays}=require('../../src/components/PipelineProgress.tsx');
 const before=jobActivity({cursor:1,stage:'development',ledger:[]},{review_checkpoint:{state:{}}});
 assert.equal(before.label,'Preparando el plan común de la redacción');
 assert.match(botSays({current:1,total:4,activity:before},false,1),/plan común/);
 const after=jobActivity({cursor:1,stage:'development',ledger:[]},{review_checkpoint:{state:{development_build_report:{}}}});
 assert.equal(after.label,'Preparando la revisión por campos');
});
