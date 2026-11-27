"""One editorial specification for every role (v1.0.127).

The editorial owner's reviews of Labour, Tax and Public Law (24-27 Nov) kept
finding new gaps because each review was answered with a rule for one role. This
module states the method once; writers, field reviewers, repair, the Audit and the
judge read the same text, and the deterministic checks below apply it in code
where a known answer exists.
"""
import re

from core.role_evidence import identity

VERSION = 'editorial-strategy-v1'

SECTION_ROLES = '''ONE STRATEGY, FOUR SECTIONS WITH DIFFERENT FUNCTIONS:
- B9 answers who deserves recognition and why. It is an individual argument for that
  lawyer: their role in the practice, their judgement, autonomy and client trust, and
  the legal sophistication of what they personally do. Mandates are its proof, each in
  a clause with this lawyer's own contribution and its result; a matter is never
  re-told in B9, because section D/E tells it.
- B10 answers what distinguishes this practice in its market: a thesis about what it
  does that other firms do not, carried by its team, with mandates as evidence of that
  thesis, never a list of mandates.
- C2 answers what the directory should reconsider in its coverage and why. It starts
  from the current coverage (the practice's present position or its absence, and the
  firm's own reading of the market in c2_source), states precisely which aspect
  deserves reconsideration (the practice's position, a named lawyer, a type of work the
  coverage does not reflect) and gives the evidence that justifies it. It neither
  presents the practice again nor begs, and it cites a mandate only for the point it
  proves.
- Work highlights (D/E) carry the full evidence for all three.
No section repeats another section's function or sentences.'''

ORIGINAL_STRATEGY = '''THE ORIGINAL STRATEGY: b10_source and c2_source are the firm's own
strategy. Before writing, identify their central thesis: the value proposition and the
positioning argument. When that thesis is specific and well argued it is better than
one you would invent: keep it as the thesis of the section, keep its distinctive
formulations, and add only what strengthens it (the evidence of the mandates, the team
that delivers it). Replace or reframe an original argument only when it is generic,
unsupported or contradicted by the evidence.'''

CANDIDACY = '''CANDIDACY: a ranking the firm declares for its lawyer is a fact of the case;
official verification only confirms it, and its absence never makes that lawyer
unranked. A lawyer the firm declares ranked is never proposed for an entry band or the
lowest band: the proposal keeps or improves the declared position. Each lawyer is in
one of four states: present (the evidence supports the candidacy now);
under_documented (the candidacy may be viable but the record lacks specific
information: name exactly what to obtain, such as the lawyer's own role, technical
autonomy, client contact or responsibilities on named mandates); development_potential
(the lawyer is building a profile that can carry a candidacy in a later cycle: state
what would develop it); inviable (the lawyer practises in another area or the evidence
contradicts a candidacy). Thin evidence alone never makes a candidacy inviable.'''

MATTER_SIGNIFICANCE = '''MATTER SIGNIFICANCE: judge each matter on five separate dimensions and
never let one stand for another: (1) the client's prominence, (2) the complexity of the
jurisdictional environment, (3) the legal sophistication of the mandate, (4) its
relevance to the practice being assessed, (5) the effective contribution of the firm
and its lawyers. An important client does not make an important matter, and a difficult
jurisdiction does not make a routine filing, registration or permit sophisticated work.'''

MATTER_OPENING = '''A matter narrative opens with the legal problem the mandate addressed,
what made it complex or important, and the firm's contribution. A favourable decisive
result may share the opening sentence with the problem it solved; an adverse,
procedural or jurisdictional outcome is never the opening: state it after the work,
with full transparency and in context.'''

MATERIAL_CONFLICTS = '''MATERIAL CONFLICTS: when the sources give two incompatible versions of a
material fact of a matter (fact_sheet contested_facts: its forum, legal basis, outcome,
date or a role), the Submission states neither version: it describes the uncontested
work, and the Audit names the conflict as pending confirmation by the firm. Never
reconcile incompatible facts by inference, and never characterise the contested fact with
a word of either version (for an arbitral forum: "an international arbitration", never a
treaty, investment or institutional arbitration, nor its seat).'''

SPEC = '\n'.join((SECTION_ROLES, ORIGINAL_STRATEGY, CANDIDACY, MATTER_SIGNIFICANCE, MATTER_OPENING, MATERIAL_CONFLICTS))

REVIEW = ('EDITORIAL METHOD (shared by every writer; judge the output against it, and never '
          'demand what it forbids, such as re-telling a matter inside B9 or a list of mandates in B10):\n' + SPEC)


# ---- Candidacy: the firm's declaration is a fact of the case -----------------

STATES = ('present', 'under_documented', 'development_potential', 'inviable')
RECOMMENDATION = {'present': 'present', 'under_documented': 'develop', 'development_potential': 'develop',
                  'inviable': 'do_not_present'}
