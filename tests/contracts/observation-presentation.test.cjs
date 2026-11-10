require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {observationPresentation}=require('../../src/lib/audit/observation-presentation.ts');
test('missing period explains the consequence and offers data entry, never a paid retry',()=>{
 const p=observationPresentation({code:'MISSING_TEMPORAL_METADATA',message:'Falta el research_period global. Mantener acción interna.'});
 assert.equal(p.destination,'period');assert.match(p.explanation,/qué fechas/);assert.match(p.action,/puedes descargar/);
 assert.doesNotMatch(JSON.stringify(p),/research_period|acción interna|retry-review/);
});
test('spelling variants remain informational and preserve arbitrary names without resolving identity',()=>{
 const d={code:'SOURCE_CONFLICT',field_path:'client',message:'El Audit dice “Example Tech”, mientras la narrativa del mismo asunto usa “Example Technologies”. Presentar ambas variantes literalmente, sin decidir una denominación canónica.'};const before=JSON.stringify(d);const p=observationPresentation(d);
 assert.match(p.explanation,/Example Tech/);assert.match(p.explanation,/Example Technologies/);assert.match(p.explanation,/no dos clientes distintos/);assert.equal(p.destination,'wizard');assert.equal(JSON.stringify(d),before);
 const conflict=observationPresentation({...d,message:'Hay dos nombres y no se pudo confirmar si es el mismo cliente.'});
 assert.doesNotMatch(conflict.explanation,/no dos clientes distintos/);
});
test('confidentiality and failed ranking lookup say what users should do without inventing permissions or ranking',()=>{
 const p=observationPresentation({message:'Los asuntos sin permiso confirmado se entregan únicamente como confidenciales; su publicación sigue pendiente.'});
 assert.match(p.action,/no necesitas cambiar nada/);assert.match(p.action,/confirma primero el permiso/);assert.equal(p.destination,'wizard');
 const rank=observationPresentation({message:'No se encontró una coincidencia exacta de la firma en la tabla consultada.'});assert.match(rank.explanation,/no significa/);assert.equal(rank.destination,'ranking');
});
test('unknown model messages are retained by caller but never used verbatim as the headline',()=>{
 const p=observationPresentation({message:'INTERNAL_BINDING_XYZ / candidates/8 / invalid schema'});
 assert.doesNotMatch(JSON.stringify(p),/INTERNAL_BINDING|candidates\/8|invalid schema/);assert.match(p.explanation,/mensaje completo/);assert.equal(p.destination,undefined);
});
