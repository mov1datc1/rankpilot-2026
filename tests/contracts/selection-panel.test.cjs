require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs');const ts=require('typescript');const {test}=require('node:test');const assert=require('node:assert/strict');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {ReviewPanel}=require('../../src/components/EditorialReview.tsx');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const errors=['Strategy does not reconcile exactly with the source register.','No se pudo vincular una cita de la selección con la fuente de Synthetic Client. Reintenta la revisión editorial.'];
function buttons(node){if(!node||typeof node!=='object')return[];return [...(node.type==='button'?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(buttons)];}
test('selection panel renders one explicit retry button and dispatches its action',()=>{
 const calls=[];const props={data:{},errors,warnings:[],approved:false,onResolve:(...args)=>calls.push(args)};
 const tree=ReviewPanel(props);const found=buttons(tree);assert.equal(found.length,1);
 found[0].props.onClick();assert.equal(calls[0][0],'retry-selection');
 const html=renderToStaticMarkup(tree);assert.ok(html.includes('Reintentar selección'));assert.ok(html.includes('No necesitas corregir las fuentes'));
 assert.ok(!html.includes('Después de guardar las correcciones'));assert.ok(html.includes('1 pendiente antes'));
 assert.equal(buttons(ReviewPanel({...props,busy:true}))[0].props.disabled,true);
});

test('saved corrections display a new-review action and retain old findings as history',()=>{
 const data={final_review_stale:true,final_artifact_review:{judge:{defects:[{severity:'critical',message:'Confirma el cargo de Sofia Vega.',owner:'user'}]}}};
 const props={data,errors:['Draft edited; validation required.'],warnings:[],approved:false,onResolve:()=>{}};
 const html=renderToStaticMarkup(ReviewPanel(props));
 assert.match(html,/Cambios guardados/);assert.match(html,/Ver hallazgos de la versión anterior/);
 assert.doesNotMatch(html,/Corregir este pendiente/);assert.match(html,/Confirma el cargo de Sofia Vega/);
 const legacy={...data,final_review_stale:undefined,release_verdict:{errors:['Draft edited; validation required.']}};
 assert.match(renderToStaticMarkup(ReviewPanel({...props,data:legacy})),/Guardado confirmado/);
});
