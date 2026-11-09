# v1.0.62 — Complete context for institutional field review

An institutional section can combine several source-backed arguments. The early reviewer received only each argument's linked records, then rejected other supported contributions elsewhere in B10/C2 as absent from those records. Repair had the full selected portfolio and could preserve another valid contribution, which the narrower reviewer again rejected. This was a mismatch in evidence scope.

B10/C2 review now receives all selected original matter records as explicit field context, deduplicated once. Each argument keeps its own required source proofs; context cannot substitute for executing that argument or establish another person's role or another mandate's outcome. Excluded and reserve matters are not added to institutional context. Personal reviews retain their own separate evidence. Source-context changes invalidate the relevant review receipts.

A stopped legacy institutional diagnosis can be reconsidered once after the software correction, provided the sources are unchanged, selection is validated, consumption is known and capacity remains. The same job, accumulated consumption and two-method repair counters are preserved. A new verdict must pass; this does not grant a third repair or waive final document review. Current-context failures, other field failures, unknown usage and exhausted budgets remain ineligible.

The UI no longer tells a user to contact an administrator when a valid continuation action is available.

Validation: 760 Python tests, 533 Node tests passed with one existing skip, and TypeScript. The context regression failed before the fix. A replay of an existing paused proposal schedules review with all 20 selected records and unchanged method counters, without a generation call. Worker integration checks that continuation flags, counters and the remaining allowance reach the engine. These checks do not certify a new approved Word pair or customer acceptance; the native continuation is recorded separately.
