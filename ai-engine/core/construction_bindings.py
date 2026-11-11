"""Compile source-owned bindings before prose, rather than asking a writer to recreate them.

Only canonical source IDs/quotes are projected by code. The model still owns the
editorial interpretation, entity relationship, public prose and truthful output
citations; the existing validators and independent review remain authoritative.
"""
import copy
from pydantic import ConfigDict, Field, create_model

VERSION = 'source-owned-construction-bindings-v1'


def complete_plan_support(package, strategy, plan):
    from core.personal_quality import required_personal_matters
    from core.participation_contract import participation_requirement
    from core.editorial_development import bind_quote
    from core.role_evidence import role_names_person_exactly
    register = {m['id']: m for m in package.get('matters', [])}
    result = copy.deepcopy(plan)
    for candidate in result.get('candidates', []):
        support = candidate['supporting_matters']
        existing = {s['matter_id'] for s in support}
        # These are canonical lead records, not inferred individual actions.
        for mid in required_personal_matters(package, strategy, candidate):
            if mid in existing:
                continue
            matter = register[mid]
            quote = next((str(matter.get(k)) for k in ('leadPartner', 'lead_partner') if matter.get(k) and role_names_person_exactly(candidate['name'], matter.get(k))), '')
            if not bind_quote(quote, matter):
                raise ValueError('Canonical lead record has no literal source: ' + mid)
            support.append({'matter_id': mid, 'source_quote': quote,
                'personal_role': 'Recorded lead responsibility for this mandate. Specific personal acts and firm outcomes remain distinct and must be read in the original source.'})
            existing.add(mid)
        participation = participation_requirement(package, strategy, candidate)
        if participation and not any(s['matter_id'] in existing for s in participation['sources']):
            source = participation['sources'][0]
            support.append({**source, 'personal_role': 'Documented team membership only; not evidence of personal leadership or achieved results.'})
    return result


def biography_bindings(package, strategy, candidate):
    from core.candidate_evidence import profile_units
    from core.role_evidence import identity
    from core.personal_quality import required_personal_matters
    from core.participation_contract import participation_requirement
    from core.editorial_execution import personal_argument_requirement, primary_lead_anchor
    person = next(p for p in package.get('lawyers', []) if identity(p.get('name') or p.get('fullName')) == identity(candidate['name']))
    required = set(required_personal_matters(package, strategy, candidate))
    anchor = primary_lead_anchor(package, strategy, candidate)
    if anchor:
        required.add(anchor)
    support = candidate.get('supporting_matters', [])
    participation = participation_requirement(package, strategy, candidate)
    if participation:
        allowed = {s['matter_id'] for s in participation['sources']}
        required.update(next(([s['matter_id']] for s in support if s['matter_id'] in allowed), []))
    # Distinct-contribution requirements and full material coverage are separate.
    # Mark mandatory records explicitly; optional support may remain unused.
    return {'version': VERSION, 'profile_units': profile_units(person),
        'minimum_distinct_cases': personal_argument_requirement(package, candidate),
        'case_sources': {f'M{i+1:02d}': {**copy.deepcopy(s), 'required': s['matter_id'] in required}
                         for i, s in enumerate(support)}}


def biography_schema(candidate_model, bindings):
    from core.candidate_evidence import ProfileCoverage
    def strict(name, fields):
        return create_model(name, __config__=ConfigDict(extra='forbid'), **fields)
    # All original units are required keys; several entities can share a unit.
    entity = strict('OwnedProfileEntity', {k: (f.annotation, copy.deepcopy(f))
        for k, f in ProfileCoverage.model_fields.items() if k not in ('reference', 'source_quote')})
    profiles = strict('OriginalProfileUnits', {u['reference']: (list[entity], Field(min_length=1,
        description='Account for all entities/credentials in original unit '+u['reference']+'. Source and reference are inserted by the application.'))
        for u in bindings['profile_units']})
    cases = strict('OwnedPersonalMandates', {key: (str if source['required'] else str | None,
        Field(min_length=1, description='Exact passage from this B9 executing mandate '+source['matter_id']+
            ('. Mandatory source-supported contribution/participation.' if source['required'] else '. Null only when this optional mandate is not used.')))
        for key, source in bindings['case_sources'].items()})
    return strict('OwnedBiography', {
        **{k: (candidate_model.model_fields[k].annotation, copy.deepcopy(candidate_model.model_fields[k]))
           for k in ('submission_bio', 'biography_depth')},
        'profile_coverage': (profiles, ...), 'submission_case_coverage': (cases, ...)})


