"""One record of the case's confirmed facts, given to every writer and reviewer.

v1.0.117. In sixteen stored real runs the judge's critical findings changed
family with every version, and almost all of them were facts the application
already held in structured form: a publishable client described as
confidential, a co-led mandate written as led, a category different from the
decided one, a declared ranking reported as absent. Each writer received the
raw register and had to derive those facts again.

This module derives nothing new and interprets no prose. It reads fields the
extraction already saved and the user already reviewed, and arranges them by
client and by lawyer. Checking generated prose against it is the reviewers'
job, not a regular expression's.
"""
import re

from core.role_evidence import identity

VERSION = 'fact-sheet-v1'
ROLES = ('development', 'repair', 'writer', 'field_reviewer', 'editor')
RULE = ('''FACT SHEET: fact_sheet is the application's record of this case's confirmed
facts, read from the reviewed sources: each client's publication status, who leads
a mandate alone, who co-leads it and with whom, who is a team member, titles,
department headship, declared and verified rankings, department size, the supplied
target and, when present, the current nomination decisions. Wherever your text
states one of these facts it must agree with fact_sheet: a lawyer "leads" a mandate
only when it is in leads_alone, "co-leads" it when it is in co_leads, and took part
in it when it is in team_member; a client is confidential only when its publication
is confidential; a category is stated only as the current decision gives it; a
department head is named only with the words case.department_heads gives, and when
an entry carries not_confirmed_as the form gives an incomplete name and does not
confirm that the head is that fully named lawyer: state what that lawyer leads in
the mandates and do not write who heads or leads the department or practice,
neither with the incomplete name nor with the longer one.
A lawyer's source_statements are the sources' own sentences about that person, from
whatever section they appear in (department description, any matter, selected or
not): use them as that person's evidence in their B9, in B10 when it describes the
team, and in the Audit's assessment; never drop them because they sit in another
section, and never turn them into a mandate.
case.objectives: C2 builds and closes on the primary objective; a secondary objective
(for example maintaining the current band) is a fallback stated in the Audit, never the
conclusion of a C2 that argues for the primary one. When the evidence cannot support the
primary objective, the Audit says so and recommends the adjusted objective, and C2 follows
that recommendation from its first sentence to its last.
A client entry with public_use is a mandate the source forbids describing publicly:
it never appears in B9, B10 or C2, not even anonymously, and it remains in section E
and in the Audit. A client entry with research_period closed before the period is not
part of this cycle's portfolio. A client's other_names designate that same client and
follow its publication status.
fact_sheet adds no fact about the legal work and never replaces the sources for the
substance of a mandate.''')
REVIEW_RULE = RULE + (''' When reviewing, a statement about one of these facts that
contradicts fact_sheet is a concrete defect to report with its exact correction; a
statement that agrees with fact_sheet is supported by the application's record.''')

_HEADING = re.compile(r'(?i)^\s*(?:(?:other\s+)?team\s+members?|lead partners?|lead lawyers?|socios? responsables?)\s*[:(s)]*\s*')
_EMPTY = ('not applicable', 'sin informacion', 'n a', 'not stated', 'none', 'no aplica')


def listed_names(value):
    """Names in a structured role cell. Titles in parentheses are not names."""
    if isinstance(value, (list, tuple)):
        return [name for item in value for name in listed_names(item)]
    raw = re.sub(r'\([^()]*\)', ' ', _HEADING.sub('', str(value or '')))
    names = []
    for part in re.split(r'\s+(?:and|y|&)\s+|[;\n/]|,\s*', raw):
        name = re.sub(r'(?i)^(?:and|y|&)\s+', '', part.strip(' .\t')).strip(' .\t')
        key = identity(name)
        if 2 <= len(key.split()) <= 7 and key not in _EMPTY and name not in names:
            names.append(name)
    return names


