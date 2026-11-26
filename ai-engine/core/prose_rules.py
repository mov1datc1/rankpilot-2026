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

# v1.0.116: a frequency adverb ("is repeatedly listed as lead partner on") belongs to
# the register wording and goes with it; the plural of the mandates already says it.
_FREQ = r'(?:(?:repeatedly|regularly|consistently|frequently|often|routinely)\s+)?'
_ADV = _FREQ + r'(?P<adv>(?:also|likewise|further|again|similarly)\s+)?'
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
    # v1.0.115 (real run): "a listed lead partner", "her listed leadership",
    # "his listed lead role" -> the role itself, without the register adjective.
    (re.compile(r'\b(?:listed|recorded|documented)\s+(?=(?:co-?)?lead(?:-|\s)partners?\b|(?:co-?)?lead(?:ership)?\s+roles?\b|leadership\b)', re.I), ''),
    # "is listed in/on leadership roles on" -> "holds leadership roles on"
    (re.compile(r'\b(?P<be>is|are|was|were)\s+' + _FREQ + r'(?:listed|named|recorded)\s+(?:in|on)\s+(?P<what>(?:a\s+)?lead(?:ership)?\s+roles?)\b', re.I),
     lambda m: f"{ {'is': 'holds', 'are': 'hold'}.get(m.group('be').lower(), 'held')} {m.group('what')}"),
    # v1.0.110: "is (also) listed as a team member on" -> "is (also) a team member on".
    # Form vocabulary for participation; the voice rules reject it and a bound
    # quotation made it impossible to repair (the case stopped).
    (re.compile(r'\b(?P<be>is|are|was|were)(?P<adv>\s+(?:also|likewise|further))?\s+(?:listed|named|recorded|identified)\s+as\s+(?P<art>(?:an?|one\s+of\s+the)\s+)?(?P<what>team\s+members?|members?\s+of\s+the\s+(?:matter\s+)?team)\b', re.I),
     lambda m: f"{m.group('be')}{m.group('adv') or ''} {m.group('art') or ''}{m.group('what')}"),
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
    # "X is (also) lead partner in/on/for Y" -> "X (also) leads Y"
    (re.compile(r'\b(?P<be>is|was)\s+(?P<adv>(?:also|likewise|further)\s+)?(?P<co>co-?)?lead(?:-|\s)partner\s+(?P<prep>in|on|for)\s+'),
     lambda m: f"{m.group('adv') or ''}{_tense(m.group('be') == 'was', m.group('co'))} {'the work for ' if m.group('prep') == 'for' else ''}"),
    # "X serves/served as (the) lead partner in/on/for Y" -> "X leads/led Y"
    (re.compile(r'\b(?P<v>serves|served|acts|acted)\s+as\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner\s+(?P<prep>in|on|for)\s+'),
     lambda m: f"{_tense(m.group('v') in ('served', 'acted'), m.group('co'))} {'the work for ' if m.group('prep') == 'for' else ''}"),
    # "X served as lead partner, when …" -> "X led the matter, when …"
    (re.compile(r'\b(?P<v>serves|served|acts|acted)\s+as\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner(?=\s*(?:[,;.]|when\b|where\b|after\b|while\b|as\b|and\b))'),
     lambda m: f"{_tense(m.group('v') in ('served', 'acted'), m.group('co'))} the matter"),
    # "As lead partner in X, he …" -> "Leading X, he …"
    (re.compile(r'\bAs\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner\s+(?P<prep>in|on|for)\s+'),
     lambda m: f"{'Co-leading' if m.group('co') else 'Leading'} {'the work for ' if m.group('prep') == 'for' else ''}"),
    # "X was (the) lead partner, supported by …" / "… was lead partner." -> "X led the matter, …"
    (re.compile(r'\b(?P<be>is|was)\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner(?=\s*(?:[,;.)]|$))'),
     lambda m: f"{_tense(m.group('be') == 'was', m.group('co'))} the matter"),
    # "X and Y are/were the lead partners (on the matter)" -> "X and Y co-lead/co-led the matter"
    (re.compile(r'\b(?P<be>are|were)\s+(?:the\s+)?(?:co-?)?lead(?:-|\s)partners(?:\s+(?:on|for|in)\s+the\s+matter)?(?=\s*(?:[,;.)]|$))'),
     lambda m: f"{'co-led' if m.group('be') == 'were' else 'co-lead'} the matter"),
    # "X has been (the) lead partner on/in/for Y" -> "X has led Y"
    (re.compile(r'\bhas\s+(?P<adv>(?:also|likewise)\s+)?been\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner\s+(?P<prep>on|in|for)\s+'),
     lambda m: f"has {m.group('adv') or ''}{'co-led' if m.group('co') else 'led'} {'the work for ' if m.group('prep') == 'for' else ''}"),
    # v1.0.113: any remaining registry verb about a role ("is listed as a lead
    # partner, alongside Y, on", "is listed as one of three lead partners", "is
    # listed among the team members"). The role is a fact about the lawyer, not
    # about how a form lists it: the registry verb goes, every fact stays.
    (re.compile(r'\b(?P<be>is|are|was|were)(?P<adv>\s+(?:also|likewise|further))?\s+(?:listed|named|recorded|identified|designated|shown)\s+(?P<link>as|among)\s+'
                r'(?=(?:an?\s+|the\s+|one\s+of\s+(?:the\s+)?(?:\w+\s+)?)?(?:(?:co-?)?lead(?:-|\s)partners?|team\s+members?|members?\s+of\s+the\s+(?:matter\s+)?team)\b)', re.I),
     lambda m: f"{m.group('be')}{m.group('adv') or ''} {'among ' if m.group('link').lower() == 'among' else ''}"),
]
# v1.0.116 (real run, B10/C2): "X is listed on significant Tax mandates", "is listed on
# matters involving …". Being on the record of a mandate is acting on it; a company
# "listed on the stock exchange" has no mandate noun and an article, and is untouched.
LISTED_ON = re.compile(r'\b(?P<be>is|are|was|were)\s+' + _FREQ + r'(?P<adv>(?:also|likewise|further)\s+)?listed\s+on\s+'
                       r'(?!(?:the|a|an|its|their|his|her)\b)(?!(?:[\w-]+\s+){0,4}(?:exchanges?|markets?|bourse|registr(?:y|ies)|registers?|index|nasdaq|nyse)\b)'
                       r'(?=[^.;:!?]*?\b(?:matters?|mandates?|engagements?)\b)', re.I)
