"""Separate complete document assembly from exhausted editorial checks.

An internal citation/coverage failure is retained, never converted into a
successful review. The exact Word pair still receives independent review.
"""

def retain_complete_development(state, result=None):
    from core.editorial_development import development_contract, development_errors, _norm
    from core.editorial_repair import unknown_repair_usage
    from core.field_review import method_count
    from core.public_privacy import public_privacy_findings

    current={**state,**(result or {})}
    if (result is not None and not result.get('errors')) or (result is None and not state.get('delivery_observations_requested')):
        return None
    report=current.get('repair_report') or {}
    failed=report.get('failed_paths') or []
    if (current.get('repair_continuation')
        or not current.get('selection_validated') or not current.get('selection_review_validated')
        or not current.get('development_reusable') or report.get('unresolved')
        or not failed or any(method_count(current.get('field_review_attempts',{}),p)<2 for p in failed)
        or unknown_repair_usage(current.get('trace',[]))):
        return None
    package=current['package'];strategy=current['strategy'];proposal=current['development']
    try:
        # Registered identities and serialisable fields are mandatory even
        # when editorial checks remain observations.
        development_contract(package,strategy).model_validate(proposal)
        core=[m['matter_id'] for m in strategy['matters'] if m['disposition']=='core']
        ids=[m['matter_id'] for m in proposal['matters']]
        names=[_norm(c['name']) for c in proposal['candidates']]
        roster=[_norm(p.get('name') or p.get('fullName')) for p in package.get('lawyers',[])]
        if (not core or len(ids)!=len(set(ids)) or set(ids)!=set(core)
            or len(names)!=len(set(names)) or set(names)!=set(roster)
            or any(not str(proposal.get(k) or '').strip() for k in ('b10','c2'))
            or any(not m['text'].strip() for m in proposal['matters'])
            or any(not c['submission_bio'].strip() for c in proposal['candidates'])
            or public_privacy_findings(package,strategy,proposal)):
            return None
        findings=development_errors(package,strategy,proposal)
    except (ValueError,TypeError,KeyError,AttributeError):
        return None
    if not findings:return None
    return {**(result or {}),'development':proposal,'development_validated':False,
        'development_delivery_ready':True,'development_repair_unlocatable':False,
        'development_observations':list(dict.fromkeys(findings)),
        'repair_continuation':None,'errors':[]}
