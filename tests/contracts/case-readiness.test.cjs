require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {caseReadiness,readinessVerdict}=require('../../src/lib/audit/case-readiness.ts');
const {integrityChecks}=require('../../src/lib/audit/integrity-checks.ts');

// v1.0.106: Builder option B (documents/pasted text) must say what the case lacks and what to do next.
test('dispersed sources without profiles say B9 will be empty and name the next step',()=>{
 const r=caseReadiness({firmName:'Example Firm',practiceArea:'Environment',lawyers:[],matters:[{id:'m',client:'Example Client',value:'$3,400,000.00',summary:'Closure.'}],filingDetails:{departmentName:'Environment'},b10Text:'The practice defends industrial operators.',
  sourceReports:[{source:'notes.docx',matter_count:0},{source:'matters.docx',matter_count:1}],
  scopeConfirmations:[{field:'practice_area',selected:'Environment',detected:'Energy & Natural Resources',source:'form.docx'}]});
 const text=r.items.map(i=>i.kind+':'+i.text).join('\n');
 assert.match(text,/missing:No encontramos perfiles de abogados.*B9 quedará vacía/);
 assert.match(text,/missing:Datos administrativos.*B2: número de socios/);
 assert.match(text,/doubt:Encontramos 1 asuntos/);
 assert.match(text,/doubt:«notes\.docx» no aportó asuntos/);
 assert.match(text,/doubt:«form\.docx» indica la práctica «Energy & Natural Resources»; elegiste continuar con «Environment»/);
 assert.match(text,/check:El valor de Example Client.*no indica la moneda/);
 assert.equal(r.verdict.status,'limited');assert.match(r.verdict.limitations.join(' '),/sin B9 y el Audit sin estrategia individual/);
 assert.match(r.nextStep,/RankPilot generará con lo disponible/);
});
test('a complete case gets a plain next step and no invented gaps',()=>{
 const lawyers=[{name:'A',isPartner:true}];
 const matters=Array.from({length:12},(_,i)=>({id:'m'+i,client:'Client '+i,value:'',summary:'Work.'}));
 const r=caseReadiness({firmName:'Example Firm',practiceArea:'Tax',lawyers,matters,b10Text:'Practice.',filingDetails:{departmentName:'X',numPartners:'1',numLawyers:'2',contacts:[{name:'A',email:'a@x'}],departmentHeads:[{name:'A'}]},sourceReports:[{source:'a.docx',matter_count:12}]});
 assert.deepEqual(r.items,[]);assert.equal(r.verdict.status,'ready');assert.equal(r.nextStep,'Confirma los asuntos y pulsa preparar.');
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
test('v1.0.107: the verdict blocks exactly when Studio would not prepare, with the same reasons',()=>{
 const {editorialPreparationIssues}=require('../../src/lib/audit/preparation-input.ts');
 const input={firmName:'Firm',practiceArea:'Environment',lawyers:[{name:'A',isPartner:true}],b10Text:'',matters:[{id:'m',client:'C',summary:'Work.'}]};
 // v1.0.114: no department description is a limitation; no matters still blocks.
 const v=readinessVerdict(input);
 assert.equal(v.status,'limited');assert.match(v.limitations.join(' '),/B10 y el C2 se construirán de forma preliminar/);
 const empty=readinessVerdict({...input,matters:[]});
 assert.equal(empty.status,'blocked');
 assert.deepEqual(empty.limitations,editorialPreparationIssues({firm_name:'Firm',practice_area:'Environment',original_b10:''},[]));
 assert.match(caseReadiness({...input,matters:[]}).nextStep,/^Completa primero/);
 assert.equal(readinessVerdict({...input,b10Text:'Practice.'}).status,'limited');  // 1 matter: short portfolio, still generable
});
test('v1.0.114: the same matter read from two versions of a form is reported once, different mandates are not',()=>{
 const {duplicateMatters}=require('../../src/lib/audit/case-readiness.ts');
 const text='The firm defended the concession holder against the municipal revocation of its public lighting concession through a nullity action before the administrative court and obtained a definitive suspension that preserved the operation of the service during the proceedings.';
 const other='The firm advised the same client on the tax treatment of a cross-border financing, reviewed the withholding obligations, prepared the ruling request filed with the authority and negotiated the security package with the lenders involved.';
 const matters=[{id:'1',client:'Example Group',source_excerpt:text,source_document:'form v1.docx'},{id:'2',client:'EXAMPLE GROUP',source_excerpt:text+' Lead partner: A.',source_document:'form v2.docx'},{id:'3',client:'Example Group',source_excerpt:other,source_document:'form v2.docx'}];
 const groups=duplicateMatters(matters);
 assert.equal(groups.length,1);assert.equal(groups[0].count,2);assert.deepEqual(groups[0].sources,['form v1.docx','form v2.docx']);
 const r=caseReadiness({firmName:'F',practiceArea:'Energy',lawyers:[],matters,b10Text:''});
 assert.match(r.items.map(i=>i.text).join('\n'),/«Example Group» aparece 2 veces/);
});
test('v1.0.114: the currency question uses the amounts the narrative already states',()=>{
 const checks=integrityChecks({},[{id:'a',client:'Example Packaging',value:'$3,400,000.00',summary:'The authority imposed fines of MXN 3,474,240 on the plant.'}]);
 assert.equal(checks.length,1);assert.match(checks[0],/no indica la moneda, y su narrativa menciona MXN 3,474,240\. Confirma si el valor está en MXN/);
});
test('v1.0.116: a B9 answered with a link only is said before generating and never blocks',()=>{
 const {lawyersWithLinkOnly}=require('../../src/lib/audit/case-readiness.ts');
 const matters=Array.from({length:12},(_,i)=>({id:'m'+i,client:'Client '+i,value:'',summary:'Work.'}));
 const lawyers=[{name:'Sofia Vega',url:'Sofia Vega |https://example.com/lawyers/sofia-vega |Y |Y |',bio:''},
  {name:'Ana Ruiz',url:'https://example.com/lawyers/ana-ruiz',bio:'Ana Ruiz has advised on tax audits since 2004.'},
  {name:'Luis Soto',url:'',bio:''},{name:'Eva Mora',url:'https://example.com/eva',bio:'https://example.com/eva'}];
 assert.deepEqual(lawyersWithLinkOnly(lawyers),['Sofia Vega','Eva Mora']);
 const r=caseReadiness({firmName:'Example Firm',practiceArea:'Tax',lawyers,matters,b10Text:'Practice.',filingDetails:{departmentName:'X',numPartners:'1',numLawyers:'2',contacts:[{name:'A',email:'a@x'}],departmentHeads:[{name:'A'}]},sourceReports:[{source:'a.docx',matter_count:12}]});
 assert.equal(r.verdict.status,'limited');
 assert.match(r.verdict.limitations.join(' '),/2 de 4 abogado\(s\) traen en B9 solo un enlace.*Sofia Vega, Eva Mora.*RankPilot no lee el enlace/);
 assert.match(r.items.map(i=>i.kind+':'+i.text).join('\n'),/missing:2 de 4 abogado/);
 assert.match(r.nextStep,/RankPilot generará con lo disponible/);
 assert.deepEqual(lawyersWithLinkOnly([{name:'A',isPartner:true}]),[]);
});