def roster_match(name, roster):
    """The roster lawyer a cell names: the same name, or the only one that contains it."""
    key = identity(name)
    if key in roster:
        return key
    words = set(key.split())
    found = [person for person in roster if len(words) >= 2 and words <= set(person.split())]
    return found[0] if len(found) == 1 else None


def publication(matter):
    """Same rule as the section the matter is rendered in (D public, E confidential)."""
    route = matter.get('publication_route')
    if route in ('D', 'E'):
        return 'publishable' if route == 'D' else 'confidential'
    status = matter.get('resolved_publication_status') or matter.get('publish_status') or matter.get('publishStatus')
    return 'publishable' if status == 'publishable' else 'confidential'


def matter_roles(package):
    """{matter_id: {'lead': [names as written], 'lead_roster': [...], 'team_roster': [...]}}.

    v1.0.121: read from the case register when the package carries one, so a
    lead answered "na" or a lead named only in the narrative is not lost."""
    register = (package or {}).get('case_register')
    if isinstance(register, dict) and isinstance(register.get('matters'), dict):
        result = {}
        for matter in package.get('matters', []):
            facts = register['matters'].get(matter.get('id')) or {'leads': [], 'team': []}
            lead_roster = [k for k in dict.fromkeys(p.get('roster') for p in facts['leads']) if k]
            result[matter.get('id')] = {
                'lead': [p['name'] for p in facts['leads']], 'lead_roster': lead_roster,
                'team_roster': [k for k in dict.fromkeys(p.get('roster') for p in facts['team']) if k and k not in lead_roster]}
        return result
    roster = {identity(p.get('name') or p.get('fullName')): (p.get('name') or p.get('fullName'))
              for p in package.get('lawyers', []) if identity(p.get('name') or p.get('fullName'))}
    result = {}
    for matter in package.get('matters', []):
        lead = listed_names(matter.get('leadPartner') or matter.get('lead_partner'))
        team = listed_names(matter.get('teamMembers') or matter.get('team_members'))
        lead_roster = [key for key in dict.fromkeys(roster_match(n, roster) for n in lead) if key]
        result[matter.get('id')] = {
            'lead': [roster.get(roster_match(n, roster), n) for n in lead],
            'lead_roster': lead_roster,
            'team_roster': [key for key in dict.fromkeys(roster_match(n, roster) for n in team) if key and key not in lead_roster]}
    return result


def department_heads(package):
    """Each head exactly as the form names them.

    v1.0.119, real run 75b8ade5: the form named the head by given names only and
    the mandates named a lead partner whose full name begins with them. B10 and C2
    wrote that the fully named lawyer heads the department and the judge rejected
    both: the form does not say they are the same person. Code does not decide it
    either. It records the name as written and, when a longer known name contains
    it, says that the identity is not confirmed; the wizard asks the user to
    complete the name before the case runs.
    """
    package = package or {}
    heads = [' '.join(str(h.get('name')).split()) for h in ((package.get('filing_details') or {}).get('heads') or package.get('departmentHeads') or [])
             if isinstance(h, dict) and len(identity(h.get('name'))) > 2 and identity(h.get('name')) not in _EMPTY]
    known = {}
    for profile in package.get('lawyers', []):
        name = profile.get('name') or profile.get('fullName')
        if identity(name):
            known.setdefault(identity(name), ' '.join(str(name).split()))
    for matter in package.get('matters', []):
        for name in listed_names(matter.get('leadPartner') or matter.get('lead_partner')):
            known.setdefault(identity(name), name)
    result = []
    for head in dict.fromkeys(heads):
        key, entry = identity(head), {'name': head}
        if key not in known:
            words = set(key.split())
            longer = [name for other, name in known.items() if words < set(other.split())]
            if longer:
                entry['not_confirmed_as'] = longer
        result.append(entry)
    return result