# Research vocabulary that is not public prose: "is observed in the scoped Chambers …
# profile as", "the portfolio records tax analysis on".
RESEARCH_VOICE = [
    (re.compile(r'\bscoped\s+(?=(?:official\s+)?(?:Chambers|Legal\s*500)\b)', re.I), ''),
    (re.compile(r'\b(?P<be>is|are|was|were)\s+observed\s+in\s+(?=the\s+(?:[\w&-]+\s+){0,2}(?:Chambers|Legal\s*500)\b)', re.I),
     lambda m: f"{m.group('be')} recognised in "),
    (re.compile(r'\b(?P<art>[Tt]he)\s+portfolio\s+records\b'), lambda m: f"{m.group('art')} portfolio includes"),
]
TAIL_LEAD = re.compile(r'\b(?P<who>[A-ZÁÉÍÓÚÑ][\w’\'-]+)\s+is\s+(?:the\s+)?(?P<co>co-?)?lead(?:-|\s)partner\.')

HEDGES = [
    # "The firm reports that X" / "; the firm reports that its …" -> the fact itself
    (re.compile(r'\bThe (?:firm|team|client) (?:reports|states|notes|indicates|says) that\s+(\w)'), lambda m: m.group(1).upper()),
    (re.compile(r'\bthe (?:firm|team) (?:reports|states|notes|indicates|says) that\s+'), lambda m: ''),
    (re.compile(r'\bThe (?:record|source|form) (?:confirms|shows|states|records) that\s+(\w)'), lambda m: m.group(1).upper()),
    (re.compile(r'\b(?:is|was|are|were) (?:described|reported|said|stated) (?:as having|to have)\s+(\w+ed)\b'), lambda m: m.group(1)),
    (re.compile(r'\b(?:According to|As recorded in|As stated in) the (?:record|source|form)s?,\s*(\w)'), lambda m: m.group(1).upper()),
]
VALUE_LINE = re.compile(r'(?:^|(?<=[.!?]\s)|(?<=\n))(?:The\s+)?(?:stated|declared|reported|approximate|estimated)\s+(?:matter\s+)?value\s+(?:was|is|of)\b[^\n]*?(?:[.!?](?=\s|$)|$)', re.I)


