require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {test}=require('node:test');const assert=require('node:assert/strict');
const Wizard=require('../../src/components/PostIngestionWizardModal.tsx').default;
const initial=()=>({firmName:'Fictional Firm',practiceArea:'Tax',location:'Mexico',b10Text:'Source department description.',
 filingDetails:{departmentName:'Tax',numPartners:2,numLawyers:3,contacts:[{name:'Ana',email:'ana@example.test'}],departmentHeads:[{name:'Ana'}]},filingFieldStatus:{},
 sourceReports:[{source:'new.docx',detected_format:'docx',matter_count:22,source_reconciliation:{status:'reviewed'}}],
 matters:Array.from({length:22},(_,i)=>({id:`m${i}`,client:`Client ${i}`,rawNotes:'Literal source facts',isConfidential:true,confidentialityConfirmed:true,publish_status:'confidential',extraction_issues:[]}))});
const render=data=>renderToStaticMarkup(React.createElement(Wizard,{isOpen:true,onClose(){},onComplete(){},initialData:data}));
test('22 complete verified matters require one overview rather than fourteen confirmations',()=>{
 const html=render(initial());assert.match(html,/Paso 1 de 1/);assert.match(html,/Revisar todos los datos/);assert.match(html,/22 asuntos recuperados/);
});
test('only the one uncertain matter adds a step; the complete register stays available',()=>{
 const data=initial();data.matters[14].extraction_issues=[{field:'client',kind:'conflicting',alternatives:['Client 14','Other name']}];
 const html=render(data);assert.match(html,/Paso 1 de 2/);assert.match(html,/1 tienen dudas/);assert.equal(data.matters.length,22);
});
test('a genuinely missing filing count still has its review step',()=>{
 const data=initial();delete data.filingDetails.numLawyers;
 assert.match(render(data),/Paso 1 de 2/);
});
test('legacy reviewed flag cannot hide a missing required count after reopening',()=>{
 const data=initial();data.filingReviewed=true;delete data.filingDetails.numLawyers;
 assert.match(render(data),/Paso 1 de 2/);
});
test('pending preparation banner offers resolution instead of generation',()=>{
 const {PreparationBanner}=require('../../src/components/PreparationBanner.tsx');
 const html=renderToStaticMarkup(React.createElement(PreparationBanner,{approved:false,busy:false,needsReview:true,onPrepare(){},onReview(){},onAudit(){}}));
 assert.match(html,/Ver pendientes/);assert.doesNotMatch(html,/>Preparar documentos</);
});
test('first preparation stage is indeterminate with a real stage count, not a frozen zero percent',()=>{
 const {PreparationProgress}=require('../../src/components/PreparationProgress.tsx');
 const html=renderToStaticMarkup(React.createElement(PreparationProgress,{progress:{current:0,total:4}}));
 assert.match(html,/Etapa 1 de 4/);assert.doesNotMatch(html,/>0%<|value="0"/);assert.match(html,/Puedes salir y volver/);
});
