"""One client identity table for writer, validator and Word renderer (v1.0.101).

DeForest 18-11: profiles write "GeNi", "Scheaffler", "SKF" and "Volkswagen";
the register holds "GeNI de México, S.A de C.V.", "SCHAEFFLER", "SKF Industrial"
and "Volkswagen de México and VW Financial Services". The Word renderer already
recognised these short names (src/lib/docx/client-aliases.ts) but the profile
validator demanded byte-identical names, so no answer could pass and every B9
was corrected before review. The alias rule below mirrors client-aliases.ts
(shared fixture: tests/fixtures/client-identities.json) and adds only a single
transposition/letter tolerance for long words. It binds identities supplied by
the firm; it never invents a client, a relationship or a permission, and only
ever moves a name toward MORE privacy.
"""
import re
import unicodedata

GENERIC = re.compile(r'^(grupo|group|private|confidential|client|cliente|empresa|company|corporation|new|nueva|the|manufacturing|manufactura|services|servicios|industries|industria|logistics|logística|instituto|institute|sociedad|asociación|asociacion|fundación|fundacion|banco|bank|fondo|asociados|associates|transportes|semillas|familia|villas|jalisco|guadalajara|zapopan|tlajomulco|durango|m[eé]xico)$', re.I)
QUALIFIER = re.compile(r'^(?:de\b|m[eé]xico\b|industrial\b|manufacturing\b|international\b|services\b|s\.?a\b|s\.?p\.?a\b)', re.I)
DESCRIPTION = re.compile(r'(?:\.|\s+[-–—]\s+|,\s*)\s*(?:is an?|it is an?|a (?:global|world|leading)|company (?:dedicated|engaged|specializing)|located in|based in|headquartered in|empresa dedicada|dedicada a|con sede en)\b', re.I)
LEGAL = {'sa', 'de', 'cv', 'sab', 'sapi', 's', 'rl', 'inc', 'llc', 'ltd', 'corp', 'gmbh', 'ag', 'plc', 'co', 'sc', 'spa', 'srl', 'bv', 'nv'}
CONFIDENTIAL = ('confidential', 'confirmation_required', 'non_publishable')


def _plain(value):
    text = unicodedata.normalize('NFKD', str(value or ''))
    return ''.join(c for c in text if not unicodedata.combining(c))


def clean_name(raw):
    """Name part of a client field: no 'Matter 1 -' header, URL or company description."""
    s = re.sub(r'^(?:publishable|confidential)\s+matter\s+\d+\s*[-—:]\s*', '', str(raw or '').strip(), flags=re.I)
    s = re.sub(r'\s*\(?https?://[^\s)]+\)?', '', s).strip()
    if re.match(r'^(?:it is (?:a|an)|a (?:global|leading|major) (?:company|leader))\b', s, re.I):
        return ''
    match = DESCRIPTION.search(s)
    if match and match.start() > 2:
        s = s[:match.start()]
    return s.strip().rstrip(',').strip()


def client_aliases(names):
    """Same variants as clientAliases() in src/lib/docx/client-aliases.ts."""
    aliases = []
    def add(value):
        if value not in aliases:
            aliases.append(value)
    for raw in names:
        name = clean_name(raw)
        if len(name) < 2:
            continue
        add(name)
        for match in re.finditer(r'\(([^\W_][\w. -]{1,60})\)', name):
            alias = match.group(1).strip()
            if not re.match(r'^(?:wealthy family|private owner|located|company|empresa|familia)\b', alias, re.I):
                add(alias)
        for entity in re.split(r'\s+and\s+|\s+&\s+|,\s+(?!S\.?A\.?\b|S\.?\b)', name, flags=re.I):
            entity = entity.strip()
            if len(entity) >= 2 and not GENERIC.match(entity):
                add(entity)
            first = re.match(r'^[^\W_]+', entity)
            first = first.group(0) if first else ''
            tail = re.sub(r'^[\s,.;:-]+', '', entity[len(first):]).strip() if first else ''
            acronym = len(first) >= 3 and bool(re.search(r'[A-Z].*[A-Z]', first))
            if first and not GENERIC.match(first) and (acronym or (len(first) >= 5 and QUALIFIER.match(tail))):
                add(first)
            brand = re.match(r'^(?:empresa|grupo|corporativo|compañ[ií]a)\s+([^\W_]{4,})$', entity, re.I)
            if brand and not GENERIC.match(brand.group(1)):
                add(brand.group(1))
    return sorted(aliases, key=len, reverse=True)