def build(package, strategy=None, development=None, person=None):
    """The sheet for one call. `person` limits it to that lawyer and their mandates."""
    package = package or {}
    dispositions = {d.get('matter_id'): d.get('disposition') for d in (strategy or {}).get('matters', [])}
    roles = matter_roles(package)
    matters = [m for m in package.get('matters', []) if not dispositions or dispositions.get(m.get('id')) in ('core', 'reserve')]
    target = identity(person) if person else None
    if target:
        matters = [m for m in matters if target in roles[m.get('id')]['lead_roster'] + roles[m.get('id')]['team_roster']]
    label = {m.get('id'): ' '.join(str(m.get('client_name') or m.get('client') or m.get('name') or m.get('id')).split()).strip(' |') for m in matters}
    clients = [{'matter_id': m.get('id'), 'client': label[m.get('id')], 'publication': publication(m),
                **({'other_names': m['client_other_names']} if m.get('client_other_names') else {}),
                **({'value': 'the amount of the matter value is confidential: never state that amount, not even as a range, and never describe its size in words (for example "substantial", "significant", "multi-million") in B9, B10 or C2. Results, percentages and the other documented facts of the mandate are not restricted by this'} if re.match(r'\s*confiden', str(m.get('value') or ''), re.I) else {}),
                **({'public_use': 'restricted by the source ("' + str(((package.get('case_register') or {}).get('matters') or {}).get(m.get('id'), {}).get('restriction_quote') or 'strictly confidential') + '"): this mandate is never described in B9, B10 or C2, not even anonymously; it stays in section E and in the Audit'} if m.get('public_use_restricted') else {}),
                **({'research_period': 'closed before the confirmed research period: it is not part of the portfolio of this cycle'} if m.get('in_research_period') is False else {}),
                **({'cross_border_question': 'the form answers that this matter is not cross-border, but the record says: "' + m['cross_border_doubt'] + '". The Audit asks the firm to confirm; the Submission keeps the form answer and never narrates the discrepancy'} if m.get('cross_border_doubt') else {}),
                **({'selection': dispositions[m.get('id')]} if dispositions.get(m.get('id')) else {})} for m in matters]
    head_names = [str(h.get('name')).strip() for h in ((package.get('filing_details') or {}).get('heads') or package.get('departmentHeads') or [])
                  if isinstance(h, dict) and identity(h.get('name'))]
    heads = {identity(n) for n in head_names}
    verified = {}
    for item in ((package.get('ranking_verification') or {}).get('individuals') or []):
        if isinstance(item, dict) and str(item.get('status') or '').startswith('verified') and str(item.get('observed_band') or '').strip():
            verified[identity(item.get('lawyer_name'))] = str(item['observed_band']).strip()
    decisions = {identity(c.get('name')): c for c in (development or {}).get('candidates', []) if isinstance(c, dict)}
    lawyers = []
    for profile in package.get('lawyers', []):
        name = profile.get('name') or profile.get('fullName')
        key = identity(name)
        if not key or (target and key != target):
            continue
        entry = {'name': name}
        registered = (((package.get('case_register') or {}).get('lawyers') or {}).get(' '.join(str(name).split())) or {})
        if registered.get('title') or profile.get('role') or profile.get('title'):
            # The title as the sources write it ("Senior Associate"), not the form's class.
            entry['title'] = registered.get('title') or profile.get('role') or profile.get('title')
        if registered.get('other_names'):
            entry['also_written_as'] = registered['other_names']
        if registered.get('statements'):
            entry['source_statements'] = registered['statements']
        if key in heads:
            # A shared headship is stated as shared: "one of the heads", never "the head".
            others = [n for n in head_names if identity(n) != key]
            entry['department_head'] = ('one of ' + str(len(heads)) + ' department heads, with ' + ' and '.join(others)) if others else 'sole department head'
        declared = profile.get('current_ranking') or profile.get('currentRank')
        if declared:
            entry['declared_ranking'] = str(declared) + ' (declared by the firm, not verified)'
        if key in verified:
            entry['verified_ranking'] = verified[key] + ' (verified by the application in the official table)'
        alone, shared, team = [], [], []
        for m in matters:
            role = roles[m.get('id')]
            if key in role['lead_roster']:
                others = [n for n in role['lead'] if identity(n) != key]
                (shared.append({'client': label[m.get('id')], 'with': others}) if others else alone.append(label[m.get('id')]))
            elif key in role['team_roster']:
                team.append(label[m.get('id')])
        entry.update(leads_alone=alone, co_leads=shared, team_member=team)
        decision = decisions.get(key)
        if decision:
            entry['current_decision'] = {'recommendation': decision.get('recommendation'), 'category': decision.get('suggested_ranking')}
        lawyers.append(entry)
    sheet = {'version': VERSION, 'clients': clients, 'lawyers': lawyers}
    if not target:
        details = package.get('filing_details') or {}
        case = {k: package.get(k) for k in ('firm_name', 'practice_area', 'directory', 'jurisdiction', 'research_period', 'requested_target', 'objectives')
                if package.get(k)}
        size = {k: details.get(v) for k, v in (('partners', 'num_partners'), ('other_lawyers', 'num_lawyers')) if str(details.get(v) or '').strip()}
        if size:
            case['department_size'] = size
        named = department_heads(package)
        if named:
            case['department_heads'] = named
        if case:
            sheet['case'] = case
    return sheet


