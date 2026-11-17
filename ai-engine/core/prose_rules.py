"""Editorial rules enforced in code on generated prose (B9, matters, B10/C2).

Each rule is a known answer, not a judgement: form vocabulary ("named lead
partner"), auditor voice ("The record confirms that"), a duplicated value
sentence, a confirmed department headship missing from its B9. Rules never add
facts and never touch numbers or names. After rewriting, every output binding
must remain literal; a binding that no longer matches is re-pointed to the B9
sentence that carries the same facts, or the rewrite of that field is undone.
"""
import copy
import re
import unicodedata

VERSION = 'prose-rules-v1'

_ADV = r'(?P<adv>(?:also|likewise|further|again|similarly)\s+)?'
_ROLE = r'(?:named|recorded|listed|identified|designated)\s+(?:as\s+)?(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner'
LEAD_PATTERNS = [
    # "X was named lead partner when …" -> "X led the matter when …"
    (re.compile(r'\b(?P<be>was|is)\s+' + _ADV + _ROLE + r'\s+(?=when\b|after\b|where\b|as\b)'), 'the matter '),
    # "… is named lead partner for a client …" -> "… leads the work for a client …"
    (re.compile(r'\b(?P<be>was|is)\s+' + _ADV + _ROLE + r'\s+for\s+'), 'the work for '),
    # "… was named lead partner in/on two amparo proceedings …" -> "… led two amparo proceedings …"
    (re.compile(r'\b(?P<be>was|is)\s+' + _ADV + _ROLE + r'\s+(?:in|on)\s+'), ''),
    # "X was named as lead partner, supported by …" -> "X led the matter, supported by …"
    (re.compile(r'\b(?P<be>was|is)\s+' + _ADV + _ROLE + r'(?=\s*[,;.])'), 'the matter'),
]
EXTRA_LEAD = [
    # "is named lead partner or co-lead partner on mandates" -> "leads or co-leads mandates"
    (re.compile(r'\b(?P<be>was|is)\s+(?P<adv>(?:also|likewise|further)\s+)?(?:named|recorded|listed)\s+(?:as\s+)?lead(?:-|\s)partner\s+or\s+co-?lead(?:-|\s)partner\s+(?:in|on|for)\s+'),
     lambda m: f"{m.group('adv') or ''}{'led or co-led' if m.group('be') == 'was' else 'leads or co-leads'} "),
    # "named lead-partner roles" -> "lead roles"
    (re.compile(r'\bnamed\s+(?:co-?)?lead(?:-|\s)partner\s+(roles?|responsibilit\w+)'), lambda m: f'lead {m.group(1)}'),
    # "His lead-partner responsibilities extend to" -> "His work extends to"
    (re.compile(r'\b(His|Her|Their)\s+(?:co-?)?lead(?:-|\s)partner\s+(?:responsibilities|roles|mandates)\s+(?:also\s+)?extend\s+to\b'), lambda m: f'{m.group(1)} work extends to'),
    # remaining "lead-partner responsibilities/roles" -> "leadership"/"lead roles"
    (re.compile(r'\b(?:co-?)?lead(?:-|\s)partner\s+responsibilit(?:y|ies)\b'), lambda m: 'leadership'),
    (re.compile(r'\b(?:co-?)?lead(?:-|\s)partner\s+(roles?|mandates?)\b'), lambda m: f'lead {m.group(1)}'),
    # "X is the lead partner on/for/in Y" -> "X leads Y" (form vocabulary without "named")
    (re.compile(r'\b(?P<be>was|is)\s+(?P<adv>(?:also|likewise|further)\s+)?the\s+(?P<co>co-?)?lead(?:-|\s)partner\s+(?P<prep>in|on|for)\s+'),
     lambda m: f"{m.group('adv') or ''}{('co-led' if m.group('co') else 'led') if m.group('be') == 'was' else ('co-leads' if m.group('co') else 'leads')} {'the work for ' if m.group('prep') == 'for' else ''}"),
]
TAIL_LEAD = re.compile(r'\b(?P<who>[A-ZÁÉÍÓÚÑ][\w’\'-]+)\s+is\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner\.')

