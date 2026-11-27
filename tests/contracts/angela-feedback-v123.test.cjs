require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');

// v1.0.123: Ángela's review of 26 Nov 2026 (synthetic names).
test('the form Partner and Ranked Y/N are printed as the firm filled them in, also when saved as text',()=>{
  const {curateLawyers}=require('../../src/lib/docx/lawyer-curator.ts');
  const lawyers=[{name:'Ana Ruiz',isPartner:'True',isRanked:'True',url:'https://example.com/ana'},{name:'Lucia Prado',isPartner:'False',isRanked:'False',url:'https://example.com/lucia'},{name:'Bruno Soto',is_partner:true,is_ranked:false}];
  const out=curateLawyers(lawyers,[],'Ejemplo','Labour','Venezuela',{});
  const by=Object.fromEntries((out.lawyers || out).map(l=>[l.name,l]));
  assert.equal(by['Ana Ruiz'].isPartner,true);assert.equal(by['Ana Ruiz'].isRanked,true);
  assert.equal(by['Lucia Prado'].isPartner,false);assert.equal(by['Lucia Prado'].isRanked,false);
  assert.equal(by['Bruno Soto'].isRanked,false);
});

test('notices are sorted into decision, information and resolved by RankPilot, and none is repeated',()=>{
  const {caseReadiness}=require('../../src/lib/audit/case-readiness.ts');
  const lawyers=[{name:'Ana Ruiz',url:'https://example.com/ana'},{name:'Lucia Prado',url:'https://example.com/lucia'}];
  const matters=[{client:'Alpha Corp',rawNotes:'The firm advised Alpha Corp on a restructuring of its workforce.',leadPartner:'Ana Ruiz and Carlos Otro',teamMembers:'Lucia Prado'}];
  const r=caseReadiness({firmName:'Ejemplo',practiceArea:'Labour',lawyers,matters,b10Text:'The practice advises employers.'});
  const all=[...r.verdict.limitations,...r.items.map(i=>i.text)];
  assert.equal(all.filter(t=>/solo un enlace/.test(t)).length,1);
  assert.equal(r.items.find(i=>/varios socios responsables/.test(i.text)).kind,'auto');
  assert.equal(r.items.find(i=>/no tienen perfil en B9/.test(i.text)).kind,'info');
  assert.doesNotMatch(all.join(' '),/Añade su perfil o confirma/);
});

test('D1/E1 print the client name, not the description pasted after it',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const src=fs.readFileSync(path.join(__dirname,'../../src/app/api/generate-docx/submission-builder.ts'),'utf8');
  assert.match(src,/matter\?\.client_name \|\| ''\)\) \|\| nameOnly\(sanitizeClientName\(stripped\)\.cleanClient\)/);
  const {nameOnly}=require('../../src/lib/docx/client-aliases.ts');
  assert.equal(nameOnly('Servicios Nube, S.C.A. - part of a global provider of services'),'Servicios Nube, S.C.A.');
  const reg=require('../../src/lib/editorial/case-register.ts');
  const out=reg.applyRegister([{id:'m',client:'Servicios Nube, S.C.A. - a provider'}],{version:'case-register-v1',clients:{m:{name:'Servicios Nube, S.C.A.',other_names:[]}},matters:{}});
  assert.equal(out[0].client_name,'Servicios Nube, S.C.A.');
});
