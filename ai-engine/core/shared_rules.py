"""Send each repeated review rule once per call (v1.0.107).

DeForest (Ángela, 19 Nov): the final judge received 191 obligations whose
instructions repeated the same long rules (one matter-evidence rule 20 times,
one decisive-fact rule 60 times): 274K characters, about 40% of its input. The
field reviewer receives the same obligations unit by unit. A sentence that
repeats inside one request is sent once in shared_rules and cited as [Rn];
the text of every rule is unchanged and every obligation keeps its own
specific sentences (names, quotations, decisions) in place.
"""
import copy
import re

SENTENCE = re.compile(r'(?<=[.!?])\s+')
USAGE = 'Obligation instructions cite shared rules as [Rn]; each [Rn] stands for the full text of shared_rules[Rn], in place.'


def share_repeated_rules(obligations, key='instruction', min_count=2, min_length=60):
    """Return (obligations, rules). Inputs are never mutated."""
    items = copy.deepcopy(list(obligations or []))
    import os
    if os.environ.get('RANKPILOT_SHARED_RULES', 'on').strip().casefold() in ('off', '0', 'false'):
        return items, {}
    split = [[s for s in SENTENCE.split(str(o.get(key) or '')) if s.strip()] if isinstance(o, dict) else [] for o in items]
    counts = {}
    for sentences in split:
        for sentence in sentences:
            counts[sentence] = counts.get(sentence, 0) + 1
    ids = {}
    for sentences in split:
        for sentence in sentences:
            if counts[sentence] >= min_count and len(sentence) >= min_length and sentence not in ids:
                ids[sentence] = f'R{len(ids) + 1}'
    if not ids:
        return items, {}
    for item, sentences in zip(items, split):
        if isinstance(item, dict) and sentences:
            item[key] = ' '.join(f'[{ids[s]}]' if s in ids else s for s in sentences)
    return items, {rid: sentence for sentence, rid in ids.items()}


def expand(instruction, rules):
    """Inverse used by tests: the reader's view of one obligation."""
    return re.sub(r'\[(R\d+)\]', lambda m: rules.get(m.group(1), m.group(0)), str(instruction or ''))
