# Compact field-bound execution proofs — v1.0.46

The exact-document judge previously had to return complete output passages for every obligation. Shared schema definitions reduced input duplication but did not reduce response duplication. Large portfolios could exhaust the response allowance while repeating the same paragraphs across otherwise complete checks. A normal recovery repeated the same oversized contract.

The editor now receives a passage catalog and returns short field-bound IDs. IDs incorporate the output field and exact normalized passage. The engine restores each complete literal passage before the existing source binding, execution, independent acceptance, confidentiality and release gates. Foreign, unknown or stale references fail closed. All obligations and met/failed judgments remain mandatory. The model still reads complete passages; this is transport compaction, not evidence summarization or acceptance by lookup.

Source quotations remain literal and limited to 360 characters; explanations to 400 characters. Confirmed-head quotations retain their exact input constraint. Legacy literal-proof decoding remains supported. No model, token cap, retry allowance, budget, selection or generated prose changes. Publishing does not reopen exhausted jobs.

Validation: five new tests cover lossless Python/JSON roundtrip, own-field/stale reference rejection, retained source and failed-status gates, mandatory/bounded diagnostics and the actual editor path. Full Python suite: 640 passed. A private read-only replay of existing complete proof sections reduced response characters by about two thirds and restored every original proof exactly. This is not a completed provider verdict, a final Word approval, or a fresh autonomous user test.

OpenAI documentation: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) explains that output limits can leave structured responses incomplete. No partial verdict is approved or repaired into an approval locally.
