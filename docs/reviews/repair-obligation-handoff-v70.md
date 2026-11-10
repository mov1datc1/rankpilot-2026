# Preserve the reviewer's instructions through repair

Two defects caused corrections to lose meaning between review, repair and recheck:

1. Finding deduplication used the quoted output passage as its identity. Several missing facts in the same paragraph therefore collapsed into the last instruction. Deduplication now includes the source passage, obligation identifier, owner and normalized instruction. Only identical instructions collapse; their strongest severity remains.
2. A repaired proposal could retain a global validation failure from an unrelated, already recorded internal binding. That global flag sent corrected fields into another repair and eventually attached an old finding to the new output. Changed, structurally complete, privacy-safe output now returns to independent field review when remaining local faults are already recorded observations. New local faults retain the normal bounded correction path.

Neither change approves generated text, edits sources, changes publication permissions or refreshes repair allowances. A second correction still receives independent review; a fresh failure becomes an observation without buying a third correction. Unknown provider outcomes and incomplete proposals cannot enter this recheck route.

Validation: offline regression coverage includes several omissions in one paragraph, legacy findings without obligation identifiers, exact-duplicate severity, preservation of every instruction in the repair target, first/second-method rechecks alongside an unrelated retained fault, a fresh second-method rejection without a third repair, and rejection of unknown, incomplete or newly invalid output. The Python suite passes 789 tests. Private saved-state replays also confirm all three original instructions survive and a changed field routes to review without changing its prose or counters; those files are not published.

These checks establish contract behavior, not model quality or successful autonomous generation. Existing Word files are not rewritten by deployment. A live targeted check and comparison of resulting documents remain separate validation steps.
