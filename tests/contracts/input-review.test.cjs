require('../../docs/reviews/review-loader.cjs');
const {normalizeReviewValue,valueResolutionIssues,valueAlternatives}=require('../../src/lib/audit/input-review.ts');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicationStatus,confirmPublicationStatus,validValueResolution,needsInputReview,persistInputReview}=require('../../src/lib/audit/input-review.ts');
const conflict={id:'m',value:'USD 100',valueConflict:'Table USD 100; narrative MXN 5000',rawNotes:'Original source',confidentialityConfirmed:false,isConfidential:true,publish_status:'confirmation_required'};
const resolved=()=>({...confirmPublicationStatus(conflict,'confidential'),value:'MXN 5000',valueResolution:{value:'MXN 5000',reason:'Source A, page 3: exposure confirmed by the author.',confirmed:true}});
test('approximate US dollar alternatives can be confirmed and persisted without changing source evidence',()=>{
 const original={...confirmPublicationStatus(conflict,'confidential'),value:'Approx. US$123,456.00',valueConflict:'Discrepancy detected between table (Approx. US$123,456.00) and narrative (MXN 2 million).'};
 const options=valueAlternatives(original);
 assert.equal(options[0].value,'Approx. USD 123,456.00');
 assert.equal(options[1].value,'MXN 2 million');
 const decision={value:options[0].value,reason:'Table amount checked against the source.',confirmed:true};
 assert.deepEqual(valueResolutionIssues(decision),[]);
 const incoming={...original,value:decision.value,valueResolution:decision};
 assert.equal(validValueResolution(incoming),true);
 const saved=persistInputReview(incoming,original);
 assert.equal(needsInputReview(saved),false);
 assert.equal(saved.valueResolution.originalConflict,original.valueConflict);
 assert.equal(saved.rawNotes,original.rawNotes);
});
test('manual and previously saved US dollar notation is normalized only on explicit confirmation',()=>{
 for(const raw of ['Approx. US$123.00','US$123.00','Approximately us$ 123.00']) {
  const draft={value:raw,reason:'Source table checked.'};
  assert.deepEqual(valueResolutionIssues(draft),[]);
  const value=normalizeReviewValue(raw);
  assert.equal(validValueResolution({value,valueResolution:{...draft,value,confirmed:true}}),true);
  assert.equal(validValueResolution({value,valueResolution:{...draft,value,confirmed:false}}),false);
 }
});
test('disabled confirmation explains missing amount, currency and reason without guessing bare dollar symbols',()=>{
 assert.equal(valueResolutionIssues({}).length,3);
 assert.equal(valueResolutionIssues({value:'USD 123',reason:'   '}).length,1);
 const issues=valueResolutionIssues({value:'Approx. $123.00',reason:'si'});
 assert.equal(issues.length,1);
 assert.match(issues[0],/moneda/);
 assert.equal(normalizeReviewValue('Approx. $123.00'),'Approx. $123.00');
 assert.equal(valueResolutionIssues({value:'USD',reason:'Table checked.'}).length,1);
});
test('missing or contradictory permission never becomes public',()=>{assert.equal(publicationStatus({}),'confirmation_required');assert.equal(publicationStatus({...conflict,isConfidential:false}),'confirmation_required');});
test('publication decisions update every persisted alias together',()=>{for(const status of ['publishable','confidential']){const m=confirmPublicationStatus(conflict,status);assert.equal(publicationStatus(m),status);assert.equal(m.isConfidential,status==='confidential');assert.equal(m.confidentiality_status,status);assert.equal(m.publish_status,status);assert.equal(m.confidentialityConfirmed,true);}});
test('confirmation cannot bypass a missing currency, source, or changed amount',()=>{assert.equal(validValueResolution(resolved()),true);for(const change of [{value:'MXN 6000'},{valueResolution:{...resolved().valueResolution,confirmed:false}},{value:'5000',valueResolution:{...resolved().valueResolution,value:'5000'}},{valueResolution:{...resolved().valueResolution,reason:''}}])assert.equal(validValueResolution({...resolved(),...change}),false);});
test('resolution preserves original evidence and invalidates generated prose',()=>{const m=persistInputReview({...resolved(),optimizedText:'Old amount narrative'},conflict);assert.equal(m.value,'MXN 5000');assert.equal(m.valueConflict,'');assert.equal(m.valueResolution.originalConflict,conflict.valueConflict);assert.equal(m.rawNotes,conflict.rawNotes);assert.equal(m.optimizedText,'');assert.equal(needsInputReview(m),false);});
test('removing a conflict flag does not erase the persisted blocker',()=>{const m=persistInputReview({...conflict,valueConflict:''},conflict);assert.equal(m.valueConflict,conflict.valueConflict);assert.equal(needsInputReview(m),true);});
test('editing a previously resolved value reopens review',()=>{const previous=persistInputReview(resolved(),conflict);const m=persistInputReview({...previous,value:'USD 1'},previous);assert.equal(needsInputReview(m),true);});
test('snake case and legacy discrepancy flags require review',()=>{for(const key of ['value_conflict','sourceValueConflict'])assert.equal(needsInputReview({isConfidential:true,[key]:'discrepancy'}),true);});
test('changed value cannot retain stale optimized prose',()=>{const m=persistInputReview({isConfidential:true,value:'USD 200',optimizedText:'USD 100 old prose'},{isConfidential:true,value:'USD 100'});assert.equal(m.optimizedText,'');assert.equal(m.status,'Draft');});
test('source alternatives are literal and never convert amounts',()=>{const {valueAlternatives}=require('../../src/lib/audit/input-review.ts');assert.deepEqual(valueAlternatives({valueConflict:'SOURCE VALUE CONFLICT: Discrepancy detected between table (US$ 1,144,523.00) and narrative (MXN 5.5 million).'}),[{label:'Monto de la tabla',value:'USD 1,144,523.00'},{label:'Monto de la narrativa',value:'MXN 5.5 million'}]);assert.deepEqual(valueAlternatives({valueConflict:'Unstructured disagreement'}),[]);});
test('a pending partial value decision stays pending after saving and reopening',()=>{const draft={...resolved(),valueResolution:{...resolved().valueResolution,confirmed:false}};const saved=persistInputReview(draft,conflict);assert.equal(needsInputReview(saved),true);assert.equal(saved.valueResolution.reason,draft.valueResolution.reason);assert.equal(saved.valueConflict,conflict.valueConflict);});
test('saving an already resolved matter preserves its current optimized prose',()=>{const saved=persistInputReview(resolved(),conflict);const optimized={...saved,optimizedText:'Confirmed amount narrative',status:'Optimized'};const again=persistInputReview(optimized,saved);assert.equal(again.optimizedText,'Confirmed amount narrative');assert.equal(again.valueConflict,'');});
test('saved confidential classification cannot be changed to public during review',()=>{const previous={id:'m',isConfidential:true,confidentialityConfirmed:true,publish_status:'confidential'};const incoming=confirmPublicationStatus(previous,'publishable');const saved=persistInputReview(incoming,previous);assert.equal(publicationStatus(saved),'confidential');assert.equal(saved.isConfidential,true);assert.equal(needsInputReview(saved),false);});
test('unknown permission restricted as confidential remains a genuine decision',()=>{const previous={id:'m',isConfidential:true,confidentialityConfirmed:false,publish_status:'confirmation_required'};const saved=persistInputReview(confirmPublicationStatus(previous,'publishable'),previous);assert.equal(publicationStatus(saved),'publishable');assert.equal(saved.isConfidential,false);});
test('retaining confidential status does not bypass a value conflict',()=>{const previous={id:'m',isConfidential:true,confidentialityConfirmed:true,publish_status:'confidential',valueConflict:'Conflicting source amounts'};const saved=persistInputReview(previous,previous);assert.equal(publicationStatus(saved),'confidential');assert.equal(needsInputReview(saved),true);});

