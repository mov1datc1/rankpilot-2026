# Editorial capacity policy

Cumulative token ceilings are disabled by default. A legacy EDITORIAL_TOKEN_BUDGET environment value or earlier per-job capacity grant cannot restore the old ceiling. A future explicit budget policy requires EDITORIAL_ENFORCE_TOKEN_BUDGET=true and a positive integer EDITORIAL_TOKEN_BUDGET; an invalid opt-in configuration fails visibly.

The worker still records all provider usage. With no allowance header the authenticated engine creates an uncapped RequestBudget: it skips the unnecessary token-count preflight, records actual usage, and refuses another call after an unknown provider outcome or missing usage. Input headers from callers cannot inject an allowance through engineFetch. Finite optional allowances remain supported and tested.

This does not reset field methods, stage/cursor failure counts, source identity, final-review exceptions, or progress checks. A saved final review stopped only by budget can continue once under the uncapped policy with its existing field history; its ledger marker stores null for uncapped capacity rather than serializing Infinity ambiguously. Historic jobs are not bulk restarted by this release.

Validation covers crossing the former ceiling, preserved spend, shared bounded recovery, unknown outcomes in synchronous and asynchronous calls, authenticated HTTP propagation, and a one-time saved-review continuation. These are operational checks, not a claim of editorial acceptance or improved document quality.
