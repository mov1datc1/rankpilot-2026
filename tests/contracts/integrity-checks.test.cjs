require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {integrityChecks}=require('../../src/lib/audit/integrity-checks.ts');
const {buildAuditDoc}=require('../../src/app/api/generate-docx/audit-builder.ts');
const {Packer}=require('docx'),JSZip=require('jszip');

// v1.0.105 (Ángela, DeForest 19 Nov): synthetic copies of the four cases she found, plus Ramos.
const data={numPartners:'4',lawyers:['A','B','C','D','E'].map(n=>({name:'Partner '+n,isPartner:true})),
 canonical_matter_selection:{core_matter_ids:['art','cin','axle','ok','ramos','fx']},
 matters:[
  {id:'art',client:'Example Art',value:'US$ 104,000,000.45',summary:'Three inspections concluded without fines despite combined potential exposure approaching MXN 2 million.'},
  {id:'cin',client:'Example Cinema',value:'US$ 553,278.59',summary:'Approximately 200 proceedings with aggregate exposure exceeding MXN 60.5 million.'},
  {id:'axle',client:'Example Axle Manufactury',value:'',summary:'Example Axle & Manufacturing appointed the firm as strategic labour counsel.'},
  {id:'ok',client:'Example Coats',value:'Approx. US$ 675,000.00',summary:'Exposure of MXN 12.5 million was reduced.'},
  {id:'fx',client:'Example Fuel',value:'MXN 3,400,000.00 (approx. USD $200,000)',summary:'Fines of MXN 3,474,240.'},
  {id:'ramos',client:'Example Cardboard',value:'$3,400,000.00',summary:'The authority imposed a closure.'},
  {id:'reserve',client:'Not Selected',value:'$1.00',summary:'Reserve.'}]};

test('the source-integrity checks flag exactly the real anomalies, once each',()=>{
 const checks=integrityChecks(data,data.matters);
 assert.equal(checks.length,5,checks.join('\n'));
 assert.match(checks[0],/B2 declara 4 socios.*5 como Partner/);
 assert.ok(checks.some(c=>/Example Art.*millones con centavos y no corresponde.*MXN 2 million/.test(c)));
 assert.ok(checks.some(c=>/Example Cinema.*MXN 60\.5 million/.test(c)));
 assert.ok(checks.some(c=>/Example Axle Manufactury.*«Example Axle & Manufacturing»/.test(c)));
 assert.ok(checks.some(c=>/Example Cardboard.*no indica la moneda/.test(c)));
 assert.ok(!checks.some(c=>/Example Coats|Example Fuel|Not Selected/.test(c)));
 assert.deepEqual(integrityChecks({numPartners:'2',lawyers:[{name:'A',isPartner:true},{name:'B',role:'Partner'}]},[]),[]);
});
test('the Audit lists them after the five reviewed sections, only when present',async()=>{
 const letter={executive_assessment:'Veredicto.',portfolio:'Cartera.',leadership:'Personas.',evidence_gaps:'Reservas.',next_steps:'Acciones.'};
 const text=async d=>{const doc=buildAuditDoc('Firm','Labour',{},{},letter,{chambersData:{...d,editorial_review:{letter}},matters:d.matters||[]});
  return (await (await JSZip.loadAsync(await Packer.toBuffer(doc))).file('word/document.xml').async('string')).replace(/<[^>]+>/g,' ');};
 const withChecks=await text(data);
 assert.ok(withChecks.indexOf('5. Actions Before Filing')<withChecks.indexOf('6. Verificaciones antes de presentar'));
 assert.match(withChecks,/no indica la moneda/);
 assert.doesNotMatch(await text({numPartners:'1',lawyers:[{name:'A',isPartner:true}],matters:[]}),/Verificaciones antes de presentar/);
});