def for_call(state, role, payload):
    """The sheet a role receives, or None. A biography receives its own lawyer only."""
    package = state.get('package') or {}
    if role not in ROLES or not package.get('matters') or not isinstance(payload, dict) or 'fact_sheet' in payload:
        return None
    units = payload.get('units')
    if role == 'field_reviewer' and isinstance(units, list) and units and all(
            str((u or {}).get('field', '')).startswith(('matters/', 'comparisons/')) for u in units):
        return None  # a matter narrative is reviewed against its own record
    person = None
    if role == 'development' and state.get('rag_unit') == 'bio':
        person = (payload.get('shared_decision') or {}).get('name')
    if role == 'development' and state.get('rag_unit') == 'matters':
        return None
    # While the units are being written the decisions live in the shared plan.
    decisions = state.get('development') or payload.get('shared_decisions')
    if not decisions and isinstance(payload.get('shared_decision'), dict):
        decisions = {'candidates': [payload['shared_decision']]}
    return build(package, state.get('strategy'), decisions, person)


def lead_scope(sentence, package, subject=None):
    """How the lawyers named in a sentence lead the clients named in it.

    Exact names only (client aliases and roster names): 'alone' when every named
    mandate is led by that lawyer alone, 'shared' when every one is co-led,
    'mixed' when both occur, None when the sentence names no client the lawyer
    leads. Nothing is inferred from a generalised ("a confidential client") mention.
    """
    from core.client_identity import client_aliases
    text = identity(sentence)
    if not text:
        return None
    roles = matter_roles(package)
    people = [identity(subject)] if subject else []
    if not people:
        for profile in package.get('lawyers', []):
            key = identity(profile.get('name') or profile.get('fullName'))
            parts = key.split()
            if key and (key in text or (len(parts) >= 2 and re.search(r'(?<!\w)' + re.escape(parts[-1]) + r'(?!\w)', text))
                        or (len(parts) >= 3 and re.search(r'(?<!\w)' + re.escape(' '.join(parts[-2:])) + r'(?!\w)', text))):
                people.append(key)
    found = set()
    for matter in package.get('matters', []):
        role = roles[matter.get('id')]
        leaders = [p for p in people if p in role['lead_roster']]
        if not leaders:
            continue
        aliases = [identity(a) for a in client_aliases([str(matter.get('client') or '')])]
        if any(len(a) >= 3 and re.search(r'(?<!\w)' + re.escape(a) + r'(?!\w)', text) for a in aliases):
            found.add('shared' if len(role['lead']) > 1 else 'alone')
    if not found:
        return None
    return 'mixed' if len(found) > 1 else found.pop()
