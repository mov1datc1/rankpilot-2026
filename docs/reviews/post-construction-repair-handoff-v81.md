# Post-construction repair handoff and initial profile-binding scope (v1.0.81)

## Cause

1. When a job recovered from a pre-prose construction plan coverage failure (`construction_plan_recovery_requested`) and then completed all 14 construction units (`editorial-construction-v1`, `remaining_units: 0`), the final unit's local validation handoff (`DEVELOPMENT_REJECTED`, `retryable: true`) was counted together with the earlier pre-prose plan failure by `recoveryPlan`. Seeing two failures at `stage: 'development', cursor: 1`, `recoveryPlan` returned `null` before `repair_development` or `field_review` ran.
2. In `editorial_repair.py`, `candidate_output_repair_only` excluded derived `profile_privacy_error` messages during initial `repair_targets` construction, leaving initial candidate repairs without `mutable_fields` or `profile_binding_repairs`. In addition, when a `profile_binding_repairs` entry remained an unproven alias during `project_repair_result` / `apply_corrections`, `validate_binding_delta` aborted the entire repair response rather than retaining the prior binding and committing valid biography fixes (such as a confirmed department-head function).

## Fix

- `src/lib/editorial/recovery.ts`: count per-cursor failures after the latest `construction_plan_recovery_requested` or `post_construction_repair_requested` marker.
- `src/lib/editorial/construction-recovery.ts` and `src/lib/editorial/jobs.ts`: add `canResumePostConstructionRepair` (`post-construction-initial-repair-v1`) ahead of `canRecheckDevelopment` so a completed construction assembly stopped before `repair_report` / `field_review_receipts` resumes directly into `repair_development` instead of a zero-call validation recheck.
- `ai-engine/core/editorial_repair.py` and `ai-engine/core/profile_binding_repair.py`: allow derived profile-binding faults in `candidate_output_repair_only` when original `profile_units` references and quotations are intact, and retain unchanged prior bindings when a proposed alias binding remains unproven in `project_repair_result` so valid biography updates commit cleanly and remaining binding issues proceed through bounded residual retry and `development_observations`.

## Validation

- 857 Python unit tests pass (`unittest`).
- 585 Node contract tests pass (1 skipped) and TypeScript (`tsc --noEmit`) passes.
- Offline checkpoint replay confirms `canResumePostConstructionRepair`, strict repair schema generation, headship acceptance, and `source-field-review-v1` scheduling with zero paid calls.
