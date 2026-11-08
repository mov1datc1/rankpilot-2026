# Decreasing unresolved selection batches — v1.0.47

The selection loop allowed new failures or a strict subset of prior rejected matter IDs. A correction could resolve several findings and expose a new omission elsewhere: four rejected matters becoming two, with one overlapping ID, was incorrectly stopped even though one repair and one review remained under the normal limits.

The loop now recognizes a strictly smaller unresolved matter count as progress, including a mixture of remaining and newly diagnosed matters. Equal or growing overlapping batches still stop. Existing limits of two repairs and three paid selection reviews, source binding and unknown-usage guards are unchanged. The structural repair still requires an explicit, bound disposition constraint; prose-only repairs cannot change selection.

A single explicit continuation is available for an old selection stopped under exactly these conditions after a code fix: two reviews, one repair, smaller bound residual batch, unchanged sources, known usage and remaining normal budget. It preserves the job ID, cursor, checkpoint, ledger and counters. A ledger marker prevents repeated continuation; publication never triggers it automatically. Exhausted or ungrounded cases remain stopped.

Validation includes the actual graph reaching its third review and second repair for a shrinking mixed batch, conservative repeated-batch/cap tests, and an enqueue integration test proving the same job is resumed only once without state resets. Native semantic correction and final Word quality require a separate observed execution; tests are not acceptance.
