require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {PreparationBanner}=require('../../src/components/PreparationBanner.tsx');
const {ReviewPanel}=require('../../src/components/EditorialReview.tsx');
const {editorialNextAction}=require('../../src/lib/editorial/next-action.ts');
const {REVIEW_CONTRACT}=require('../../src/lib/audit/review-versions.ts');
const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
const noop=()=>{};
test('content approval alone never advertises downloadable files',()=>{
 const html=render(PreparationBanner,{approved:true,busy:false,needsReview:true,onPrepare:noop,onReview:noop,onAudit:noop});
 assert.doesNotMatch(html,/Documentos disponibles/);assert.match(html,/Ver siguiente paso/);
});
test('completed work without files exposes the actual read-only refresh action',()=>{
 const job={status:'completed'};job.nextAction=editorialNextAction(job,{documentsAvailable:false});
 const html=render(ReviewPanel,{data:{},errors:[],warnings:[],approved:true,job,onRefresh:noop,onResolve:noop});
 assert.doesNotMatch(html,/Documentos disponibles/);assert.match(html,/Actualizar estado/);assert.match(html,/Todavía no están disponibles ambos archivos/);assert.match(html,/sin iniciar otra generación/);
});
test('connection loss remains visible even when a previous pair is available',()=>{
 const data={draft_revision:1,matters:[],completed_review_policy_version:REVIEW_CONTRACT.policy,completed_renderer_version:REVIEW_CONTRACT.renderer,completed_artifact_review_version:REVIEW_CONTRACT.artifact,
 available_artifact:{base64:'ZmlsZQ==',audit_base64:'YXVkaXQ=',input_hash:'saved',review_revision:1,observation_status:'with_observations'}};
 const html=render(ReviewPanel,{data,errors:[],warnings:['Pendiente de revisar'],approved:false,onRefresh:noop,onResolve:noop,connectionError:true});
 assert.match(html,/Documentos disponibles/);assert.match(html,/último estado confirmado/);assert.match(html,/Actualizar estado/);assert.doesNotMatch(html,/soporte|Revisión detenida/);
 const progress=render(PreparationBanner,{approved:false,available:false,busy:true,needsReview:false,connectionError:true,progress:{current:4,total:9,stage:'Revisando campos'},onPrepare:noop,onReview:noop,onAudit:noop});
 assert.match(progress,/último avance confirmado/);assert.match(progress,/Revisando campos/);
});