def expand_biography(value, bindings):
    result = copy.deepcopy(value)
    result['profile_coverage'] = [{**entity, 'reference': unit['reference'], 'source_quote': unit['source_quote']}
        for unit in bindings['profile_units'] for entity in value['profile_coverage'][unit['reference']]]
    result['submission_case_coverage'] = [
        {'matter_id': source['matter_id'], 'source_quote': source['source_quote'], 'public_quote': value['submission_case_coverage'][key]}
        for key, source in bindings['case_sources'].items() if value['submission_case_coverage'][key] is not None]
    return result


def institutional_schema(full, plan):
    from core.editorial_execution import InstitutionalLink
    quote = create_model('OwnedInstitutionalArgument', __config__=ConfigDict(extra='forbid'), **{
        k: (f.annotation, copy.deepcopy(f)) for k, f in InstitutionalLink.model_fields.items() if k != 'argument_index'})
    links = create_model('SharedInstitutionalArguments', __config__=ConfigDict(extra='forbid'), **{
        f'A{i+1:02d}': (quote, Field(description=argument['proposition']))
        for i, argument in enumerate(plan.get('institutional_arguments', []))})
    return create_model('InstitutionalProse', __config__=ConfigDict(extra='forbid'), **{
        **{k: (full.model_fields[k].annotation, copy.deepcopy(full.model_fields[k])) for k in ('b10', 'c2')},
        'institutional_execution': (links, ...)})


def expand_institutional(value, plan):
    return {**value, 'institutional_execution': [
        {'argument_index': i, **value['institutional_execution'][f'A{i+1:02d}']}
        for i in range(len(plan.get('institutional_arguments', [])))]}


def privacy_register(package):
    # Match the original fields accepted by profile_privacy_error, including
    # historical resolved routes and registered name/title variants.
    keys = ('id', 'client', 'name', 'title', 'publication_route',
            'resolved_publication_status', 'publish_status', 'confidentialityEvidence')
    return [{k: copy.deepcopy(m[k]) for k in keys if k in m} for m in package.get('matters', [])]


def matter_bindings(evidence_plan):
    return {f'M{i+1:02d}': {'matter_id': m['matter_id'], 'anchors': {
        'issue': m['legal_issue_source_quote'],
        **{f'evidence_{j+1:02d}': q for j, q in enumerate(m['decisive_source_quotes'])}}}
        for i, m in enumerate(evidence_plan)}


def matter_schema(matter_model, bindings):
    fields = {}
    for key, source in bindings.items():
        proofs = create_model('MatterAnchorPassages_'+key, __config__=ConfigDict(extra='forbid'), **{
            ref: (str, Field(min_length=1, description='Exact passage in this narrative executing original anchor '+ref+'. Public restrictions require safe generalisation, not disclosure.'))
            for ref in source['anchors']})
        unit = create_model('SourceOwnedMatter_'+key, __config__=ConfigDict(extra='forbid'), **{
            **{k: (matter_model.model_fields[k].annotation, copy.deepcopy(matter_model.model_fields[k])) for k in ('text','completion_status')},
            'anchor_execution': (proofs, ...)})
        fields[key] = (unit, Field(description='Write only original matter '+source['matter_id']))
    items = create_model('CanonicalMatterSlots', __config__=ConfigDict(extra='forbid'), **fields)
    return create_model('MatterNarratives', __config__=ConfigDict(extra='forbid'), matters=(items, ...))


def expand_matters(value, bindings):
    from core.editorial_execution import norm
    matters = []; receipts = []
    for key, source in bindings.items():
        unit = value['matters'][key]
        for ref, quote in unit['anchor_execution'].items():
            bound = bool(norm(quote) and norm(quote) in norm(unit['text']))
            receipts.append({'matter_id': source['matter_id'], 'anchor': ref,
                'source_quote': source['anchors'][ref], 'output_quote': quote,
                'binding_verified': bound, 'semantic_review': 'pending'})
        matters.append({'matter_id': source['matter_id'], 'text': unit['text'], 'completion_status': unit['completion_status']})
    return {'matters': matters}, receipts
