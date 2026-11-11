"""Measure checks on the original construction without counting repaired text as first-pass success.

This is telemetry, never a release gate or a new model call. Source-field checks
are only a subset of whole-document quality; Audit/pair consistency is later.
"""
import copy


def initial_quality(state):
    from core.field_review import units_for
    try:
        units = units_for(state)
    except ValueError:
        return {'scope': 'development_source_field_obligations_only', 'status': 'unmeasurable',
                'reason': 'Original construction has an incomplete field/source contract.'}
    return {'scope': 'development_source_field_obligations_only', 'target_percent': 90,
            'status': 'awaiting_review', 'units': {u['field']: {'hash': u['hash'],
                'obligation_ids': [o['id'] for o in u['obligations']], 'checks': {}} for u in units},
            'whole_document_quality': 'not_measured'}


def record_first_review(report, units, result):
    updated = copy.deepcopy(report or {})
    initial = updated.get('first_pass_quality', {})
    if 'units' not in initial:
        return updated
    for unit in units:
        saved = initial['units'].get(unit['field'])
        if not saved or saved['hash'] != unit['hash'] or saved['checks']:
            continue
        checks = result.get('checks', {})
        saved['checks'] = {key: checks[key]['status'] for key in saved['obligation_ids']}
    statuses = [s for u in initial['units'].values() for s in u['checks'].values()]
    total = sum(len(u['obligation_ids']) for u in initial['units'].values())
    initial.update(total=total, assessed=len(statuses), met=statuses.count('met'), failed=statuses.count('failed'),
                   unassessed=total-len(statuses), status='complete' if total and len(statuses)==total else 'partial')
    # A partial review cannot produce a flattering first-pass percentage.
    initial['percent_met'] = round(100 * statuses.count('met') / total, 2) if total and len(statuses)==total else None
    return updated