HEDGES = [
    (re.compile(r'\bThe (?:record|source|form) (?:confirms|shows|states|records) that\s+(\w)'), lambda m: m.group(1).upper()),
    (re.compile(r'\b(?:is|was|are|were) (?:described|reported|said|stated) (?:as having|to have)\s+(\w+ed)\b'), lambda m: m.group(1)),
    (re.compile(r'\b(?:According to|As recorded in|As stated in) the (?:record|source|form)s?,\s*(\w)'), lambda m: m.group(1).upper()),
]
VALUE_LINE = re.compile(r'(?:^|(?<=[.!?]\s)|(?<=\n))(?:The\s+)?(?:stated|declared|reported|approximate|estimated)\s+(?:matter\s+)?value\s+(?:was|is|of)\b[^\n]*?(?:[.!?](?=\s|$)|$)', re.I)


def _verb(match, rest):
    be, co, adv = match.group('be'), match.group('co'), match.group('adv') or ''
    verb = ('co-led' if co else 'led') if be == 'was' else ('co-leads' if co else 'leads')
    return f'{adv}{verb} {rest}' if rest else f'{adv}{verb} '


def natural_lead(text):
    """Replace form vocabulary for the lead role with a natural verb; same facts."""
    out = str(text or '')
    for pattern, rest in LEAD_PATTERNS:
        out = pattern.sub(lambda m, rest=rest: _verb(m, rest), out)
    for pattern, repl in EXTRA_LEAD:
        out = pattern.sub(repl, out)
    out = TAIL_LEAD.sub(lambda m: f"{m.group('who')} {'co-leads' if m.group('co') else 'leads'} the matter.", out)
    return re.sub(r'[ \t]{2,}', ' ', out)


def strip_hedges(text):
    out = str(text or '')
    for pattern, repl in HEDGES:
        out = pattern.sub(repl, out)
    return out


def drop_value_lines(text):
    """D3 carries the value; a narrative sentence restating it is removed."""
    out = VALUE_LINE.sub('', str(text or ''))
    return re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]+\n', '\n', out)).strip()


def _fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')) if not unicodedata.combining(c)).casefold()


def _norm(value):
    return ' '.join(str(value or '').split())


HEAD_FUNCTION = re.compile(r'\b(?:head(?:s)?\s+(?:of\s+)?|leads?\s+|leading\s+|responsible\s+for\s+)(?:[\w’&,-]+\s+){0,8}(?:department|practice|areas?|group|team)\b|\b(?:department(?:al)?|practice)\s+(?:head|leader)\b|\bhead\s+of\s+(?:the\s+)?(?:firm|department)\b', re.I)


def states_headship(bio, practice=''):
    """A headship counts when it names the department/practice or this practice area."""
    keys = [w for w in re.findall(r'[\w’]{4,}', _fold(practice)) if w not in ('practice', 'department', 'law')]
    for match in HEAD_FUNCTION.finditer(str(bio or '')):
        text = _fold(match.group(0))
        if re.search(r'\b(?:department|practice)\b', text) or any(k in text for k in keys):
            return True
    return False


def place_headship(candidate, package):
    """A confirmed department head missing from the B9 is stated in its first sentence."""
    heads = {_fold(' '.join(str(h.get('name') or '').split())) for h in (package.get('filing_details') or {}).get('heads', []) if isinstance(h, dict)}
    name = candidate.get('name', '')
    bio = str(candidate.get('submission_bio') or '')
    if _fold(' '.join(name.split())) not in heads or states_headship(bio, package.get('practice_area')):
        return candidate, False
    words = len(name.split())
    head = bio.split()[:words]
    if _fold(' '.join(head)) != _fold(' '.join(name.split())) or not re.match(r'\s+[a-z]', bio[len(' '.join(head)):]):
        return candidate, False
    practice = str(package.get('practice_area') or '').strip()
    clause = f', head of the {practice} practice,' if practice else ', head of the department,'
    written = ' '.join(head)
    result = copy.deepcopy(candidate)
    result['submission_bio'] = written + clause + bio[len(written):]
    return result, True


