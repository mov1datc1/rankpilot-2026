"""Migrate one known legacy repair method into the shared field ledger.

The old initial correction and its residual calls are one targeted method.
An explicit continuation may use source reconstruction once, under the same
job allowance. No original, selection, paid trace or prior method is reset.
"""
def resume_legacy_development(state):
    from core.editorial_repair import repair_targets, repair_development, unknown_repair_usage
    report=state.get('repair_report') or {}
    failed=report.get('failed_paths') or []
    eligible=(state.get('development_reusable') and state.get('selection_validated')
        and state.get('selection_review_validated') and not state.get('legacy_field_recovery_report')
        and not state.get('field_review_receipts') and not state.get('field_review_attempts')
        and not state.get('field_review_failures') and not unknown_repair_usage(state.get('trace',[]))
        and report.get('surgical_retries')==1 and failed and not report.get('unresolved'))
    if not eligible:
        return {'development_validated':False,'development_repair_unlocatable':True,
            'legacy_development_recovery':False,'repair_continuation':None,
            'errors':['La recuperación de la redacción anterior no está disponible para este intento.']}
    targets=repair_targets(state['package'],state['strategy'],state['development'])
    if not targets:
        return {'development_validated':False,'development_repair_unlocatable':True,
            'legacy_development_recovery':False,'repair_continuation':None,
            'errors':['La redacción anterior no tiene una corrección localizada pendiente.']}
    # Parent candidate targets already contain their BIO descendant. Count one
    # shared field method, not two allowances for different path spellings.
    canonical=lambda p:'/'.join(p.split('/')[:2]) if p.startswith('candidates/') else p
    old={canonical(p) for p in report.get('corrected_paths',[])+failed+report.get('retry_paths',[])}
    attempts={canonical(p):2 if canonical(p) in old else 1 for p in targets}
    current={**state,'repair_strategy':'source_reconstruction','field_review_attempts':attempts}
    result=repair_development(current,state['development'],targets)
    return {**result,'legacy_development_recovery':False,'repair_strategy':'source_reconstruction',
        'field_review_attempts':attempts,
        'legacy_field_recovery_report':{'version':'legacy-targeted-to-reconstruction-v1',
            'prior_method':'targeted_correction','method':'source_reconstruction',
            'fields':sorted(targets),'prior_failed_paths':failed,'prior_trace_count':len(state.get('trace',[]))}}
