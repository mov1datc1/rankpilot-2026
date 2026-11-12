"""One source-owned slot per reserve, shared by planning and partial recovery.

Coverage is internal. Choosing what belongs in the executive Audit is a separate
decision and never removes an obligation to compare a reserve with the core.
"""
import copy
from typing import Literal
from pydantic import ConfigDict, Field, create_model

VERSION = 'reserve-comparison-slots-v1'
MISSING_ERROR = 'Faltan comparaciones de reservas frente a su alternativa pertinente del núcleo.'
INSTRUCTION = '''Cover EVERY supplied reserve exactly once internally, against its
closest relevant selected alternative, using the original legal work, outcomes,
qualifications and comparable scale. In each tradeoff, state concrete legal
mechanisms, positive scope/scale and documented status (ongoing/completed) for
BOTH the selected matter and the reserve, and never reference uninvolved third
matters. Do not compare every reserve only with the hero. Return each supplied comparison slot; the application owns its reserve ID.
Select audit_comparison_references only for material borderline comparisons that
the client should see (at least one across the complete plan). Other comparisons
remain internal, not omitted. Visibility in the Audit is not coverage of the plan.
Do not change selection, source facts, personal decisions or valid comparisons.'''


def bindings(strategy, only=None):
    reserves = [d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') == 'reserve']
    return {f'R{i+1:02d}': mid for i, mid in enumerate(reserves) if only is None or mid in only}


def missing(strategy, comparisons):
    covered = {c.get('alternative_id') for c in comparisons}
    return [mid for mid in bindings(strategy).values() if mid not in covered]


def coverage_errors(strategy, comparisons):
    errors = [MISSING_ERROR] if missing(strategy, comparisons) else []
    alternatives = [c.get('alternative_id') for c in comparisons]
    reserves = set(bindings(strategy).values())
    core = {d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') == 'core'}
    if len(alternatives) != len(set(alternatives)):
        errors.append('Una reserva aparece más de una vez en las comparaciones.')
    if any(c.get('alternative_id') not in reserves or c.get('selected_id') not in core for c in comparisons):
        errors.append('La comparación debe vincular una reserva con una alternativa del núcleo seleccionado.')
    return errors


def bundle_fields(comparison, strategy, owned, existing_visible=False):
    core = [d['matter_id'] for d in strategy['matters'] if d['disposition'] == 'core']
    if owned and not core:
        raise ValueError('Reserve comparisons require a selected portfolio')
    quote = create_model('OwnedReserveComparison', __config__=ConfigDict(extra='forbid'), **{
        **{k: (f.annotation, copy.deepcopy(f)) for k, f in comparison.model_fields.items()
           if k not in ('alternative_id', 'selected_id', 'audit_required')},
        'selected_id': (Literal[tuple(core)] if core else str, Field(description='Closest relevant selected source; never a reserve or excluded matter.'))})
    slots = create_model('AllRequiredReserveComparisons', __config__=ConfigDict(extra='forbid'), **{
        key: (quote, Field(description='Required internal comparison for original reserve '+mid)) for key, mid in owned.items()})
    ref = Literal[tuple(owned)] if owned else str
    return {'comparisons': (slots, ...), 'audit_comparison_references':
            (list[ref], Field(min_length=0 if existing_visible or not owned else 1,
                             max_length=len(owned), description='Material borderline slots to show in Audit; the remaining slots are still required internally.'))}


def plan_schema(legacy, strategy):
    comparison = legacy.model_fields['comparisons'].annotation.__args__[0]
    return create_model('SharedEditorialPlan', __config__=ConfigDict(extra='forbid'), **{
        **{k: (f.annotation, copy.deepcopy(f)) for k, f in legacy.model_fields.items() if k != 'comparisons'},
        **bundle_fields(comparison, strategy, bindings(strategy))})


def completion_schema(legacy, strategy, owned, preserved):
    comparison = legacy.model_fields['comparisons'].annotation.__args__[0]
    return create_model('MissingReserveComparisons', __config__=ConfigDict(extra='forbid'),
                        **bundle_fields(comparison, strategy, owned,
                                        existing_visible=any(c.get('audit_required', True) for c in preserved)))


def expand(value, owned):
    visible = set(value['audit_comparison_references'])
    return [{'alternative_id': mid, **value['comparisons'][key], 'audit_required': key in visible}
            for key, mid in owned.items()]


def expand_plan(value, strategy):
    result = copy.deepcopy(value)
    result['comparisons'] = expand(result, bindings(strategy))
    result.pop('audit_comparison_references')
    return result
