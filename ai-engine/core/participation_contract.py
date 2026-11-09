"""One source-derived membership obligation for drafting, repair and review.

Membership and personally achieved legal work are different evidence classes.
This module never upgrades one to the other or resolves a name alias.
"""
from hashlib import sha256
from core.role_evidence import identity, team_listing_quote, role_names_person_exactly

VERSION = 'sourced-participation-v1'
INSTRUCTION = (
    'Preserve source-confirmed team participation in this public BIO, using a '
    'generalised description of the mandate and an explicit participation role. '
    'One supported participation is sufficient for a limited profile; do not '
    'invent leadership, personal legal responsibility, achieved results, seniority '
    'or a nomination. Do not publish restricted client identities or identifying '
    'metrics. Bind the actual BIO passage to the exact original team listing in '
    'submission_case_coverage and supporting_matters. Missing individual detail '
    'is optional internal follow-up, not a question needed to finish this profile.'
)


def participation_sources(package, strategy, name):
    eligible = {d['matter_id'] for d in strategy.get('matters', [])
                if d.get('disposition') in ('core', 'reserve')}
    register = {m['id']: m for m in package.get('matters', [])}
    result = []
    # Canonical order, never an incidental order of model-generated citations.
    for decision in strategy.get('matters', []):
        mid = decision.get('matter_id'); matter = register.get(mid, {})
        if mid not in eligible:
            continue
        for field in ('teamMembers', 'team_members'):
            quote = str(matter.get(field) or '').strip()
            if quote and team_listing_quote(name, quote, matter):
                result.append({'matter_id': mid, 'source_quote': quote})
                break
    return result


def participation_requirement(package, strategy, candidate):
    from core.editorial_execution import public_bio_included, personal_argument_requirement, primary_lead_anchor
    if (not public_bio_included(package, candidate)
        or candidate.get('recommendation') == 'present'
        or personal_argument_requirement(package, candidate)
        or primary_lead_anchor(package, strategy, candidate)):
        return None
    sources = participation_sources(package, strategy, candidate.get('name'))
    if not sources:
        return None
    return {'id': 'participation:' + sha256(identity(candidate.get('name')).encode()).hexdigest()[:16],
            'version': VERSION, 'evidence_kind': 'team_membership',
            'owner': 'rankpilot', 'minimum_bindings': 1, 'sources': sources,
            'instruction': INSTRUCTION}


def participation_link(package, candidate, link):
    matter = next((m for m in package.get('matters', []) if m.get('id') == link.get('matter_id')), {})
    # An exact lead attribution retains its stronger contribution obligation.
    if any(role_names_person_exactly(candidate.get('name'), matter.get(k))
           for k in ('leadPartner', 'lead_partner')):
        return False
    return team_listing_quote(candidate.get('name'), link.get('source_quote'), matter)


def participation_errors(package, strategy, candidate):
    obligation = participation_requirement(package, strategy, candidate)
    if not obligation:
        return []
    norm = lambda value: ' '.join(str(value or '').split())
    allowed = {s['matter_id'] for s in obligation['sources']}
    support = {s.get('matter_id') for s in candidate.get('supporting_matters', [])}
    for link in candidate.get('submission_case_coverage', []):
        if (link.get('matter_id') in allowed & support
            and participation_link(package, candidate, link)
            and norm(link.get('public_quote'))
            and norm(link['public_quote']) in norm(candidate.get('submission_bio'))):
            return []
    return ['B9 omite el vínculo de participación documentada: ' + obligation['id']
            + '. ' + INSTRUCTION]
