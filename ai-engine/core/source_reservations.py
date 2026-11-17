"""A material reservation in the source travels with every claim that uses it.

Ramos v1.0.95: IDEX's source says the firm "was able to establish a very
important legal precedent, even though the Supreme Court of Justice of Mexico
ruled against it". The Audit kept that reservation; the B9 presented the
criteria without it and the final judge rejected the pair. The application
knows both facts, so the check runs at construction: a text that cites the
matter's criteria/precedent without the reservation receives the single
self-correction with the exact source sentence. Nothing is rewritten here.
"""
import re

VERSION = 'source-reservations-v1'
ADVERSE = re.compile(r'\b(?:ruled|resolved|decided|held|found)\s+against\b|\b(?:reversed|overturned|overruled|revoked|vacated)\b'
                     r'|\ben\s+contra\b|\brevoc[óo]\b|\bcontradicci[óo]n\s+de\s+criterios\b', re.I)
CONCESSIVE = re.compile(r'\b(?:even\s+though|although|though|however|but|nevertheless|aunque|sin\s+embargo|no\s+obstante|pese\s+a)\b', re.I)
CLAIM = re.compile(r'\b(?:criteri(?:a|on|os?)|precedent(?:e|s)?|legal\s+standard|jurisprudenc\w*|landmark)\b', re.I)
CARRIES = re.compile(r'\b(?:Supreme\s+Court|Suprema\s+Corte|SCJN|ruled\s+against|resolved\s+against|reversed|overturned|en\s+contra'
                     r'|subsequently|later\s+(?:ruled|decided|resolved)|notwithstanding|although|even\s+though|however|aunque)\b', re.I)


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', str(text or '')) if s.strip()]


def reservations(matter):
    """Source sentences recording a later adverse decision on the matter's precedent or result."""
    text = ' '.join(str(matter.get(k) or '') for k in ('source_excerpt', 'rawNotes', 'summary', 'otherInfo', 'outcome'))
    found = []
    for sentence in _sentences(text):
        if ADVERSE.search(sentence) and (CONCESSIVE.search(sentence) or CLAIM.search(sentence)) and sentence not in found:
            found.append(sentence)
    return found


def missing(matter, text):
    """The reservation sentence when `text` cites the criteria/precedent without carrying it."""
    notes = reservations(matter)
    if not notes or not CLAIM.search(str(text or '')) or CARRIES.search(str(text or '')):
        return None
    return notes[0]


def _label(matter):
    return str(matter.get('client') or matter.get('name') or matter.get('id'))


def matter_faults(package, narratives):
    register = {m.get('id'): m for m in package.get('matters', [])}
    faults = []
    for item in narratives:
        matter = register.get(item.get('matter_id'))
        note = matter and missing(matter, f"{item.get('text', '')} {item.get('completion_status', '')}")
        if note:
            faults.append(f'{_label(matter)}: the narrative cites the criteria/precedent without the source reservation "{note}". '
                          'State that reservation next to the claim, or describe the achieved result without presenting the criteria as settled.')
    return faults


def bio_faults(package, candidate):
    """The B9 paragraph that develops a matter must carry that matter's reservation."""
    register = {m.get('id'): m for m in package.get('matters', [])}
    paragraphs = [p for p in re.split(r'\n\s*\n|\n', str(candidate.get('submission_bio') or '')) if p.strip()]
    norm = lambda s: ' '.join(str(s or '').split())
    faults = []
    for item in candidate.get('submission_case_coverage') or []:
        matter = register.get(item.get('matter_id'))
        quote = norm(item.get('public_quote'))
        if not matter or not quote:
            continue
        paragraph = next((p for p in paragraphs if quote in norm(p)), quote)
        note = missing(matter, paragraph)
        if note:
            faults.append(f'B9 SOURCE RESERVATION: {_label(matter)}: the paragraph cites the criteria/precedent without the source '
                          f'reservation "{note}". Keep the achieved result and add that reservation next to the claim, or omit the criteria.')
    return faults