def _tense(past, co):
    return ('co-led' if co else 'led') if past else ('co-leads' if co else 'leads')


def _verb(match, rest):
    be, co, adv = match.group('be'), match.group('co'), match.group('adv') or ''
    verb = ('co-led' if co else 'led') if be == 'was' else ('co-leads' if co else 'leads')
    return f'{adv}{verb} {rest}' if rest else f'{adv}{verb} '


_LEAD_NOUN = re.compile(r'(?<!co-)(?<!co)\blead(?P<sep>-|\s)partner(?P<plural>s?)\b', re.I)
_REGISTER_LEAD = re.compile(r'\b(?P<be>is|was)\s+' + _FREQ + r'(?P<adv>(?:also|likewise|further)\s+)?(?:(?:named|recorded|listed|identified|designated)\s+(?:as\s+)?)?(?:the\s+|an?\s+)?lead(?:-|\s)partner\b(?=\s+(?:in|on|for)\b)', re.I)


def source_lead(text, package, subject=None):
    """v1.0.117: natural_lead that knows who leads alone and who co-leads.

    The rewrite "is (listed as) lead partner on X" -> "leads X" was written when
    public prose named no client. Once B10/C2 name them, "leads" for a mandate
    with three lead partners is a false statement (real run: the judge's only
    critical). Sentence by sentence, with exact client and lawyer names only:
    every named mandate co-led -> the co-lead form; some led alone and some
    co-led -> "is a lead partner on", true of both; otherwise unchanged behaviour.
    """
    from core.fact_sheet import lead_scope
    out = []
    for piece in re.split(r'(?<=[.!?])(\s+)', str(text or '')):
        if piece and not piece.isspace() and re.search(r'lead(?:-|\s)partner', piece, re.I):
            scope = lead_scope(piece, package, subject)
            if scope == 'shared':
                piece = _LEAD_NOUN.sub(lambda m: f"co-lead{m.group('sep')}partner{m.group('plural')}", piece)
            elif scope == 'mixed':
                piece = _REGISTER_LEAD.sub(lambda m: f"{m.group('be')} {m.group('adv') or ''}a lead partner", piece)
                out.append(piece)
                continue
        out.append(natural_lead(piece) if piece and not piece.isspace() else piece)
    return ''.join(out)


def natural_lead(text):
    """Replace form vocabulary for the lead role with a natural verb; same facts."""
    out = str(text or '')
    for pattern, rest in LEAD_PATTERNS:
        out = pattern.sub(lambda m, rest=rest: _verb(m, rest), out)
    for pattern, repl in EXTRA_LEAD:
        out = pattern.sub(repl, out)
    out = TAIL_LEAD.sub(lambda m: f"{m.group('who')} {'co-leads' if m.group('co') else 'leads'} the matter.", out)
    out = LISTED_ON.sub(lambda m: f"{m.group('adv') or ''}{ {'is': 'acts', 'are': 'act'}.get(m.group('be').lower(), 'acted')} on ", out)
    for pattern, repl in RESEARCH_VOICE:
        out = pattern.sub(repl, out)
    return re.sub(r'[ \t]{2,}', ' ', out)


def strip_hedges(text):
    out = str(text or '')
    for pattern, repl in HEDGES:
        out = pattern.sub(repl, out)
    return out


FIRST_TIME = re.compile(r"\b(?P<art>an?\s+)?first[-\s]time\s+(?P<noun>recognition|rankings?|inclusion|entry|listing|coverage)\b", re.I)
FOR_FIRST_TIME = re.compile(r"\b(?P<noun>recognition|recognised|recognized|ranked|ranking|inclusion|included|listed)\s+for\s+the\s+first\s+time\b", re.I)


def plain_aspiration(text):
    """C2 states the aspiration without saying it is the firm's first time.

    v1.0.119. The C2 contract forbids "first-time recognition" and also tells the
    writer to take the aspiration from the supplied target, which for an unranked
    practice is literally "First-time recognition". Real run 75b8ade5 and its unit
    replay both wrote the forbidden words, and the first one paid a repair for it.
    """
    def swap(match):
        noun = match.group('noun')
        out = (('an ' if noun[0].lower() in 'aeiou' else 'a ') if match.group('art') else '') + noun
        return out[0].upper() + out[1:] if match.group(0)[0].isupper() else out
    return FOR_FIRST_TIME.sub(lambda m: m.group('noun'), FIRST_TIME.sub(swap, str(text or '')))