def _words(text):
    return set(re.findall(r'[\w’]{3,}', _fold(text)))


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', str(text or '')) if s.strip()]


def rebind(candidate, previous_bio=None):
    """Re-point non-literal output bindings to the B9 sentence carrying the same facts."""
    result = copy.deepcopy(candidate)
    bio = _norm(result.get('submission_bio'))
    sentences = _sentences(result.get('submission_bio'))
    used, moved, unresolved = set(), 0, 0
    for key in ('submission_case_coverage', 'profile_coverage'):
        for item in result.get(key) or []:
            quote = item.get('public_quote')
            if not isinstance(quote, str) or not quote.strip():
                continue
            if _norm(quote) in bio:
                used.add(_norm(quote))
                continue
            target = _words(natural_lead(strip_hedges(quote))) | _words(quote)
            numbers = set(re.findall(r'\d[\d.,]*', quote))
            best, score = None, 0.0
            for sentence in sentences:
                if _norm(sentence) in used and key == 'submission_case_coverage':
                    continue
                if not numbers <= set(re.findall(r'\d[\d.,]*', sentence)):
                    continue
                words = _words(sentence)
                overlap = len(target & words) / max(len(target), 1)
                if overlap > score:
                    best, score = sentence, overlap
            if best and score >= 0.6:
                item['public_quote'] = best
                used.add(_norm(best))
                moved += 1
            else:
                unresolved += 1
    return result, moved, unresolved


def polish_candidate(candidate, package):
    """Apply the B9 rules; bindings stay literal or the field keeps its prior text."""
    original = copy.deepcopy(candidate)
    result = copy.deepcopy(candidate)
    result['submission_bio'] = strip_hedges(natural_lead(result.get('submission_bio', '')))
    for key in ('submission_case_coverage', 'profile_coverage'):
        for item in result.get(key) or []:
            if isinstance(item.get('public_quote'), str):
                item['public_quote'] = strip_hedges(natural_lead(item['public_quote']))
    result, titled = place_headship(result, package)
    result, moved, unresolved = rebind(result)
    before_unresolved = rebind(original)[2]
    if unresolved > before_unresolved:
        # Never trade a literal binding for style: keep the prior wording.
        return original, {'changed': False, 'reason': 'binding_would_break'}
    changed = result != original
    return result, {'changed': changed, 'headship_placed': titled, 'rebound': moved}


def polish_proposal(package, proposal):
    """Return (proposal, report) with prose rules applied to B9, matters and B10/C2."""
    result = copy.deepcopy(proposal)
    report = {'version': VERSION, 'fields': []}
    for i, candidate in enumerate(result.get('candidates', [])):
        polished, info = polish_candidate(candidate, package)
        if info.get('changed'):
            result['candidates'][i] = polished
            report['fields'].append({'path': f'candidates/{i}/submission_bio', **info})
    values = {m.get('id'): str(m.get('value') or '').strip() for m in package.get('matters', [])}
    for i, matter in enumerate(result.get('matters', [])):
        text = strip_hedges(natural_lead(matter.get('text', '')))
        if values.get(matter.get('matter_id')):
            text = drop_value_lines(text)
        if text and text != matter.get('text'):
            matter['text'] = text
            report['fields'].append({'path': f'matters/{i}/text', 'changed': True})
    for key in ('b10', 'c2'):
        text = strip_hedges(natural_lead(result.get(key, '')))
        if text and text != result.get(key):
            result[key] = text
            report['fields'].append({'path': key, 'changed': True})
    # Institutional bindings must remain literal in B10/C2.
    for link in result.get('institutional_execution') or []:
        for field, quote_key in (('b10', 'b10_quote'), ('c2', 'c2_quote')):
            quote = link.get(quote_key)
            if isinstance(quote, str) and quote and _norm(quote) not in _norm(result.get(field)):
                fixed = strip_hedges(natural_lead(quote))
                if _norm(fixed) in _norm(result.get(field)):
                    link[quote_key] = fixed
                else:
                    result[field] = proposal.get(field)  # undo: binding would break
    return result, report
