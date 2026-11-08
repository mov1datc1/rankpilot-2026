"""One scoped recheck of malformed reviewer items, never of document prose.

Valid checks, acceptance decisions and verdict fields cannot be emitted by this
request. The merged diagnostic must still pass the complete original schema and
all downstream source/Word gates. Unknown or incomplete responses do not enter.
"""
import copy
import json
from typing import get_args, get_origin
from pydantic import ConfigDict, Field, ValidationError, create_model


def validate_diagnostic_bindings(schema, value, payload):
    """Locate malformed evidence items before buying any whole-review retry."""
    from core.register_review import register_defects, register_rows
    from core.outcome_qualification import grounded_outcome_qualification
    package = payload.get('package') or {}; errors = []
    if package.get('rendered_artifact'):
        rows = register_rows(package); checks = value.get('register_checks') or {}
        entries = checks.items() if isinstance(checks, dict) else enumerate(checks)
        for key, check in entries:
            mid = key if isinstance(checks, dict) else check.get('matter_id')
            if mid not in rows:
                continue  # The full cardinality/identity gate still follows.
            try:
                register_defects({**package, 'matters': [rows[mid]]}, [{**check, 'matter_id': mid}])
            except ValueError as error:
                errors.append({'type': 'value_error', 'loc': ('register_checks', key), 'input': check, 'ctx': {'error': error}})
    for index, defect in enumerate(value.get('defects') or []):
        if not isinstance(defect,dict):continue
        if defect.get('conflict_resolution') == 'qualify_disputed_outcome' and not grounded_outcome_qualification(
            defect, package, {'development': payload.get('development') or package.get('editorial_development'), 'letter': payload.get('letter', {})}):
            errors.append({'type': 'value_error', 'loc': ('defects', index), 'input': defect,
                'ctx': {'error': ValueError('review diagnostic not grounded: outcome qualification lacks own source or exact claim')}})
    if errors:
        raise ValidationError.from_exception_data(schema.__name__, errors)


def diagnostic_plan(schema, value, error):
    if not isinstance(value, dict):
        return None
    locations = {}
    for issue in error.errors():
        loc = issue.get('loc', ())
        if len(loc) < 2 or loc[0] not in ('case_checks', 'register_checks', 'defects'):
            return None
        root, key = loc[:2]
        annotation = schema.model_fields[root].annotation
        if isinstance(value.get(root), dict) and hasattr(annotation, 'model_fields'):
            if key not in annotation.model_fields:
                return None
            item_type = annotation.model_fields[key].annotation
        elif isinstance(value.get(root), list) and isinstance(key, int) and 0 <= key < len(value[root]) and get_origin(annotation) is list:
            item_type = get_args(annotation)[0]
        else:
            return None
        locations[(root, key)] = item_type
    if not locations or len(locations) > 8:
        return None
    fields = {}; targets = {}
    for index, ((root, key), item_type) in enumerate(locations.items()):
        ref = f'T{index + 1:02d}'
        entry = create_model('DiagnosticItem' + str(index), __config__=ConfigDict(extra='forbid'),
            value=(item_type, ...), reason=(str, Field(min_length=1)))
        fields[ref] = (entry, ...)
        allowed=getattr(getattr(item_type,'model_fields',{}).get('source_ref'),'annotation',None)
        source_refs=[member.value for member in allowed] if hasattr(allowed,'__members__') else []
        targets[ref] = {'root': root, 'key': key, 'allowed_source_refs':source_refs, 'current': copy.deepcopy(value[root].get(key) if isinstance(value[root], dict) else value[root][key])}
    items = create_model('MalformedReviewerItems', __config__=ConfigDict(extra='forbid'), **fields)
    return create_model('ScopedDiagnosticRecheck', __config__=ConfigDict(extra='forbid'), repairs=(items, ...)), targets


def scoped_diagnostic_context(payload, targets):
    package = payload.get('package') or {}; development = payload.get('development') or package.get('editorial_development') or {}
    obligations = {item['id']: item for item in payload.get('case_obligations', [])}
    contexts = {}
    for ref, target in targets.items():
        current = target['current'] or {}; root = target['root']; key = target['key']
        if root == 'case_checks' and key in obligations:
            obligation = copy.deepcopy(obligations[key]); path = obligation['field']
            output = payload.get('letter', {}).get(path) if path in ('leadership', 'evidence_gaps', 'executive_assessment') else development
            if isinstance(output, dict):
                try:
                    for part in path.split('/'):
                        output = output[int(part)] if isinstance(output, list) else output[part]
                except (KeyError, IndexError, TypeError):
                    output = ''
            contexts[ref] = {'obligation': obligation, 'current_output_field': output}
        else:
            mid = key if root == 'register_checks' else current.get('matter_id')
            matters = [m for m in package.get('matters', []) if m.get('id') == mid]
            # Without an addressable original, a cheap repair is not justified.
            if not matters:
                return None
            contexts[ref] = {'own_original_matters': matters,
                'rendered_artifact': package.get('rendered_artifact'), 'rendered_audit': package.get('rendered_audit')}
    allowed={ref for target in targets.values() for ref in target.get('allowed_source_refs',[])}
    return {'targets': targets, 'contexts': contexts, 'source_passages': {ref:text for ref,text in payload.get('source_passages', {}).items() if ref in allowed}}


def repair_diagnostic(state, schema, value, error, payload, trace, invoke):
    plan = diagnostic_plan(schema, value, error)
    if plan is None:
        return None
    contract, targets = plan
    context = scoped_diagnostic_context(payload, targets)
    if context is None or len(json.dumps(context, ensure_ascii=False)) > 100000:
        return None
    result, new_trace = invoke({**state, 'trace': trace, 'diagnostic_recheck': True},
        'diagnostic_reviewer', contract,
        'Independently recheck ONLY these malformed diagnostic items against their own original evidence and exact generated output. '
        'Return each required replacement and its source-to-output reason. This request cannot edit documents, sources, other checks, '
        'acceptance, the overall passed value, selection or categories. Do not replace a real finding with a warning merely to validate. '
        'Preserve every material finding actually supported; if the supplied evidence cannot support an alleged claim, describe that '
        'accurately in the replacement. Choose own-source and output passage IDs where required. Full original validation and release gates follow.',
        context)
    try:
        result = contract.model_validate(result).model_dump(mode='json')
        fixed = copy.deepcopy(value)
        for ref, target in targets.items():
            fixed[target['root']][target['key']] = result['repairs'][ref]['value']
        fixed = schema.model_validate(fixed).model_dump(mode='json')
        validate_diagnostic_bindings(schema, fixed, payload)
    except Exception as merge_error:
        merge_error.trace_history=new_trace
        raise
    if new_trace:
        new_trace[-1]['diagnostic_recheck'] = {'items': len(targets), 'full_review_repeated': False,
            'acceptance_preserved': fixed.get('acceptance') == value.get('acceptance'),
            'overall_verdict_preserved': fixed.get('passed') == value.get('passed')}
    return fixed, new_trace
