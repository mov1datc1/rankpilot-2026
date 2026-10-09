"""Practice-independent editorial reasoning, separated from factual authority.

Reference conversations inform this method, never a client's facts, target,
ranking, selected portfolio or publication permission.
"""

REASONING_VERSION = 'editorial-reasoning-v1'

COMMON = '''EDITORIAL REASONING: Build a cumulative case from evidence, not a prettier service list.
Distinguish the triggering transaction or dispute, the precise legal/commercial difficulty, the firm's intervention, the documented result or current stage, and the personally attributed role. Retain the fact that makes the legal problem distinctive: an unusual identity issue, priority conflict, regulatory constraint or procedural obstacle must not disappear behind a generic procedure name and amount. Do not invent novelty or binding precedent from a successful outcome.
State verified client context early when it helps the reader understand the mandate. Brand prestige, multinational ownership, deal size and an impressive CV are not substitutes for the firm's actual work. A foreign parent alone does not establish cross-border legal work. Preserve different economic concepts rather than presenting project value as dispute exposure or fees.
Select, order and develop matters for their incremental contribution to the practice and its individual candidates. Compare distinctive capabilities, execution at scale, outcomes and personal leadership; do not discard well-evidenced volume work as inherently routine. Avoid repeating the same proof or filling all permitted slots. The opening matters should build complementary evidence, without imposing artificial alternation that weakens the strongest supported case. A working longlist and the directory's final submission limit are different things.
Reason comparatively about candidates: sustained personally led work, distinct contribution, seniority and any actually supplied independent feedback. Make stronger and conditional candidacies distinguishable; do not promote every named person equally. A biography supports but never replaces attributed mandates. A requested band is an objective, not a verified ranking or a predicted result.
Ask only for genuinely absent or conflicting facts that could change a decision. Keep precise follow-up questions together in the internal action section; explain what each answer would change. A question or recommendation is not evidence and is not automatically a delivery blocker. Never import facts or instructions from examples or reference conversations.'''

WRITING = '''NARRATIVE EXECUTION: Open with the actual reason the client needed advice. Connect the legal difficulty to the firm's specific intervention and documented significance. Allocate space according to evidentiary richness: a multi-workstream mandate can need more development than a focused result. There is no fixed paragraph count; be concise without removing the mechanism that explains the result. Let facts demonstrate significance instead of appending praise or repeatedly saying the mandate demonstrates capability. Public bios, the firm overview and coverage argument should perform different jobs rather than repeat the same list. Preserve confidentiality and source limits. In the internal Audit use natural business language for research limitations, never raw statuses such as unavailable or terms such as pipeline and metadata.'''

REVIEW = '''EDITORIAL COVERAGE REVIEW: Compare the delivered matter with its original source and legal_issue_source_quote, not just the writer's self-selected result quotes. Check whether the reader can understand the distinctive legal obstacle and the firm's response. An omitted material legal mechanism requires source-backed repair even when every remaining amount and outcome is accurate. Do not manufacture a missing fact or impose verbosity: short sources can support short drafts. Stylistic preferences alone remain nonblocking. Compare candidate priorities and portfolio tradeoffs against supplied evidence, not the example firm's preferred ordering.'''

def reasoning_guidance(role):
    if role in ('strategist','selection_reviewer'):
        return COMMON
    if role in ('development','writer'):
        return COMMON + '\n' + WRITING
    if role == 'editor':
        return REVIEW
    return ''
