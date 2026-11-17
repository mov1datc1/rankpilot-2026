"""B9 style rules enforced in code, not left to a prompt.

1. Repeated paragraph openings ("X is named lead partner…" in paragraph after
   paragraph) are located deterministically. Only the opening sentences of the
   flagged paragraphs are sent for rewriting, with the exact rule; each
   replacement is accepted only if it keeps every number and capitalised name,
   no longer repeats the opening and keeps the biography's evidence bindings
   literal. Anything that fails keeps the original sentence: never a stop.
2. A confirmed roster title (e.g. Partner) missing from the biography is placed
   in the first sentence ("Name, a Partner, …"), not appended as a loose line.
"""
import copy
import re
from pydantic import ConfigDict, Field, create_model

ROLE_PHRASE = re.compile(r'\b(?:is|was|are)?\s*(?:also\s+|further\s+)?(?:named|recorded|listed|identified)\s+(?:as\s+)?(?:the\s+)?(?:co-?)?lead(?:-|\s)(?:partner|lawyer)s?\b', re.I)
TASK = '''Rewrite ONLY each supplied opening sentence of a B9 biography paragraph.
Rule: consecutive paragraphs must not open the same way. Start each sentence
with the client's legal problem, the work done or the result, not with the
person's name and not with "named/recorded as lead partner". Mention the
person's role at most once, naturally, later in the sentence if needed. Keep
every fact, number, amount, entity, status (ongoing/completed) and attribution
exactly; add nothing. Same language and register as the original. Return one
rewritten sentence per key.'''


def paragraphs(text):
    return [p for p in re.split(r'\n\s*\n|\n', str(text or '')) if p.strip()]


def first_sentence(paragraph):
    match = re.match(r'(.+?[.!?])(?:\s|$)', paragraph.strip(), re.S)
    return (match.group(1) if match else paragraph.strip())


def _opening(paragraph, words=10):
    return ' '.join(paragraph.strip().split()[:words])


def repeated_openings(text, name=''):
    """Indexes of paragraphs whose opening repeats an earlier paragraph's pattern."""
    paras = paragraphs(text)
    first = (name or '').split()[0].casefold() if name else ''
    role_hits = [i for i, p in enumerate(paras) if ROLE_PHRASE.search(_opening(p))]
    subject = {}
    for i, p in enumerate(paras):
        words = re.findall(r"[\w’']+", p.casefold())[:2]
        if len(words) == 2:
            key = 'person' if words[0] in (first, 'he', 'she') and words[1] in ('is', 'was', 'also', 'has') else ' '.join(words)
            subject.setdefault(key, []).append(i)
    flagged = set(role_hits[1:]) if len(role_hits) >= 3 else set()
    for key, hits in subject.items():
        if len(hits) >= 3:
            flagged |= set(hits[1:])
    flagged.discard(0)  # The opening paragraph introduces the person.
    return sorted(flagged)


def _numbers(text):
    return set(re.findall(r'\d[\d.,]*', text))


def _names(text):
    return {w for w in re.findall(r"\b[A-ZÁÉÍÓÚÑ][\w’'-]{2,}", text)} - {'The', 'In', 'For', 'On', 'At', 'A', 'An', 'He', 'She', 'His', 'Her'}


def acceptable(old, new, name):
    new = new.strip()
    if not new or len(new) < 0.6 * len(old) or not re.search(r'[.!?]$', new):
        return False
    if not _numbers(old) <= _numbers(new):
        return False
    person = set((name or '').split())
    if not (_names(old) - person) <= _names(new):
        return False
    if ROLE_PHRASE.search(_opening(new)):
        return False
    first = (name or '').split()[0] if name else ''
    return not (first and new.split()[0].strip(',') in (first, 'He', 'She'))


def _replace_everywhere(candidate, old, new):
    result = copy.deepcopy(candidate)
    result['submission_bio'] = result['submission_bio'].replace(old, new, 1)
    for key in ('profile_coverage', 'submission_case_coverage'):
        for item in result.get(key) or []:
            quote = item.get('public_quote')
            if not isinstance(quote, str) or not quote.strip():
                continue
            if old in quote:
                item['public_quote'] = quote.replace(old, new)
            elif ' '.join(quote.split()) in ' '.join(old.split()):
                # The binding cited part of the rewritten sentence; the new
                # sentence carries the same facts (numbers and names checked).
                item['public_quote'] = new
    return result


def bindings_literal(candidate):
    bio = ' '.join(str(candidate.get('submission_bio') or '').split())
    return all(' '.join(item['public_quote'].split()) in bio
               for key in ('profile_coverage', 'submission_case_coverage') for item in candidate.get(key) or []
               if isinstance(item.get('public_quote'), str) and item['public_quote'].strip())


def vary_openings(state, invoke, candidate, trace):
    """Return (candidate, trace, report). At most one small paid call."""
    flagged = repeated_openings(candidate.get('submission_bio', ''), candidate.get('name', ''))
    if not flagged:
        return candidate, trace, None
    paras = paragraphs(candidate['submission_bio'])
    sentences = {f'S{n+1:02d}': first_sentence(paras[i]) for n, i in enumerate(flagged)}
    schema = create_model('OpeningRewrites', __config__=ConfigDict(extra='forbid'),
                          **{key: (str, Field(min_length=1, max_length=900)) for key in sentences})
    try:
        value, trace = invoke({**state, 'trace': trace}, 'repair', schema, TASK,
                              {'person': candidate.get('name'), 'opening_sentences': sentences,
                               'other_paragraph_openings': [_opening(p, 6) for j, p in enumerate(paras) if j not in flagged]})
    except Exception as error:  # A failed polish never stops construction.
        history = getattr(error, 'trace_history', None)
        return candidate, list(history) if history else trace, {'flagged': len(flagged), 'applied': 0, 'error': str(error)[:200]}
    result, applied = candidate, 0
    for key, old in sentences.items():
        new = str(value.get(key) or '').strip()
        if not acceptable(old, new, candidate.get('name', '')):
            continue
        updated = _replace_everywhere(result, old, new)
        if bindings_literal(updated):
            result, applied = updated, applied + 1
    return result, trace, {'flagged': len(flagged), 'applied': applied}


def place_title(candidate, package):
    """Put a confirmed roster title in the first sentence when it is missing."""
    from core.role_evidence import identity
    name = candidate.get('name', '')
    person = next((p for p in package.get('lawyers', []) if identity(p.get('name') or p.get('fullName')) == identity(name)), {})
    role = str(person.get('role') or '').strip()
    bio = str(candidate.get('submission_bio') or '')
    if role.casefold() not in ('partner', 'socio', 'socia') or re.search(r'\bpartner\b|\bsoci[oa]\b', bio, re.I):
        return candidate, False
    if not bio.startswith(name + ' ') or not re.match(r'[a-z]', bio[len(name) + 1:]):
        return candidate, False
    updated = _replace_everywhere(candidate, name + ' ', name + ', a ' + role.capitalize() + ', ')
    return (updated, True) if bindings_literal(updated) else (candidate, False)
