# Owner feedback acceptance — AraqueReyna and Ramos Castillo (31-08)

## Scope and evidence available

The two owner feedback messages were evaluated against the AI-engine, LangGraph,
RAG router, DOCX generators, persistence path, and changelog. The expected source
invariants are captured in:

- `fixtures/araquereyna_31_08.json`
- `fixtures/ramos_castillo_31_08.json`

The exact sources and four generated `31-08` outputs were restored under
`Angela_revision/10 submission ` (the directory name has a trailing space).
Both source SHA-256 values match the golden fixtures exactly.

## Legacy output validation result

The `31-08` outputs reproduce the owner's findings and correctly fail the v26.1
acceptance runner:

- Araque optimized submission: 26 matters (11 publishable + 15 confidential)
  instead of 25 (10 + 15).
- Araque Audit: four of six ranked lawyers absent; internal architecture language
  and “demonstrative capacity” present.
- Ramos submission/Audit: unsupported Balken mechanics and unsupported C2 claims
  present; “Jalisco-centred” promoted into the positioning.
- Araque and Ramos Audits: percentage table widths; Ramos submission: one `auto/0`
  table width. These reproduce the Google Docs rendering defect.

Those documents predate the corrections. They are regression inputs, not evidence
that newly generated output has passed.

The later Araque file ending `movida-31-8` also fails acceptance. Its physical
register contains 25 matters but is 11 publishable + 14 confidential rather than
the required 10 + 15, and its lawyer-table markers identify it as a prior
RankPilot output rather than an admissible original source. Render logs show the
run used Terra and bypassed the constitutional judge after pre-flight failure;
there is no evidence that a Sol judge evaluated that candidate.

## Acceptance matrix

| Owner observation | Deterministic acceptance condition | Enforcement | Status |
|---|---|---|---|
| Araque matter loss | Exactly 25 matters: 10 publishable and 15 confidential | Source-label reconciliation drops unsupported duplicates; missing real labels fail closed; artifact register validation | Source verified + automated |
| Pampero role | Gruppo Montenegro is buyer; Diageo is seller/counterparty | Semantic transaction-role parser and regression test | Automated |
| Pampero as lead | Objective-aligned Hero selection may retain the strongest category-relevant matter | Blueprint and narrative-architecture deterministic post-check | Automated |
| No internal system language | No guard, engine, prompt, model-limitation, or “demonstrative capacity” phrasing in client output | Prompt prohibition plus recursive language filter | Automated |
| Missing work mechanics | Missing outcome, deliverable, authority, document, procedure, metric, and lawyer-role facts become questions | Evidence-gap node; optimizer source boundary; output rollback | Automated |
| Lawyer dimension | All six Araque ranked lawyers remain in the canonical roster and appear in the Audit accountability table | Deterministic B9 parser recovers 10 lawyers/6 ranked; canonical reconciliation and matter-support matrix | Source verified + automated |
| Unsupported C2 | A blank C2 stays blank and produces a targeted question; a populated C2 is preserved from source rather than reconstructed | Deterministic C2 source extraction/gate and evidence-gap fallback | Source verified + automated |
| Ramos matter addition | Exactly 33 matters: 20 publishable and 13 confidential; a 34th item fails | Exact reconciliation and over-extraction test | Automated |
| National objective | A state-centred identity cannot become the thesis for a national objective | Objective validator, deterministic fallback thesis, recursive Audit repair | Automated |
| Ramos Hero | For first recognition in Real Estate, El Cielo outranks Grupo R on category fit | Objective-aligned Hero selector and regression test | Automated |
| Balken inventions | Invoice review, evidence matrices, calendars, guarantees, and similar unsupported mechanics fail grounding | Lean optimizer prompt, literal evidence quotes, protected markers, and per-matter source rollback | Automated |
| Audit insight reaches B10 | Source-backed practice patterns, Hero, supporting matters and geography lead the original B10 | Deterministic strategic insertion assembled from canonical source spans | Source verified + automated |
| RAG contamination | RAG supplies methodology only and cannot become submission evidence | Chunk IDs, source/tier/score provenance, context cap, explicit prompt boundary | Automated |
| DOCX Google compatibility | Every table and grid column uses positive integer DXA widths; package structure validates | TypeScript builder widths, clone normalization, OOXML validator | Automated |
| Two high-value outputs | Optimized submission and Strategic Audit have distinct state/persistence contracts | LangGraph artifact-validation node and callback persistence | Automated |

## Model execution contract

Production calls are centralized in `utils/model_factory.py`:

| Stage | Model | Reasoning effort | API mode |
|---|---|---|---|
| Extraction | `gpt-5.6-terra` | low | Responses API |
| Standard analysis/optimization | `gpt-5.6-terra` | medium | Responses API |
| Editorial reasoning | `gpt-5.6-terra` | high | Responses API |
| Independent release judge | `gpt-5.6-sol` | xhigh | Responses API + strict Structured Outputs |

The exact profiles are stored internally in the pipeline manifest. They are not
printed in the client-facing Strategic Audit.

## Verification completed

- Python unit/regression suite: 46 tests passed.
- Python compile check: passed.
- LangGraph construction: `CompiledStateGraph`.
- TypeScript: `npx tsc --noEmit` passed.
- The real `31-08` outputs reproduce the reported malformed table-width issue.
  In-memory normalization of the Ramos source produces zero OOXML errors.

## Live acceptance still required

Generate fresh outputs from the corrected pipeline, then execute:

```bash
python3 scripts/validate_owner_case.py araquereyna SOURCE OPTIMIZED_DOCX AUDIT_DOCX
python3 scripts/validate_owner_case.py ramos_castillo SOURCE OPTIMIZED_DOCX AUDIT_DOCX
```

Verify:

1. source SHA-256 equals the fixture hash;
2. the matter and lawyer registers reconcile exactly;
3. no grounding rollback remains unexplained;
4. the optimized submission and Audit both pass OOXML validation;
5. the acceptance matrix above holds against the rendered documents.

Do not mark the release as live-case accepted until those five checks pass.