FROM_RECOMMENDATION = {'present': 'present', 'develop': 'development_potential', 'do_not_present': 'inviable'}
BAND = re.compile(r'\bBand\s*(\d)\b', re.I)
NOT_RANKED = re.compile(r'\b(?:not\s+ranked|unranked|no\s+rankead\w*|sin\s+ranking)\b', re.I)
RANKED = re.compile(r'\b(?:ranked|rankead\w*|band\s*\d|senior\s+statesp\w*|eminent\s+practitioner|up\s+and\s+coming)\b', re.I)
PENDING = re.compile(r'\bcategory\s+pending\b|\bcategor[ií]a\s+pendiente\b', re.I)
ENTRY = re.compile(r'\bentry[- ]band\b|\blowest\s+band\b|\blower[- ]band\b', re.I)


def declared_position(package, name):
    """('ranked', 'Band 2' or None), ('not_ranked', None) or None, from the firm's own lawyer record."""
    key = identity(name)
    for lawyer in (package or {}).get('lawyers') or []:
        if identity(lawyer.get('name') or lawyer.get('fullName')) != key:
            continue
        text = ' '.join(str(lawyer.get(k) or '') for k in ('current_ranking', 'currentRank'))
        if NOT_RANKED.search(text) or lawyer.get('is_ranked') is False and not RANKED.search(text):
            return ('not_ranked', None)
        band = BAND.search(text)
        if band or lawyer.get('is_ranked') is True or RANKED.search(text):
            return ('ranked', f'Band {band.group(1)}' if band else None)
        return None
    return None


def apply_candidacy(plan, package):
    """Known answers about each lawyer's candidacy, applied before any prose.

    The state and the recommendation say the same thing; a lawyer the firm declares
    ranked keeps or improves that position instead of an entry band."""
    for c in plan.get('candidates', []):
        label = ' '.join(str(c.get('suggested_ranking') or '').split())
        if PENDING.search(label) and label.casefold() != 'category pending':
            # "Category pending (keep the declared position…)": the category is the
            # form's label; the explanation belongs in the criterion (Public Law probe).
            note = PENDING.sub('', label).strip(' ()-:;,.')
            c['suggested_ranking'] = 'Category pending'
            if not str(c.get('category_missing_criterion') or '').strip() and note:
                c['category_missing_criterion'] = note
        state = c.get('candidacy_state')
        if state in STATES:
            c['recommendation'] = RECOMMENDATION[state]
        else:
            c['candidacy_state'] = FROM_RECOMMENDATION.get(c.get('recommendation'), 'development_potential')
        declared = declared_position(package, c.get('name'))
        if not declared or declared[0] != 'ranked':
            continue
        label = str(c.get('suggested_ranking') or '')
        proposed = BAND.search(label)
        held = BAND.search(declared[1] or '')
        lower = bool(proposed and held and int(proposed.group(1)) > int(held.group(1)))
        if not (ENTRY.search(label) or lower):
            continue
        if declared[1]:
            c['suggested_ranking'] = declared[1]
            c['category_rationale'] = (f'The firm declares {c.get("name")} ranked in {declared[1]}; the proposal keeps that '
                                       'position, and the evidence argues for it. ' + str(c.get('category_rationale') or '')).strip()
        else:
            c['suggested_ranking'] = 'Category pending'
            c['category_missing_criterion'] = ('La firma declara que ya está rankeado, sin indicar su categoría actual: '
                                               'confirmar la banda vigente para decidir si se propone mantenerla o mejorarla.')
            c['recommended_action'] = ('Confirmar con la firma la banda actual de ' + str(c.get('name')) +
                                       ' y, con ella, fijar el objetivo de mantenerla o mejorarla; nunca una banda de entrada.')
            c['category_rationale'] = ('Category pending. The firm declares this lawyer already ranked without stating the '
                                       'current category; an entry band would ignore that declaration.')
            if c.get('category_assessment'):
                c['category_assessment'] = {**c['category_assessment'], 'decision': 'pending', 'criterion': 'pending'}
    return plan


STATE_LABEL = {'present': 'proponer candidatura', 'under_documented': 'candidatura insuficientemente documentada',
               'development_potential': 'candidatura con potencial de desarrollo', 'inviable': 'candidatura inviable'}


# ---- Contested facts never reach the Submission ------------------------------

STOP = set('''a an the of in on at to for by with and or under before after from into its their this that these those
as is are was were be been being which who whom whose applicable filed filled matter mandate arbitration
proceedings proceeding case client firm law legal'''.split())


