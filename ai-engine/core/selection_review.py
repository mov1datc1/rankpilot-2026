"""Independent source-to-decision review before any selected matter is developed."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, create_model
from core.editorial_development import bind_quote


class DecisionCheck(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['supported', 'repair_required']
    explanation: str = Field(description='Brief source-based reason; identify a concrete false premise or omitted decisive evidence, not a stylistic preference.')
    source_quote: str = Field(description='For repair_required, one contiguous source quote proving the error. Empty allowed for supported.')


def review_selection(state, invoke):
    matters = state['package']['matters']
    refs = {f'M{i+1:02d}': m for i, m in enumerate(matters)}
    reverse = {m['id']: ref for ref, m in refs.items()}
    checks = create_model('EveryDecisionReview', __config__=ConfigDict(extra='forbid'),
                          **{ref: (DecisionCheck, ...) for ref in refs})
    schema = create_model('SelectionReview', checks=(checks, ...))
    proposal, trace = invoke(state, 'selection_reviewer', schema, '''Independently test EVERY selection decision, including reserves and exclusions, against the original source, not merely against its quote. Return a check for every reference. Verify that legal_understanding accurately represents asset/transaction, legal problem, work, outcome versus pending relief and practice nexus. A literal quote can coexist with a false rationale. Reject a property/development mandate mislabeled tax, or a transaction recast as litigation. Industry, monetary size, client name or procedural forum alone cannot establish practice fit. Check that borderline selected matters have defensible incremental value over stronger source-backed reserves. Do not require your preferred order or a fixed count: flag only a concrete unsupported premise, lost decisive evidence or contradictory decision. Identify its exact source quote and a precise corrective explanation in Spanish. No new facts, no demands for missing optional data, no questions to the user about mistakes made by RankPilot. Keep supported explanations under 20 words; repair explanations under 80 words.''',
        {'scope': {k: state['package'].get(k) for k in ('directory','practice_area','jurisdiction')},
         'lawyers': state['package'].get('lawyers', []),
         'matters': [{**m, 'id': ref} for ref, m in refs.items()],
         'strategy': {**state['strategy'], 'matters': [{**d, 'matter_id': reverse[d['matter_id']]} for d in state['strategy']['matters']],
                      'hero_matter_id': reverse.get(state['strategy'].get('hero_matter_id'))}})
    result = schema.model_validate(proposal).model_dump()
    errors = []
    for ref, check in result['checks'].items():
        if check['status'] == 'repair_required':
            matter = refs[ref]
            quote = bind_quote(check['source_quote'], matter)
            if not quote:
                errors.append('La revisión de la selección debe justificar su hallazgo con una cita de la fuente.')
            else:
                check['source_quote'] = quote
                errors.append(f"Revisar la interpretación de {matter.get('client') or matter['id']}: {check['explanation']}")
    result['checks'] = {refs[ref]['id']: check for ref, check in result['checks'].items()}
    return {'selection_review': result, 'selection_review_validated': not errors, 'selection_review_unavailable':False, 'selection_review_deferred':False,
            'selection_validated': not errors, 'errors': errors, 'trace': trace,
            'selection_review_attempts': state.get('selection_review_attempts', 0) + 1,
            'selection_feedback': {'strategy': state['strategy'], 'errors': errors, 'semantic_rejection': bool(errors)}}
