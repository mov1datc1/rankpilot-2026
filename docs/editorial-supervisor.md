# Automatic editorial recovery

The existing `rankpilot-editorial-worker` runs the supervisor after the final
artifact review. No additional service, scheduler, or model training is required.
The source-bound AI repairer and independent reviewer remain the semantic agents;
the supervisor chooses their next operation and enforces deterministic limits.

| Diagnosis | Action |
| --- | --- |
| Independently approved artifact and release | Complete the job |
| Critical source question owned by the user | Preserve the draft and request input |
| Invalid global reviewer diagnostic without a concrete failure | Reassess the same artifacts, with bounded backoff |
| Concrete supported generated-text defect | Run only the affected repair stages and then the independent review |
| Same disputed claim survives a repair | Pause; unrelated changes do not authorize another correction |
| Budget or progress limit reached | Pause with the draft preserved |
| Service authentication failure | Pause without caching an editorial verdict or retrying generation |

Each artifact ledger entry stores the decision, reason and finding fingerprints.
Fingerprints bind the issue to its scope, field, matter and literal source/artifact
quotes. They omit changing diagnostic explanations and global acceptance summaries.
Sources and full evidence stay in the existing versioned checkpoint.

Existing job ownership, source hashes, optimistic writes, worker leases, unknown
provider-outcome quarantine and cumulative token limits still apply. A new
deployment does not erase the job ledger. Only the independent release gate can
enable downloads; a recovery decision cannot grant approval.

This is bounded recovery, not a guarantee that arbitrary source gaps or unknown
software faults can be repaired autonomously. It does not rewrite production code,
change source facts, infer missing permissions, or silently increase token budgets.
The invariant tests use fictional records and injected failures, not firm-specific
exceptions. Full production behavior must also be checked with real intake cases.

Selection has its own bounded source-to-decision recovery before development:
at most three independent checks, with repairs restricted to the rejected
decisions. A repeated failed matter, ungrounded diagnosis, unavailable reviewer,
or exhausted allowance stops the loop. Checkpoints preserve attempt counts and
failure history across requests; deployment does not renew that allowance.
All source matters remain available to each independent check, including reserves
and exclusions. Long verbatim copies inside extraction provenance use reversible
offsets into the same record's complete source excerpt. Different source versions
and confirmed factual corrections are retained literally.
