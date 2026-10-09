require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {generatedContentHash,mayRepairAutomatically}=require('../../src/lib/editorial/repair-progress.ts');
test('automatic repair continues only with content progress and within bounded attempts',()=>{
 const before={editorial_review:{letter:{portfolio:'Old'}},draft_revision:1};
 const review={stage:'artifact',generated_content_hash:generatedContentHash(before)};
 assert.equal(mayRepairAutomatically([],before),true);
 assert.equal(mayRepairAutomatically([review],{...before,draft_revision:2}),false);
 const after={editorial_review:{letter:{portfolio:'Corrected'}}};
 assert.equal(mayRepairAutomatically([review],after),true);
 assert.equal(mayRepairAutomatically([review,review,review],after),false);
});
const {unrepairedGeneratedClaims}=require('../../src/lib/editorial/repair-progress.ts');
test('a concrete requested correction cannot disappear from review while the rejected claim survives',()=>{
 const sector={code:'SOURCE_CONFLICT',owner:'rankpilot',severity:'warning',scope:'submission',field_path:'client_sector',artifact_quote:'The industrial workforce.',source_quote:'Source has two sectors.',conflict_resolution:'omit_nonessential_descriptor'};
 const unrelated={...sector,owner:'user'};
 const found=unrepairedGeneratedClaims([sector,unrelated],'The industrial\nworkforce.','');
 assert.equal(found.length,1);assert.equal(found[0].severity,'critical');assert.equal(found[0].verification,'unchanged_generated_claim');
 assert.equal(sector.severity,'warning');
 assert.deepEqual(unrepairedGeneratedClaims([sector],'The workforce.','The industrial workforce.'),[]);
 assert.deepEqual(unrepairedGeneratedClaims([{...sector,code:'MISSING_TEMPORAL_METADATA'}],'The industrial workforce.',''),[]);
 assert.deepEqual(unrepairedGeneratedClaims([{...sector,conflict_resolution:'preserve_source_aliases',field_path:'client'}],'The industrial workforce.',''),[]);
});