test('cards hide unresolved amounts but preserve evidence and allow an absent amount',()=>{
  const {displayedMatterValue,hasPendingValue}=require('../../src/lib/audit/input-review.ts');
  assert.equal(displayedMatterValue(conflict),'Por definir');
  assert.equal(conflict.value,'USD 100');
  assert.equal(displayedMatterValue(resolved()),'MXN 5000');
  assert.equal(displayedMatterValue({...resolved(),value:'USD 1'}),'Por definir');
  assert.equal(displayedMatterValue({isConfidential:true}),'No informado');
  assert.equal(hasPendingValue({isConfidential:true}),false);
  assert.equal(needsInputReview({isConfidential:true}),false);
});

test('source recheck only fills undecided confidentiality and preserves edits and value decisions',()=>{
 const {applySourceConfidentiality}=require('../../src/lib/audit/input-review.ts');
 const pending={...conflict,client:'Synthetic Alpha',source_excerpt:'Same source paragraph.',optimizedText:'Saved edited text',valueResolution:{value:'USD 100',reason:'Source checked.',confirmed:true}};
 const evidence={version:1,basis:'client_register',requires_review:false};
 const extracted={...confirmPublicationStatus(pending,'confidential'),confidentialityEvidence:evidence,name:'Confidential Matter 1',title:'Confidential Matter 1',source_label:'MATTER NUMBER 1',value:'USD 999',optimizedText:''};
 const [patched]=applySourceConfidentiality([pending],[extracted]);
 assert.equal(publicationStatus(patched),'confidential');assert.equal(patched.id,pending.id);
 assert.equal(patched.value,pending.value);assert.deepEqual(patched.valueResolution,pending.valueResolution);assert.equal(patched.optimizedText,pending.optimizedText);
 for(const existing of [confirmPublicationStatus(pending,'publishable'),confirmPublicationStatus(pending,'confidential')])assert.deepEqual(applySourceConfidentiality([existing],[extracted]),[existing]);
 for(const candidates of [[extracted,extracted],[{...extracted,client:'Different Client'}],[{...extracted,source_excerpt:'Different paragraph'}],[{...extracted,confidentialityEvidence:{...evidence,requires_review:true}}],[{...extracted,confidentialityEvidence:null}]])assert.deepEqual(applySourceConfidentiality([pending],candidates),[pending]);
});
