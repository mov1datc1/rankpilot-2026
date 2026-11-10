# Repair after documents become available

A final reviewer can find a correctable problem in prose already available for download. Scheduling development repair previously cleared only development_validated. The separate development_delivery_ready flag stayed true, so checkpoint restoration treated the stage as reusable and skipped the requested repair. Field methods were allocated and subsequent reviews ran against unchanged prose.

The worker now clears both completion flags for the specific scheduled stage. It preserves the development dependency key, source snapshot, original proposal, current feedback, field history and accumulated usage, so the engine enters targeted repair rather than full regeneration. The corresponding writer availability flag is also cleared when Audit repair is scheduled. Existing downloadable artifacts remain available while the correction runs.

A worker regression reproduces available first-pass documents followed by two distinct bounded repair methods. It asserts one selection, three actual development calls with usage receipts, independent final review and unchanged job identity. This proves execution routing; it does not certify the quality of any model-generated correction. Historical consumed methods and existing documents are not rewritten or automatically replayed by this release.
