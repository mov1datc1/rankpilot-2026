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
