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
    """Bind each unit's FIRST source review to the text the construction produced.

    A unit whose text or evidence changed before that first review needed a
    correction of the original construction: it is resolved as not first-pass,
    never left unassessed and never credited with its post-repair verdict.
    """
    updated = copy.deepcopy(report or {})
    initial = updated.get('first_pass_quality', {})
    if 'units' not in initial:
        return updated
    checks = result.get('checks', {})
    for unit in units:
        saved = initial['units'].get(unit['field'])
        if not saved or saved.get('first_review') or saved['checks']:
            continue
        if saved['hash'] == unit['hash']:
            saved['checks'] = {key: checks[key]['status'] for key in saved['obligation_ids']}
            saved['first_review'] = 'original'
        else:
            saved['first_review'] = 'corrected_before_review'
            saved['post_correction_checks'] = {o['id']: checks[o['id']]['status'] for o in unit.get('obligations', []) if o['id'] in checks}
    # Records written before this field existed keep their original meaning.
    for saved in initial['units'].values():
        if saved['checks'] and not saved.get('first_review'):
            saved['first_review'] = 'original'
    original = [u for u in initial['units'].values() if u.get('first_review') == 'original']
    corrected = [u for u in initial['units'].values() if u.get('first_review') == 'corrected_before_review']
    statuses = [s for u in original for s in u['checks'].values()]
    total = sum(len(u['obligation_ids']) for u in initial['units'].values())
    needed_correction = sum(len(u['obligation_ids']) for u in corrected)
    assessed = len(statuses) + needed_correction
    complete = bool(total) and len(original) + len(corrected) == len(initial['units'])
    clean = sum(1 for u in original if u['checks'] and all(s == 'met' for s in u['checks'].values()))
    initial.update(total=total, assessed=assessed, met=statuses.count('met'), failed=statuses.count('failed'),
                   corrected_before_review=needed_correction, unassessed=total-assessed,
                   units_total=len(initial['units']), units_first_pass=clean,
                   units_corrected_before_review=len(corrected),
                   status='complete' if complete else 'partial')
    # A partial review cannot produce a flattering first-pass percentage, and an
    # obligation whose unit was corrected before review does not count as met.
    initial['percent_met'] = round(100 * statuses.count('met') / total, 2) if complete else None
    initial['unit_percent_first_pass'] = round(100 * clean / len(initial['units']), 2) if complete else None
    return updated
