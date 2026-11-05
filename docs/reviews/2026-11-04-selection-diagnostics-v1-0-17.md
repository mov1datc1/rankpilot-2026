# Selection diagnostics and terminal findings — v1.0.17

A fixed-version production acceptance attempt reached extraction and then stopped in selection. Three actual independent reviews and two bounded corrections ran; the completed-review counter was accurate. The final selection remained rejected. No Submission/Audit pair was approved, and no manual document repair or live code change rescued the attempt.

The observed failure exposed three gaps: capacity bookkeeping entered a legal rationale; a conditional evidence request conflicted with deliverables already described by the decision; and the UI displayed a generic draft-ready marker instead of the current selection findings. A source quotation alone did not identify the allegedly false generated claim.

The correction shares decision-level reasoning across selector, repairer and reviewer. It separates application constraints from source facts, discourages capacity prose and checks the complete decision before alleging missing evidence. Rejected diagnostics must bind both original-source evidence and an exact quotation in the same decision; invalid diagnostics preserve consumption and stop without approval or an additional paid correction. Every matter still receives independent review, and genuine contradictions remain blocking.

The UI now exposes the saved selection checks for the current stopped selection. A selection rejection has an explicit pause reason. Repeated generation, even with an explicit retry or a newer build, returns the same rejected attempt when the source hash is unchanged. It cannot replenish its repair allowance.

Validation: 442 Python tests passed; 465 Node contract tests passed and one was skipped; TypeScript and production build passed. Added regressions cover absent/translated/foreign decision quotes, stopping before another generation on an invalid diagnosis, real terminal findings, and preservation of a rejected attempt on repeated start.

These checks verify local contracts. They do not establish that the revised model instructions produce a complete approved pair autonomously. No additional provider calls, historical verdict edits, source changes or budget extensions were made after the failed acceptance attempt. Detailed evidence remains private and outside Git. Publication/deployment verification is recorded separately after it occurs.