def tokens(value):
    words = re.findall(r'[a-z0-9]+', _plain(value).casefold())
    while words and words[-1] in LEGAL:
        words.pop()
    return words


def _one_edit(a, b):
    """Optimal string alignment distance <= 1 (one substitution, insertion, deletion or swap)."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        diff = [i for i in range(len(a)) if a[i] != b[i]]
        return len(diff) == 1 or (len(diff) == 2 and diff[1] == diff[0] + 1
                                  and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]])
    short, long_ = sorted((a, b), key=len)
    return any(long_[:i] + long_[i + 1:] == short for i in range(len(long_)))


def same_entity(name, registered):
    """True when NAME is one of the registered identity's own variants."""
    mine = tokens(name)
    if not mine or len(''.join(mine)) < 2:
        return False
    for alias in client_aliases([registered]) or [registered]:
        theirs = tokens(alias)
        if len(theirs) != len(mine):
            continue
        if all(x == y or (len(x) >= 6 and len(y) >= 6 and _one_edit(x, y)) for x, y in zip(mine, theirs)):
            return True
    return False


def is_confidential(matter):
    return (matter.get('publication_route') == 'E'
            or matter.get('resolved_publication_status') in ('confidential', 'confirmation_required')
            or matter.get('publish_status') in CONFIDENTIAL)


def is_publishable(matter):
    return not is_confidential(matter) and (matter.get('publish_status') == 'publishable'
            or matter.get('resolved_publication_status') == 'publishable' or matter.get('publication_route') == 'D')


def register_names(matter):
    return [str(matter.get(k)) for k in ('client', 'clientName', 'name', 'title') if matter.get(k)]


def register_matches(name, package):
    """Register matters whose own client identity this name is."""
    return [m for m in (package or {}).get('matters', [])
            if any(same_entity(name, n) for n in register_names(m))]


def identity_basis(name, package):
    """Canonical privacy basis for a client named in a profile, or None.

    A confidential register matter binds to that matter. A client with no
    register matter at all is a profile-only client: with no publication
    permission it is generalised (v1.0.100 renderer rule), bound to itself.
    A client with a publishable matter is never generalised by code.
    """
    matches = register_matches(name, package)
    if any(is_publishable(m) for m in matches):
        return None
    confidential = [m for m in matches if is_confidential(m)]
    if confidential:
        matter = confidential[0]
        return {'kind': 'client_register', 'source_quote': next(n for n in register_names(matter) if same_entity(name, n)),
                'matter_id': matter['id']}
    if not matches and len(tokens(name)) and len(''.join(tokens(name))) >= 3:
        return {'kind': 'client_register', 'source_quote': str(name).strip(), 'matter_id': ''}
    return None


def profile_identity_table(person, package):
    """Confidential register clients named in this lawyer's original profile.

    Supplied to the B9 writer before prose, so it knows which names to
    generalise instead of discovering it from a rejected answer.
    """
    from core.candidate_evidence import profile_units
    table = []
    for unit in profile_units(person):
        words = re.findall(r"[^\W_][\w'’.&-]*", unit['source_quote'])
        for matter in package.get('matters', []):
            if not is_confidential(matter):
                continue
            for registered in register_names(matter)[:1]:
                width = max(1, len(tokens(clean_name(registered))))
                found = next((' '.join(words[i:i + n]).strip('.,;:') for n in range(1, width + 1)
                              for i in range(len(words) - n + 1)
                              if same_entity(' '.join(words[i:i + n]).strip('.,;:'), registered)), None)
                if found and not any(r['profile_name'] == found and r['matter_id'] == matter['id'] for r in table):
                    table.append({'reference': unit['reference'], 'profile_name': found, 'registered_client': registered,
                                  'matter_id': matter['id'], 'public_rule': 'generalize: confidential client'})
    return table
