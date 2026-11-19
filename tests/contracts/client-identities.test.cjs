require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('../fixtures/client-identities.json');
const {clientAliases}=require('../../src/lib/docx/client-aliases.ts');

// v1.0.101: the Word renderer and the engine validator share one alias rule
// (ai-engine/core/client_identity.py reads the same fixture).
test('the renderer recognises the same client variants as the engine',()=>{
  for (const c of fixture.aliases) for (const alias of c.includes) assert.ok(clientAliases([c.client]).includes(alias),`${c.client} → ${alias}`);
  for (const c of fixture.excludes) for (const alias of c.not) assert.ok(!clientAliases([c.client]).includes(alias),`${c.client} ↛ ${alias}`);
});

test('the reviewed B10 is printed without a fixed firm-specific opening',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../src/app/api/generate-docx/submission-builder.ts'),'utf8');
  assert.ok(!source.includes('Strategic Primacy (Angela'));
  assert.ok(!source.includes('is distinguished by high-stakes collective negotiations'));
});
