require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {listedNames,rosterMatch,clientLooksLikeText,inputDoubts}=require('../../src/lib/audit/input-doubts.ts');
const {caseReadiness}=require('../../src/lib/audit/case-readiness.ts');

// v1.0.119: the same reading as ai-engine/core/fact_sheet.py (tests/test_v117_fact_sheet.py uses these examples).
test('role cells are read as the engine reads them',()=>{
 assert.deepEqual(listedNames('Lead partners: Sofia Vega (Head of Tax), Ana Soto and Pedro Lugo'),['Sofia Vega','Ana Soto','Pedro Lugo']);
 assert.deepEqual(listedNames('Lead partner: N/A'),[]);
 assert.deepEqual(listedNames('Sofía Vega y Ana Soto; Pedro Lugo'),['Sofía Vega','Ana Soto','Pedro Lugo']);
 const roster=['sofia vega ruiz','ana soto mora','ana soto diaz'];
 assert.equal(rosterMatch('Sofía Vega',roster),'sofia vega ruiz');
 assert.equal(rosterMatch('Ana Soto',roster),null);   // two profiles contain it: not decided
 assert.equal(rosterMatch('Pedro Lugo',roster),null);
});
test('a sentence in the client cell is recognised, a company name is not',()=>{
 for(const text of ['I: Comparece y solicita Industrias Ejemplo, S.A. de C.V.','2. The claimant respectfully requests the annulment','Example Holdings requests that the court set aside the assessment issued by the authority in the proceeding described below'])
  assert.equal(clientLooksLikeText(text),true,text);
 for(const text of ['Example Holdings, S.A. de C.V.','I. Example & Sons','EXAMPLE MÉXICO OPERACIONES S.A. DE C.V. – CEMENT COMPANY','Grupo X','']) assert.equal(clientLooksLikeText(text),false,text);
});
test('co-led mandates, leads without a profile, idle profiles and shared headship are said before generating',()=>{
 const lawyers=[{name:'Sofia Vega Ruiz'},{name:'Ana Soto Mora'},{name:'Luis Paz Gil'}];
 const matters=[{client:'Alpha Corp',leadPartner:'Sofia Vega and Ana Soto',teamMembers:'Pedro Lugo'},
  {client:'Beta Ltd',leadPartner:'Sofia Vega Ruiz'},{client:'Gamma Inc',leadPartner:'Marta Cruz'},{client:'Delta SA',leadPartner:''}];
 const text=inputDoubts({lawyers,matters,departmentHeads:[{name:'Sofia Vega Ruiz'},{name:'Ana Soto Mora'}]}).map(d=>d.kind+':'+d.text).join('\n');
 assert.match(text,/check:1 asunto\(s\) nombran a más de un socio responsable \(Alpha Corp: Sofia Vega y Ana Soto\).*codirigidos/);
 assert.match(text,/doubt:1 asunto\(s\) no indican socio responsable \(Delta SA\)/);
 assert.match(text,/doubt:Los asuntos nombran como socio responsable a 1 persona\(s\) sin perfil en B9 \(Marta Cruz\)/);
 assert.match(text,/doubt:1 abogado\(s\) con perfil no figuran.*\(Luis Paz Gil\)/);
 assert.match(text,/check:El formulario nombra 2 jefes de departamento \(Sofia Vega Ruiz, Ana Soto Mora\).*uno de los jefes/);
});
test('a register without role cells or with a single lead invents no doubt',()=>{
 assert.deepEqual(inputDoubts({lawyers:[{name:'Sofia Vega Ruiz'}],matters:[{client:'Alpha Corp'},{client:'Beta Ltd'}],departmentHeads:[{name:'Sofia Vega Ruiz'}]}),[]);
 assert.deepEqual(inputDoubts({lawyers:[{name:'Sofia Vega Ruiz'}],matters:[{client:'Alpha Corp',leadPartner:'Sofia Vega',teamMembers:'N/A'}]}),[]);
 assert.deepEqual(inputDoubts({lawyers:[],matters:[{client:'Alpha Corp',leadPartner:'Marta Cruz'}]}),[]);  // no profiles: the missing-profiles item already says it
});
test('the doubts appear in the same checklist and never change the verdict',()=>{
 const base={firmName:'Example Firm',practiceArea:'Tax',b10Text:'Practice.',filingDetails:{departmentName:'X',numPartners:'1',numLawyers:'2',contacts:[{name:'A',email:'a@x'}],departmentHeads:[{name:'Sofia Vega Ruiz'}]},sourceReports:[{source:'a.docx',matter_count:12}]};
 const matters=Array.from({length:12},(_,i)=>({id:'m'+i,client:'Client '+i,value:'',summary:'Work.',leadPartner:'Sofia Vega Ruiz'}));
 const clean=caseReadiness({...base,lawyers:[{name:'Sofia Vega Ruiz',isPartner:true,bio:'Career.'}],matters});
 assert.deepEqual(clean.items,[]);assert.equal(clean.verdict.status,'ready');
 const doubted=caseReadiness({...base,lawyers:[{name:'Sofia Vega Ruiz',isPartner:true,bio:'Career.'}],matters:[...matters.slice(1),{...matters[0],client:'I: Comparece y solicita Example Industries'}]});
 assert.equal(doubted.verdict.status,'ready');assert.match(doubted.items.map(i=>i.text).join(' '),/fragmento de texto/);
 assert.match(doubted.nextStep,/Revisa las dudas señaladas/);
});
test('a head named with fewer words than a known lawyer is asked, never assumed to be that lawyer',()=>{
 // Real run 75b8ade5 (1.0.118): B10 and C2 wrote that the fully named lead partner heads the department; the judge rejected both.
 const matters=[{client:'Alpha Corp',leadPartner:'Sofia Vega Ruiz'},{client:'Beta Ltd',leadPartner:'Ana Soto Mora'}];
 const asked=inputDoubts({lawyers:[],matters,departmentHeads:[{name:'Sofia Vega'}]});
 assert.equal(asked.length,1);assert.match(asked[0].text,/jefe de departamento a «Sofia Vega».*Sofia Vega Ruiz.*nombre completo/);
 assert.deepEqual(inputDoubts({lawyers:[],matters,departmentHeads:[{name:'Sofía Vega Ruiz'}]}),[]);
 assert.deepEqual(inputDoubts({lawyers:[],matters,departmentHeads:[{name:'Laura Paz Gil'}]}),[]);   // a head who leads no listed mandate is not a doubt
 assert.deepEqual(inputDoubts({lawyers:[],matters,departmentHeads:[{name:'na'}]}),[]);
});