def _terms(text):
    return {w.casefold() for w in re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ][\w'’-]{2,}", str(text or ''))} - STOP


def _proper(text):
    return {w.casefold() for w in re.findall(r"\b(?:[A-Z]{2,}|[A-Z][a-záéíóúñ]+)\b", str(text or ''))} - STOP


WORDS = re.compile(r"[A-Za-zÁÉÍÓÚÑáéíóúñ][\w'’-]{2,}")
FUNCTION = STOP - {'arbitration', 'proceedings', 'proceeding'}


def _modifiers(text, own, shared):
    """Own terms of one version placed right before the disputed object both versions
    name ("investment arbitration" when the versions disagree on the arbitration)."""
    words = [w.casefold() for w in WORDS.findall(str(text or ''))]
    return {words[j] for i, w in enumerate(words) if w in shared for j in (i - 1, i - 2) if j >= 0 and words[j] in own}


def conflict_faults(package, matters):
    """A narrative that states either version of a contested fact (Public Law: the
    forum of an arbitration given both as a treaty arbitration and as an ICC one)."""
    register = {m['id']: m for m in (package or {}).get('matters', [])}
    faults = []
    for item in matters:
        source = register.get(item.get('matter_id'), {})
        label = source.get('client_name') or source.get('client') or item.get('matter_id')
        text = _terms(item.get('text'))
        for conflict in source.get('contested_facts') or []:
            a, b = conflict.get('quote_a', ''), conflict.get('quote_b', '')
            own_a, own_b = _terms(a) - _terms(b), _terms(b) - _terms(a)
            names_a, names_b = _proper(a) - _terms(b), _proper(b) - _terms(a)
            shared = ({w.casefold() for w in WORDS.findall(a)} & {w.casefold() for w in WORDS.findall(b)}) - FUNCTION
            used = sorted((own_a & text if len(own_a & text) >= 2 or names_a & text else set()) |
                          (own_b & text if len(own_b & text) >= 2 or names_b & text else set()) |
                          _modifiers(item.get('text'), own_a | own_b, shared))
            if used:
                faults.append(f'{label}: the narrative states a contested {conflict.get("subject") or "fact"} '
                              f'(“{a[:90]}” versus “{b[:90]}”; it uses: {", ".join(used[:5])}). State neither version: '
                              'describe the uncontested work; the Audit asks the firm to confirm it.')
    return faults


# ---- C2 reconsiders the coverage; it does not present the practice again ------

COVERAGE = re.compile(r'\b(?:coverage|ranking|ranked|rankings|band|tier|table|guide|directory|research(?:ers)?|recogni\w*|chambers|legal\s*500|reconsider\w*)\b', re.I)


def _sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', str(text or '').strip()) if len(s.split()) >= 6]


def section_faults(package, value):
    """C2 opens on the coverage, and does not restate B10 sentence by sentence."""
    c2, b10 = str((value or {}).get('c2') or ''), str((value or {}).get('b10') or '')
    if not c2.strip():
        return []
    faults = []
    first = [p for p in c2.split('\n') if p.strip()][0]
    if not COVERAGE.search(first):
        faults.append('C2 opens by presenting the practice ("' + first.strip()[:140] + '"). C2 answers what the directory '
                      'should reconsider in its coverage and why: open from the current coverage and the aspect that deserves '
                      'reconsideration, then give the evidence that justifies it.')
    b10_sentences = [_terms(s) for s in _sentences(b10)]
    repeated = []
    for sentence in _sentences(c2):
        terms = _terms(sentence)
        if len(terms) >= 6 and any(len(terms & other) / len(terms) >= 0.6 for other in b10_sentences):
            repeated.append(sentence)
    if len(repeated) >= 2:
        faults.append('C2 repeats B10 (for example "' + repeated[0][:140] + '"). Keep each mandate in C2 only for the point '
                      'it proves about the coverage; the presentation of the practice belongs to B10.')
    return faults


# ---- A matter does not open with a procedural outcome ------------------------

PROCEDURAL_OPENING = re.compile(r'\b(?:tribunal|court|chamber|panel|authority)\b[^.]{0,80}\b(?:determined|held|ruled|found|declared|decided|dismissed|declined|rejected)\b'
                                r'|\b(?:lacked|had\s+no|declined)\s+jurisdiction\b|\bno\s+jurisdiction\b', re.I)


def opening_faults(package, matters):
    register = {m['id']: m for m in (package or {}).get('matters', [])}
    faults = []
    for item in matters:
        text = str(item.get('text') or '').strip()
        first = re.split(r'(?<=[.!?])\s+', text)[0] if text else ''
        if first and PROCEDURAL_OPENING.search(first):
            source = register.get(item.get('matter_id'), {})
            label = source.get('client_name') or source.get('client') or item.get('matter_id')
            faults.append(f'{label}: the narrative opens with a procedural outcome ("{first[:140]}"). Open with the legal '
                          'problem, what made it complex and the firm\'s contribution; state the outcome after the work, in context.')
    return faults
