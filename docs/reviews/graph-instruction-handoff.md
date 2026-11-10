# Graph instructions and repair semantics

Status: locally implemented and tested; not deployed by this audit.

## Scope and paths

Studio uses `/extract`, followed by the durable worker's `/review-step` stages: selection, shared case/development with field review, Audit writing, rendering and exact-artifact review. The compatibility `/api/process-document` route delegates to extraction and Studio, not the legacy multi-node reasoning graph. `/review-package` also executes the current review graph directly. Manual B10/matter tools use separate micro-optimizer prompts. The old `/process` and `/process-async` endpoints still expose `core/graph.py`; its policies are not certified as equivalent to Studio by this work.

## Confirmed defects and changes

1. **Diagnostic type was lost.** Every failed field check became `EDITORIAL_OMISSION`, including wrong assertions. New checks distinguish omission, unsupported claim and a concrete writing-contract violation. This lets an unsupported claim reach the existing rejected-quotation handling instead of being protected as text that only needs an addition. Legacy saved checks without a type retain their previous interpretation; no destructive classification is guessed from prose. Classification remains a model judgment, not a deterministic semantic guarantee.
2. **History was reused as pending work.** At completion of field review, all historical findings were appended to repair feedback. Feedback now contains current hash-bound observations plus parent feedback needed to reconcile the companion document. The full historical record remains intact. No expired observation certifies changed text or sources.
3. **Direct graph repair differed from staged repair.** A letter-only final rejection could send execution back through full Audit generation because the judge's findings were not set as repair feedback. An explicit bounded `audit_repair` route now passes them into targeted letter repair, reusing the same attempt limit. A genuine user-owned conflict does not buy an automatic writing attempt. This route correction is not evidence that Studio's durable worker had that exact defect.
4. **Category review lacked decision context.** The rationale check now receives recommendation, missing criterion and recommended action, as generated context distinct from source evidence. It evaluates them in their proper fields instead of requiring repetition inside the rationale. A supported decision not to nominate is distinct from an unresolved proposed category; it must not force a pending nomination.
5. **Manual rewriting had a conflicting template.** Matter micro-optimization required three paragraphs and then mechanically merged longer output. It now preserves evidence-proportionate paragraph structure and shares actor-preservation, narrative and source-comparison guidance with the current graph. The returned explanation no longer asserts an official three-paragraph Chambers standard or unverified perfect factual fidelity. Existing evidence gates remain.

## Validation and limits

801 Python tests pass, including seven new checks. Six before-change cases reproduced classification-schema absence, stale feedback, pending-observation selection, direct graph routing, missing category context and forced manual paragraph merging. Additional coverage checks that an unsupported BIO assertion is available for correction without freezing the rejected wording. Existing full-graph tests still verify bounded termination and unchanged sources/selection; their mocks now use the actual targeted Audit delta contract.

Offline schema construction on a saved production-sized proposal covers 46 review fields and 11 batches. All serialized contracts pass the application's schema-size checks. Source, historical state and existing documents remain untouched. No provider generation, Chrome action, deployment, new Word score or autonomous acceptance is claimed. Other directory references and the legacy graph require their own scope-specific validation before claiming equivalent behavior.
