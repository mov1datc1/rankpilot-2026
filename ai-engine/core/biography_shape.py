"""Shape of a nominated B9, checked in code before review.

Ángela's method for a nominated biography: an opening that positions the lawyer,
two to four legal themes opened by their strongest mandate, credentials once and
a factual close. A biography written as one paragraph per matter ("Ramos led …",
"Ramos also leads …", "Finally, Ramos leads …") or with artificial passives
("A challenge … is led by Ramos") is located deterministically. The finding is
returned as an exact expectation for the single construction self-correction;
the caller keeps whichever version has fewer shape faults, so a worse correction
never replaces a better first draft and the case never stops on style.
"""
import re

VERSION = 'biography-shape-v1'
MAX_PARAGRAPHS = 8
MIN_WORDS = 250
LEAD_VERB = r'(?:co-?)?(?:led|leads|represented|represents|advised|advises|acted|acts|handled|handles|defended|defends)'
LIST_MARKER = re.compile(r'^(?:Finally|Lastly|Additionally|In addition|Furthermore|Moreover)\b', re.I)


def paragraphs(text):
    return [p.strip() for p in re.split(r'\n\s*\n|\n', str(text or '')) if p.strip()]


def first_sentence(paragraph):
    match = re.match(r'(.+?[.!?])(?:\s|$)', paragraph, re.S)
    return match.group(1) if match else paragraph


def _person(name):
    parts = [p for p in str(name or '').split() if len(p) > 2]
    names = {parts[0], parts[-1]} if parts else set()
    if len(parts) >= 3:
        names.add(parts[-2])
    return names | {'He', 'She'}


def _passive(name):
    people = '|'.join(re.escape(p) for p in sorted(_person(name)))
    return re.compile(
        r'\b(?:is|was|are|were)\s+(?:also\s+)?(?:led|co-led|handled|conducted|managed|directed)\s+by\s+(?:' + people + r')\b'
        r'|;\s*(?:' + people + r')\s+(?:also\s+)?(?:co-)?leads?\s+the\s+(?:matter|work)\b'
        r'|\b(?:is|are)\s+sought\s+in\b')


def lead_openings(text, name):
    """Body paragraphs whose opening sentence presents one more mandate led by the person."""
    people = '|'.join(re.escape(p) for p in sorted(_person(name)))
    pattern = re.compile(r'\b(?:' + people + r')\s+(?:also\s+|likewise\s+|further\s+)?' + LEAD_VERB + r'\b')
    hits = []
    for i, paragraph in enumerate(paragraphs(text)[1:], start=1):
        opening = first_sentence(paragraph)
        if pattern.search(' '.join(opening.split()[:14])) or LIST_MARKER.match(paragraph):
            hits.append(i)
    return hits


def _content_words(sentence):
    return {w for w in re.findall(r"[\w’']{4,}", sentence.casefold())}


def repeated_sentences(bio, threshold=0.65):
    """Pairs of substantial sentences (10+ words) whose content words largely coincide."""
    sentences = [s for s in re.split(r'(?<=[.!?])\s+', ' '.join(str(bio or '').split())) if len(s.split()) >= 10]
    pairs = []
    for i, a in enumerate(sentences):
        wa = _content_words(a)
        for b in sentences[i + 1:]:
            wb = _content_words(b)
            shared = wa & wb
            if len(shared) >= 6 and len(shared) / min(len(wa), len(wb)) >= threshold:
                pairs.append((a, b))
    return pairs


def faults(candidate):
    """Exact expectations for a substantial B9 (nominated or to develop) that reads as a matter list."""
    if candidate.get('recommendation') not in ('present', 'develop'):
        return []
    from core.prose_rules import natural_lead
    bio = natural_lead(str(candidate.get('submission_bio') or ''))
    if len(bio.split()) < MIN_WORDS:
        return []
    name = candidate.get('name', '')
    paras = paragraphs(bio)
    found = []
    leads = lead_openings(bio, name)
    if len(leads) >= 4 or len(paras) > MAX_PARAGRAPHS:
        sample = '; '.join('"' + ' '.join(first_sentence(paras[i]).split()[:9]) + ' …"' for i in leads[:4])
        found.append(
            f'B9 SHAPE: {name} has {len(paras)} paragraphs and {len(leads)} open with another mandate the lawyer led'
            + (f' ({sample})' if sample else '') + '. Rewrite as the ARCHITECTURE OF A NOMINATED B9: an opening that '
            'positions the lawyer in this practice; the same mandates grouped into two to four legal themes, each opened by '
            'its most significant mandate (client problem, legal obstacle, own action, achieved result or exact current '
            f'stage) with related mandates following briefly; credentials once; one factual close. At most {MAX_PARAGRAPHS} '
            'paragraphs, no "Finally,"/"Additionally," list markers. Keep every fact, number, status and mandate.')
    repeats = repeated_sentences(bio)
    if repeats:
        found.append('B9 REPETITION: the same content is stated twice: ' + '; '.join(
            '"' + ' '.join(a.split()[:12]) + ' …" / "' + ' '.join(b.split()[:12]) + ' …"' for a, b in repeats[:2])
            + '. Keep it once, where it explains the expertise.')
    from core.prose_rules import HEAD_FUNCTION
    heads = [s for s in re.split(r'(?<=[.!?])\s+', ' '.join(bio.split()))
             if any(re.search(r'\b(?:department|practice)\b', m.group(0), re.I) for m in HEAD_FUNCTION.finditer(s))]
    if len(heads) >= 2:
        found.append('B9 HEADSHIP: the department headship is stated ' + str(len(heads)) + ' times; state it once, in the '
                     'opening, and use the other sentences for the work itself.')
    passive = _passive(name)
    awkward = [s for s in re.split(r'(?<=[.!?])\s+', ' '.join(bio.split())) if passive.search(s)]
    if awkward:
        found.append('B9 VOICE: rewrite in the active voice with the lawyer or the client problem as the subject: '
                     + '; '.join('"' + ' '.join(s.split()[:14]) + ' …"' for s in awkward[:3]) + '.')
    return found