def drop_value_lines(text):
    """D3 carries the value; a narrative sentence restating it is removed."""
    out = VALUE_LINE.sub('', str(text or ''))
    return re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]+\n', '\n', out)).strip()


def _fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')) if not unicodedata.combining(c)).casefold()


def _norm(value):
    return ' '.join(str(value or '').split())


HEAD_FUNCTION = re.compile(r'\b(?:head(?:s)?\s+(?:of\s+)?|leads?\s+|leading\s+|responsible\s+for\s+)(?:[\w’&,-]+\s+){0,8}(?:department|practice|areas?|group|team)\b|\b(?:department(?:al)?|practice)\s+(?:head|leader)\b|\bhead\s+of\s+(?:the\s+)?(?:firm|department)\b', re.I)


# v1.0.116: "co-leads the matter, in which the Tax Department advises" leads a
# mandate, not the department. It was counted as a second headship statement and
# bought a self-correction that came back worse (real run).
MANDATE_OBJECT = re.compile(r'\b(?:matters?|mandates?|representations?|engagements?|cases?|disputes?|transactions?|proceedings?|advice)\b', re.I)


def headship_matches(text):
    """Passages that state a department/practice headship, never a mandate led."""
    return [m for m in HEAD_FUNCTION.finditer(str(text or '')) if not MANDATE_OBJECT.search(m.group(0))]


def states_headship(bio, practice=''):
    """A headship counts when it names the department/practice or this practice area."""
    keys = [w for w in re.findall(r'[\w’]{4,}', _fold(practice)) if w not in ('practice', 'department', 'law')]
    for match in headship_matches(bio):
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


def shared_identity(candidate):
    """A retained credential whose source says "the same University" names no entity of its own.

    Its entity_name is cleared only when that entity is already retained by another
    unit whose own source quote contains it; privacy decisions are untouched.
    """
    result = copy.deepcopy(candidate)
    items = result.get('profile_coverage') or []
    owned = {_fold(i.get('entity_name')) for i in items if i.get('decision') == 'retain' and i.get('entity_name')
             and _fold(i.get('entity_name')) in _fold(_norm(i.get('source_quote')))}
    fixed = 0
    for item in items:
        entity = _fold(item.get('entity_name'))
        if (item.get('decision') == 'retain' and entity and entity not in _fold(_norm(item.get('source_quote')))
                and entity in owned):
            item['entity_name'] = ''
            fixed += 1
    return result, fixed


def polish_candidate(candidate, package):
    """Apply the B9 rules; bindings stay literal or the field keeps its prior text."""
    original = copy.deepcopy(candidate)
    result = copy.deepcopy(candidate)
    result['submission_bio'] = strip_hedges(source_lead(result.get('submission_bio', ''), package, candidate.get('name')))
    for key in ('submission_case_coverage', 'profile_coverage'):
        for item in result.get(key) or []:
            if isinstance(item.get('public_quote'), str):
                item['public_quote'] = strip_hedges(source_lead(item['public_quote'], package, candidate.get('name')))
    result, titled = place_headship(result, package)
    result, shared = shared_identity(result)
    result, moved, unresolved = rebind(result)
    before_unresolved = rebind(original)[2]
    if unresolved > before_unresolved:
        # Never trade a literal binding for style: keep the prior wording.
        return original, {'changed': False, 'reason': 'binding_would_break'}
    changed = result != original
    return result, {'changed': changed, 'headship_placed': titled, 'rebound': moved, 'shared_identity': shared}


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
    def institutional(text, key):
        text = strip_hedges(source_lead(text, package))
        return plain_aspiration(text) if key == 'c2' else text
    for key in ('b10', 'c2'):
        text = institutional(result.get(key, ''), key)
        if text and text != result.get(key):
            result[key] = text
            report['fields'].append({'path': key, 'changed': True})
    # Institutional bindings must remain literal in B10/C2.
    for link in result.get('institutional_execution') or []:
        for field, quote_key in (('b10', 'b10_quote'), ('c2', 'c2_quote')):
            quote = link.get(quote_key)
            if isinstance(quote, str) and quote and _norm(quote) not in _norm(result.get(field)):
                fixed = institutional(quote, field)
                if _norm(fixed) in _norm(result.get(field)):
                    link[quote_key] = fixed
                else:
                    result[field] = proposal.get(field)  # undo: binding would break
    return result, report
