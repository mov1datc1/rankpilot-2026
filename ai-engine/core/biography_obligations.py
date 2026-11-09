"""Locate BIO proof defects without generating text or changing source evidence."""
from collections import Counter


def norm(value):
    return ' '.join(str(value or '').split()).casefold()


def personal_bindings(package, candidate):
    from core.editorial_development import bind_quote
    from core.role_evidence import matter_names_person
    register = {m['id']: m for m in (package or {}).get('matters', [])}
    links = candidate.get('submission_case_coverage', [])
    support = {m.get('matter_id') for m in candidate.get('supporting_matters', [])}
    result = []
    for i, link in enumerate(links):
        mid = link.get('matter_id'); matter = register.get(mid, {})
        quote = norm(link.get('public_quote')); issues = []
        if package is not None and (mid not in support or not matter_names_person(candidate.get('name'), matter) or not bind_quote(link.get('source_quote'), matter)):
            issues.append('invalid_own_source')
        if not quote or quote not in norm(candidate.get('submission_bio')):
            issues.append('output_quote_absent')
        duplicates = [f'S{j+1:02d}' for j, other in enumerate(links)
                      if j != i and quote and quote == norm(other.get('public_quote'))]
        if duplicates: issues.append('duplicate_output_quote')
        if sum(other.get('matter_id') == mid for other in links) > 1:
            issues.append('duplicate_matter_binding')
        result.append({'reference': f'S{i+1:02d}', 'matter_id': mid,
                       'source_binding_path': f'current_value.submission_case_coverage/{i}',
                       'issues': issues, 'duplicate_with': duplicates,
                       'current_output_quote': link.get('public_quote', '')})
    return result


def biography_faults(package, strategy, proposal, index):
    """Stable, located postconditions for transactional acceptance, not a judge."""
    from core.public_privacy import public_privacy_findings
    from core.editorial_execution import missing_head_bios
    from core.personal_quality import required_personal_matters, personal_quality_errors
    from core.candidate_evidence import profile_errors, category_error
    from core.editorial_development import submission_voice_paths
    from core.role_evidence import identity
    candidate = proposal['candidates'][index]; faults = []
    for binding in personal_bindings(package, candidate):
        for issue in binding['issues']:
            faults.append({'code': issue, 'reference': binding['reference'],
                           'matter_id': binding['matter_id'], 'duplicate_with': binding['duplicate_with'],
                           'rejected_output_quote': binding['current_output_quote'] if issue=='output_quote_absent' else None})
    linked = {x.get('matter_id') for x in candidate.get('submission_case_coverage', [])}
    if proposal.get('personal_quality_contract') == 'complete-personal-case-v1':
        faults.extend({'code': 'required_matter_missing', 'matter_id': mid}
                      for mid in required_personal_matters(package, strategy, candidate) if mid not in linked)
    path = f'candidates/{index}/submission_bio'
    if path in submission_voice_paths(proposal):
        from core.editorial_voice import voice_matches
        faults.append({'code':'submission_voice','rejected_output_quote':voice_matches(candidate.get('submission_bio',''))})
    faults.extend({'code': 'confidential_public_metrics', 'matter_id': f['matter_id']}
                  for f in public_privacy_findings(package, strategy, proposal) if f['path'] == path)
    if index in missing_head_bios(package, proposal): faults.append({'code': 'confirmed_head_missing'})
    person = next((p for p in package.get('lawyers', [])
                   if identity(p.get('name') or p.get('fullName')) == identity(candidate.get('name'))), {})
    faults.extend({'code': 'profile_evidence', 'detail': error} for error in profile_errors(person, candidate))
    if category_error(candidate): faults.append({'code': 'category', 'detail': category_error(candidate)})
    prefix = f'Calidad personal candidates/{index}:'
    faults.extend({'code': 'personal_quality', 'detail': error} for error in personal_quality_errors(package, strategy, proposal)
                  if error.startswith(prefix))
    return faults


def new_biography_faults(package, strategy, before, after, index):
    import json
    # S keys are presentation positions: deleting an invalid full-candidate
    # binding may shift them. Compare defects by stable source identity.
    signature = lambda f: json.dumps({k: v for k, v in f.items() if k not in ('reference', 'duplicate_with', 'rejected_output_quote')}, sort_keys=True)
    old = Counter(signature(f) for f in biography_faults(package, strategy, before, index))
    new = []
    for fault in biography_faults(package, strategy, after, index):
        key = signature(fault)
        if old[key]: old[key] -= 1
        else: new.append(fault)
    return new


def enrich_biography_targets(package, proposal, targets):
    """Attach exact references after parent/child composition, on every attempt."""
    import re
    for path, target in targets.items():
        if not re.fullmatch(r'candidates/\d+', path): continue
        candidate = proposal['candidates'][int(path.split('/')[1])]
        from core.biography_depth import depth_recovery_obligation
        depth = depth_recovery_obligation(proposal, int(path.split('/')[1]))
        if depth:
            target['depth_recovery'] = depth
        else:
            target.pop('depth_recovery', None)
        if candidate.get('biography_depth') is not None and 'submission_bio' in target.get('mutable_fields', []):
            target['mutable_fields'] = list(dict.fromkeys([*target['mutable_fields'], 'biography_depth']))
        bindings = personal_bindings(package, candidate)
        target['personal_binding_obligations'] = bindings
        target['public_biography_policy'] = (
            'This is PUBLIC B9. Use distinct legal issues, actions and supported outcomes from each own mandate. '
            'Do not use confidential client identities, workforce/proceeding counts or case amounts to differentiate contributions. '
            'Private figures stay in section E. A repeated public_quote must be repaired for ALL listed duplicate references; '
            'each S key must keep its exact matter_id and original source binding, regardless of sentence order. '
            'Copy each output quote from the actual corrected BIO. Never shift quotations onto the next source. '
            'A missing or duplicated generated quote is not a missing source and does not justify removing supported work.')
        invalid = {norm(x['current_output_quote']) for x in bindings if x['issues']}
        rejected = [norm(q) for q in target.get('rejected_quotes', []) if norm(q)]
        for key in ('preserve_generated_quotes', 'preserve_profile_quotes'):
            if key in target:
                target[key] = [q for q in target[key] if norm(q) not in invalid
                               and not any(bad in norm(q) or norm(q) in bad for bad in rejected)]
    return targets
