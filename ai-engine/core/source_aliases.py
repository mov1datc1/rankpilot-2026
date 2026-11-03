"""Bound same-party spelling assessments to a single original matter.

This authorizes an internal alias note, never a canonical identity rewrite or
approval. Different legal entities, roles and uncertain parties still need facts.
"""
import re
import unicodedata


def _words(value):
    text = unicodedata.normalize('NFKD', str(value or '')).casefold()
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return [w for w in re.findall(r'\w+', text) if w not in {'and', 'y'}]


def _distance(a, b):
    row = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        new = [i]
        for j, right in enumerate(b, 1):
            new.append(min(new[-1] + 1, row[j] + 1, row[j - 1] + (left != right)))
        row = new
    return row[-1]


def grounded_spelling_alias(defect, package):
    """Check the reviewer's semantic assessment; similarity alone is not proof."""
    if defect.get('alias_basis') != 'same_party_spelling':
        return False
    variants = defect.get('source_aliases') or []
    if len(variants) != 2 or len(set(variants)) != 2:
        return False
    matter = next((m for m in (package or {}).get('matters', [])
                   if m.get('id') == defect.get('matter_id')), None)
    if not matter:
        return False
    norm = lambda v: ' '.join(str(v or '').split()).casefold()
    client = norm(matter.get('client') or matter.get('clientName'))
    source = ' '.join(norm(matter.get(k)) for k in ('source_excerpt', 'rawNotes', 'summary'))
    # One exact field name plus a separately attested narrative spelling, in
    # this same source record. A quote from another matter cannot qualify.
    if client not in {norm(v) for v in variants}:
        return False
    other = next((norm(v) for v in variants if norm(v) != client), '')
    if not other or other not in source:
        return False
    left, right = (_words(v) for v in variants)
    if left == right:
        return True
    # Narrow corroboration of an orthographic variation, not a corporate-family
    # or geographic relationship. Never erase legal-entity or numeric qualifiers.
    legal = {'inc', 'incorporated', 'llc', 'ltd', 'limited', 'plc', 'corp',
             'corporation', 'sa', 'cv', 'srl', 'gmbh', 'ag', 'holdings'}
    if [w for w in left if w in legal] != [w for w in right if w in legal]:
        return False
    if len(left) != len(right) or len(left) < 3 or left[:2] != right[:2]:
        return False
    differences = [(a, b) for a, b in zip(left, right) if a != b]
    if len(differences) != 1:
        return False
    a, b = differences[0]
    return (min(len(a), len(b)) >= 7 and a[:6] == b[:6]
            and not any(c.isdigit() for c in a + b) and _distance(a, b) <= 3)
