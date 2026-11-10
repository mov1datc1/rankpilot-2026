require('../../docs/reviews/review-loader.cjs');
const fs=require('node:fs'),ts=require('typescript'),{test}=require('node:test'),assert=require('node:assert/strict'),React=require('react');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {ResearchPeriodForm}=require('../../src/components/ResearchPeriodForm.tsx');
function find(node,type){if(!node||typeof node!=='object')return;return node.type===type?node:React.Children.toArray(node.props?.children).map(n=>find(n,type)).find(Boolean);}
test('period entry rejects missing or reversed dates and saves once without generation',async()=>{
 const original=React.useState;let error='',saves=0;React.useState=()=>['',value=>{error=value;}];
 try {
  for(const [from,to,expected] of [['','2026-11-09',0],['2026-11-09','2025-01-01',0],['2025-01-01','2026-11-09',1]]) {
   const tree=ResearchPeriodForm({from,to,busy:false,onFrom:()=>{},onTo:()=>{},onSave:async()=>{saves++;},onClose:()=>{}});
   await find(tree,'form').props.onSubmit({preventDefault(){}});assert.equal(saves,expected);
   if(!expected)assert.match(error,/Indica ambas fechas/);else assert.equal(error,'');
  }
 }finally{React.useState=original;}
});
