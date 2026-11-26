require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const reg=require('../../src/lib/editorial/case-register.ts');
const {anonymizeConfidentialClients}=require('../../src/lib/docx/lawyer-curator.ts');

// v1.0.121, real runs of 26 Nov 2026 (synthetic names here).
const register={version:'case-register-v1',method:'model',
  clients:{m1:{name:'Instituto Ejemplo de Gestión (IEG)',other_names:['IEG','Gestion Trading']},m2:{name:'Comercial Norte, C.A.',other_names:['Norte']}},
  matters:{m1:{leads:[{name:'Ana Ruiz',roster:'ana ruiz'},{name:'Bruno Soto',roster:'bruno soto'}],team:[{name:'Lucia Prado',roster:'lucia prado'}]},m2:{leads:[{name:'Ana Ruiz'}],team:[]}},lawyers:{}};
const data=()=>({firm_name:'Ejemplo',research_period:{from:'2025-11-26',to:'2026-11-26'},case_register:register,
  contacts:[{name:'Valeria Paz',email:'Na',phone:'NA'}],departmentHeads:[{name:'Ana Ruiz',email:'n/a',phone:'+58 000'}],
  matters:[{id:'m1',client:'Instituto Ejemplo de Gestión (IEG)- a school of management, business, and graduate studies.',leadPartner:'na',teamMembers:'',publish_status:'confidential',isConfidential:true},
           {id:'m2',client:'Comercial Norte, C.A.',leadPartner:'Ana Ruiz (Partner)',publish_status:'publishable',isConfidential:false}]});

test('a placeholder lead is printed as the register reads it; a real answer and a contact placeholder are handled',()=>{
  const {data:out,submission}=reg.renderingInputs(data(),{matters:data().matters});
  assert.equal(out.matters[0].leadPartner,'Ana Ruiz; Bruno Soto');
  assert.equal(out.matters[0].teamMembers,'Lucia Prado');
  assert.equal(out.matters[1].leadPartner,'Ana Ruiz (Partner)');
  assert.equal(submission.matters[0].leadPartner,'Ana Ruiz; Bruno Soto');
  assert.deepEqual(out.contacts[0],{name:'Valeria Paz',email:'',phone:''});
  assert.deepEqual(out.departmentHeads[0],{name:'Ana Ruiz',email:'',phone:'+58 000'});
  assert.equal(reg.isPlaceholder('N/A'),true);assert.equal(reg.isPlaceholder('Ana Ruiz'),false);
});

test('the Word anonymises every name the register gives a confidential client and never a word of its description',()=>{
  const d=data();
  const names=[...d.matters.filter(m=>m.isConfidential).map(m=>m.client),...reg.registerConfidentialNames(d,m=>!m.isConfidential)];
  assert.deepEqual(reg.registerConfidentialNames(d,m=>!m.isConfidential),['Instituto Ejemplo de Gestión (IEG)','IEG','Gestion Trading']);
  const out=anonymizeConfidentialClients('We kept business continuity for education and business associations; Gestion Trading and IEG were advised.',names);
  assert.match(out,/business continuity for education and business associations/);
  assert.doesNotMatch(out,/Gestion Trading|IEG/);
});

test('the register is stale when what it was read from changes',()=>{
  const d=data();d.case_register={...register,source_hash:reg.registerSourceHash(d)};
  assert.equal(reg.registerFresh(d),true);
  d.matters[0].rawNotes='A new narrative.';
  assert.equal(reg.registerFresh(d),false);
  // A case saved before the register: the form cell, else blank; never "na".
  const old=[{id:'a',leadPartner:'na',original_code_extraction:{leadPartner:'Ana Ruiz (Partner)'}},{id:'b',leadPartner:'N/A'},{id:'c',leadPartner:'Bruno Soto'}];
  assert.deepEqual(reg.applyRegister(old,null).map(m=>m.leadPartner),['Ana Ruiz (Partner)','','Bruno Soto']);
});

test('the case register enters the package every role reads, and only a new generation reads it',()=>{
  const {reviewPackage}=require('../../src/lib/audit/review-checkpoint.ts');
  const d=data();
  assert.equal(reviewPackage({targetDirectory:'Chambers',practiceArea:'Tax'},d,d.matters).case_register,register);
  const fs=require('node:fs');const path=require('node:path');
  const build=fs.readFileSync(path.join(__dirname,'../../src/lib/editorial/case-register-build.ts'),'utf8');
  assert.match(build,/last\.sourceHash===stableHash\(sourceSnapshot\(submission\)\)/);
  const route=fs.readFileSync(path.join(__dirname,'../../src/app/api/editorial/jobs/route.ts'),'utf8');
  assert.match(route,/body\.repair===true \? \{submission,trace:null\}/);
});
