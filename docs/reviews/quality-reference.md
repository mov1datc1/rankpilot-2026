# Reference quality workflow

Availability is independent of editorial acceptance. Keep the product's two
terminal labels: documents available with observations / without observations.
Do not turn this offline release check into a new end-user delivery blocker.

## Shared evidence before prose

The engine already shares `development.case_plan`, original source records and
selection across the Audit and Submission. Do not add a second strategist or
re-extract documents to evaluate a saved output.

Each source-bound decisive passage now receives its own required field verdict.
Its source reference cannot be borrowed from another passage. Reviews remain
grouped by field and use the existing recovery allowances. More explicit checks
can increase review output and batch count; they do not introduce unlimited
repairs or a fresh allowance per source quotation. Literal binding is necessary,
not proof of factual sufficiency; the semantic reviewer remains responsible.

Profile coverage records the relationship, named entity and any actual privacy
basis. A confidential client mandate does not automatically make a separately
supplied former-employer credential confidential. A restriction on that career
fact still applies. Rendering preserves only its bound career occurrence; the
same identity in client work remains subject to anonymization and review.
Legacy profiles without those bindings receive no name-based exemption.

Public development/repair does not receive the old rendered Audit or checkpoint
as source prose. It retains original facts, the shared strategy and located
defects. The independent editor still compares both documents. Do not add a
paid full-document style pass merely to repeat this review. Approved examples
may be added only when their approval and permissible factual scope are known.

The executive Audit renderer emits its five reviewed sections. Runtime errors,
rejected quotations and repair paths remain application observations rather than
being appended to the letter. No observation is deleted or converted to approval.

## Fixed private bank

Store private originals, extractions, feedback, the reference Word pair and
candidate pair outside Git. The manifest pins every reference file with SHA-256.
Keep previous failures; never overwrite the reference with a new output merely
because its automatic judge passed. Use a synthetic equivalent in public CI.

Run from `ai-engine`:

```sh
python -m core.quality_regression /absolute/private/bank.json --output /absolute/private/comparison.json
python -m core.quality_regression /absolute/private/bank.json --require-release-quality
```

The first command exits nonzero for a lost baseline check or a recorded rubric
regression. The second also requires all declared checks and a complete,
artifact-bound human review that accepts the candidate and does not lower any
rubric dimension relative to the reference. A synthetically passing CI suite
does **not** run the private bank or establish release quality. The release
operator must run this gate against the actual candidate files. No private Word,
sources or feedback should be uploaded to CI to bypass that separation.

Manifest shape:

```json
{
  "cases": [{
    "id": "synthetic-example",
    "baseline": {
      "audit": {"path": "reference-audit.docx", "sha256": "actual SHA-256"},
      "submission": {"path": "reference-submission.docx", "sha256": "actual SHA-256"}
    },
    "candidate": {
      "audit": {"path": "candidate-audit.docx"},
      "submission": {"path": "candidate-submission.docx"}
    },
    "evidence_files": [{"path": "source.json", "sha256": "actual SHA-256"}],
    "checks": [{
      "id": "decisive-workforce",
      "artifact": "submission",
      "scope": "E2:(?P<field>.*?)E3:",
      "mode": "required",
      "pattern": "4,200 employees"
    }]
  }]
}
```

Use Python regex syntax for the named field group: `(?P<field>...)`. Scope a fact to its own field;
an Audit mention cannot excuse a Submission omission. An absent or ambiguous
scope fails. Required/forbidden patterns detect only the declared cases and do
not establish semantic quality, universal role correctness or confidentiality.
Never rewrite prose with these expressions.

Add `baseline_review` and `human_review` with `artifact_hashes` (audit/submission),
`reviewer`, `evidence`, `decision` and `rubric`. The candidate decision must be
`accept`. Each rubric entry requires `score` from 1 to 10 and concrete `evidence`:

- `source_fidelity`: facts, status, quantities, concepts and currencies.
- `audit_submission_consistency`: shared argument with appropriate public/private scope.
- `personal_case_b9`: credentials, personal contribution, outcome and category rationale.
- `institutional_b10_c2`: distinct institutional argument and supported coverage request.
- `selection_and_comparisons`: hero, portfolio and meaningful borderline comparisons.
- `firm_voice`: direct professional prose without internal review commentary or filler.
- `confidentiality_and_roles`: correct disclosure and no invented seniority/attribution.
- `actionable_audit`: concise decisions and genuine remaining client actions.

Scores are a documented editorial judgment, not a model certificate or a promise
that the next stochastic generation will match. Preserve source-limited profiles;
never pad B9 merely to reach a word count. Do not require every internal Audit
fact in a public field: reserve comparisons and confidential details have
different destinations.
