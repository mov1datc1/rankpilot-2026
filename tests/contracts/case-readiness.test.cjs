require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {caseReadiness}=require('../../src/lib/audit/case-readiness.ts');
const {integrityChecks}=require('../../src/lib/audit/integrity-checks.ts');

// v1.0.106: Builder option B (documents/pasted text) must say what the case lacks and what to do next.
test('dispersed sources without profiles say B9 will be empty and name the next step',()=>{
 const r=caseReadiness({lawyers:[],matters:[{id:'m',client:'Example Client',value:'$3,400,000.00',summary:'Closure.'}],filingDetails:{departmentName:'Environment'},b10Text:'The practice defends industrial operators.',
  sourceReports:[{source:'notes.docx',matter_count:0},{source:'matters.docx',matter_count:1}],
  scopeConfirmations:[{field:'practice_area',selected:'Environment',detected:'Energy & Natural Resources',source:'form.docx'}]});
 const text=r.items.map(i=>i.kind+':'+i.text).join('\n');
 assert.match(text,/missing:No encontramos perfiles de abogados.*B9 quedará vacía/);
 assert.match(text,/missing:Datos administrativos.*B2: número de socios/);
 assert.match(text,/doubt:Encontramos 1 asuntos/);
 assert.match(text,/doubt:«notes\.docx» no aportó asuntos/);
 assert.match(text,/doubt:«form\.docx» indica la práctica «Energy & Natural Resources»; elegiste continuar con «Environment»/);
 assert.match(text,/check:El valor de Example Client.*no indica la moneda/);
 assert.match(r.nextStep,/Completa lo que falta/);
});
test('a complete case gets a plain next step and no invented gaps',()=>{
 const lawyers=[{name:'A',isPartner:true}];
 const matters=Array.from({length:12},(_,i)=>({id:'m'+i,client:'Client '+i,value:'',summary:'Work.'}));
 const r=caseReadiness({lawyers,matters,b10Text:'Practice.',filingDetails:{departmentName:'X',numPartners:'1',numLawyers:'2',contacts:[{name:'A',email:'a@x'}],departmentHeads:[{name:'A'}]},sourceReports:[{source:'a.docx',matter_count:12}]});
 assert.deepEqual(r.items,[]);assert.match(r.nextStep,/tiene lo necesario para preparar/);
});
test('ambiguous figures and inconsistent conversions are asked once, conversions with cents are not',()=>{
 const checks=integrityChecks({},[
  {id:'a',client:'Ambiguous',value:'MXN 11.775,193.22 (Approx USD 65,353,319.98)',summary:''},
  {id:'b',client:'Inconsistent',value:'MXN 5,015,025.97 (Approx USD 27,762,495.45)',summary:''},
  {id:'c',client:'Consistent',value:'MXN 300,000,000.00 (Approx USD 16,609,674.20)',summary:''},
  {id:'d',client:'EXAMPLE DEVELOPER, S.A. DE C.V.',value:'',summary:'EXAMPLE DEVELOPER, S.A. DE C.V. Is a developer. EXAMPLE DEVELOPER. In 2024 it sold.'}]);
 assert.equal(checks.length,2,checks.join('\n'));
 assert.match(checks[0],/Ambiguous.*formato numérico ambiguo \(11\.775,193\.22\)/);
 assert.match(checks[1],/Inconsistent.*no equivalen entre sí/);
});
