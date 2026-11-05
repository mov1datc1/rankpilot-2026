"""Independent source-to-decision review before any selected matter is developed."""
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, create_model
from core.editorial_development import bind_quote, literal_quote


SELECTION_REASONING = '''Separate source facts from editorial decisions and application constraints. The application permits at most 20 core matters; that maximum and remaining capacity are configuration, not facts that need a client-source quotation. Capacity alone never establishes legal merit or requires filling a slot. Evaluate the entire current decision, including legal_understanding, before alleging an omission: do not report as absent work or deliverables it already describes. Distinguish a conditional recommendation to strengthen evidence from a factual assertion that the existing evidence does not exist. A reserve can have concrete deliverables and still contribute less differentiated legal work than selected matters. Optional missing outcomes, values, dates or permission do not alone require exclusion when the documented work and confidential route support delivery.'''


def bind_decision_quote(value, decision):
    """A rejection must identify words in this decision, never another one."""
    quote = ' '.join(literal_quote(value).split())
    if not quote:
        return ''
    for field in ('rationale', 'legal_understanding', 'disposition'):
        text = str(decision.get(field) or '')
        if quote.casefold() in ' '.join(text.split()).casefold():
            return quote
    return ''


def bind_selection_review_quote(value, matter):
    """Bind a diagnostic to its narrative or its own original client-register row.

    A register row is evidence for a review finding, not a substitute for the
    legal-work quote required from a selector. Never borrow another client's row
    or accept a model reconstruction of cells as if it were the original.
    """
    bound = bind_quote(value, matter)
    if bound:
        return bound
    norm = lambda text: ' '.join(str(text or '').split()).casefold()
    client_name = lambda text: norm(re.sub(r'^(?:client|cliente)\s*:\s*', '', str(text or ''), flags=re.I))
    client = client_name(matter.get('client'))
    quote = norm(literal_quote(value))
    if not client or not quote:
        return ''
    for row in (matter.get('confidentialityEvidence') or {}).get('client_register', []):
        original = row.get('quote')
        if (isinstance(original, str) and client_name(row.get('client')) == client
                and norm(original) == quote):
            return original
    return ''


def can_repair_selection(state):
    """Permit a new evidenced failure, never loop on an unchanged failed matter."""
    if state.get('selection_review_unavailable') or state.get('selection_review_attempts', 0) >= 3:
        return False
    history = state.get('selection_failure_history', [])
    if not history or not history[-1]:
        return False
    previous = {mid for batch in history[:-1] for mid in batch}
    return not previous.intersection(history[-1])


class DecisionCheck(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['supported', 'repair_required']
    explanation: str = Field(description='Brief source-based reason; identify a concrete false premise or omitted decisive evidence, not a stylistic preference.')
    source_quote: str = Field(description='For repair_required, one contiguous source quote proving the error. Empty allowed for supported.')
    decision_quote: str = Field(default='', description='For repair_required, exact contiguous words from THIS decision rationale, legal_understanding or disposition that contain the false premise. For an omission, quote the affected rationale and first check the entire decision. Never translate or reconstruct a quotation. Empty for supported.')


def review_selection(state, invoke):
    matters = state['package']['matters']
    refs = {f'M{i+1:02d}': m for i, m in enumerate(matters)}
    reverse = {m['id']: ref for ref, m in refs.items()}
    checks = create_model('EveryDecisionReview', __config__=ConfigDict(extra='forbid'),
                          **{ref: (DecisionCheck, ...) for ref in refs})
    schema = create_model('SelectionReview', checks=(checks, ...))
    proposal, trace = invoke(state, 'selection_reviewer', schema, SELECTION_REASONING + ''' Independently test EVERY selection decision, including reserves and exclusions, against the original source, not merely against its quote. Return a check for every reference. Verify that legal_understanding accurately represents asset/transaction, legal problem, work, outcome versus pending relief and practice nexus. A literal quote can coexist with a false rationale. Reject a property/development mandate mislabeled tax, or a transaction recast as litigation. Industry, monetary size, client name or procedural forum alone cannot establish practice fit. Check that borderline selected matters have defensible incremental value over stronger source-backed reserves. Do not require your preferred order or a fixed count: flag only a concrete unsupported premise, lost decisive evidence or contradictory decision. Identify both the exact affected decision_quote and its exact source quote, then a precise corrective explanation in Spanish. No new facts, no demands for missing optional data, no questions to the user about mistakes made by RankPilot. Keep supported explanations under 20 words; repair explanations under 80 words.''',
        {'scope': {k: state['package'].get(k) for k in ('directory','practice_area','jurisdiction')},
         'portfolio_constraints': {'core_limit': 20, 'minimum_core_count': None, 'fill_quota': False},
         'lawyers': state['package'].get('lawyers', []),
         'matters': [{**m, 'id': ref} for ref, m in refs.items()],
         'strategy': {**state['strategy'], 'matters': [{**d, 'matter_id': reverse[d['matter_id']]} for d in state['strategy']['matters']],
                      'hero_matter_id': reverse.get(state['strategy'].get('hero_matter_id'))}})
    result = schema.model_validate(proposal).model_dump()
    errors = []
    diagnostics_bound = True
    decisions = {d['matter_id']: d for d in state['strategy']['matters']}
    for ref, check in result['checks'].items():
        if check['status'] == 'repair_required':
            matter = refs[ref]
            quote = bind_selection_review_quote(check['source_quote'], matter)
            decision_quote = bind_decision_quote(check['decision_quote'], decisions.get(matter['id'], {}))
            if not quote or not decision_quote:
                diagnostics_bound = False
                errors.append('La revisión de la selección debe vincular su hallazgo con la fuente y con la decisión exacta que cuestiona.')
            else:
                check['source_quote'] = quote
                check['decision_quote'] = decision_quote
                errors.append(f"Revisar la interpretación de {matter.get('client') or matter['id']}: {check['explanation']}")
    result['checks'] = {refs[ref]['id']: check for ref, check in result['checks'].items()}
    failed = {mid:c for mid,c in result['checks'].items() if c['status']=='repair_required'}
    # Unbound diagnoses must not buy a correction or become a passing review.
    bound = diagnostics_bound
    history = list(state.get('selection_failure_history', [])) + [sorted(failed) if bound else []]
    return {'selection_review': result, 'selection_review_validated': not errors, 'selection_review_unavailable':not diagnostics_bound, 'selection_review_deferred':False,
            'selection_failure_history': history,
            'selection_validated': not errors, 'errors': errors, 'trace': trace,
            'selection_review_attempts': state.get('selection_review_attempts', 0) + 1,
            'selection_feedback': {'strategy': state['strategy'], 'errors': errors, 'semantic_rejection': bool(errors),'failed_checks':failed}}


def repair_selection(state, invoke):
    """Repair rejected decisions only; retain every unaffected decision verbatim."""
    import copy
    feedback=state.get('selection_feedback',{})
    previous=feedback.get('strategy') or state['strategy']
    failed=feedback.get('failed_checks') or {
        mid:check for mid,check in state.get('selection_review',{}).get('checks',{}).items()
        if check.get('status')=='repair_required'}
    if not failed:return None
    register={m['id']:m for m in state['package']['matters']}
    ids=tuple(d['matter_id'] for d in previous['matters'] if d['matter_id'] in failed and d['matter_id'] in register)
    if not ids:return None
    from core.review_graph import Disposition
    # A local correction still consumes the GLOBAL portfolio capacity. Separate
    # core corrections in the transport schema so a reserve cannot silently
    # become the 21st selected matter while unaffected decisions stay locked.
    unchanged_core=[d for d in previous['matters'] if d['matter_id'] not in ids and d['disposition']=='core']
    capacity=max(0,20-len(unchanged_core))
    core_decision=create_model('SelectedDecisionCorrection',__base__=Disposition,
        matter_id=(Literal[ids],...),disposition=(Literal['core'],...))
    other_decision=create_model('UnselectedDecisionCorrection',__base__=Disposition,
        matter_id=(Literal[ids],...),disposition=(Literal['reserve','excluded'],...))
    schema=create_model('BoundedSelectionRepair',
        core_corrections=(list[core_decision],Field(max_length=capacity)),
        other_corrections=(list[other_decision],Field(max_length=len(ids))),unresolved=(list[str],...))
    result,trace=invoke(state,'strategist',schema,
        SELECTION_REASONING + ' Correct ONLY the supplied rejected selection decisions against original sources. Preserve every unaffected decision, portfolio order and hero. Do not regenerate the portfolio. Respect portfolio_constraints: core_corrections share only the remaining capacity after unchanged cores. Capacity bookkeeping controls the schema only: never copy remaining slots or a quota into rationale or legal_understanding. Justify legal contribution on its own merits. Return each rejected ID exactly once across core_corrections and other_corrections. A request to correct a reserve rationale does NOT require promotion. Compare its legal contribution with the supplied unchanged-core context and the other rejected decisions; retain reserve with a defensible comparative rationale when appropriate. Any promotion must fit remaining capacity, including a source-backed demotion among the rejected decisions when necessary; never demote an unaffected matter or the hero to make space. Pending publication permission does not itself justify reserve or exclusion when confidential delivery is available. A contradiction in source outcomes is not permission to invent a reconciliation or claim an unqualified victory: distinguish documented procedural work from the unresolved final outcome, and say what remains uncertain in the internal rationale. Do not discard relevant work solely because optional information is missing. Correct a false practice classification when supported. Keep each matter_id exact; quote one contiguous source passage from that matter. If the final outcome is genuinely ambiguous, qualify that outcome explicitly while retaining the undisputed legal work and report the source uncertainty in unresolved; a qualified correction is still required. Leave corrections absent only if no faithful decision can be formulated. Corrections remain subject to the same independent semantic review.',
        {'scope':{k:state['package'].get(k) for k in ('directory','practice_area','jurisdiction')},
         'portfolio_constraints':{'core_limit':20,'unchanged_core_count':len(unchanged_core),'correction_core_capacity':capacity,'hero_matter_id':previous.get('hero_matter_id')},
         'unchanged_core_context':unchanged_core,
         'failed_checks':failed,'sources':[register[mid] for mid in ids],
         'rejected_decisions':[d for d in previous['matters'] if d['matter_id'] in ids]})
    # Validate even when an alternate caller bypasses invoke_role's schema gate.
    result=schema.model_validate(result).model_dump()
    proposed=result['core_corrections']+result['other_corrections']
    fixed=copy.deepcopy(previous);corrections={d['matter_id']:d for d in proposed}
    if set(corrections)!=set(ids) or len(corrections)!=len(proposed):
        return {'strategy':previous,'errors':['RankPilot debe completar la corrección de las decisiones señaladas; las demás se conservan.'],'trace':trace,'selection_validated':False}
    fixed['matters']=[corrections.get(d['matter_id'],d) for d in previous['matters']]
    core=[d['matter_id'] for d in fixed['matters'] if d['disposition']=='core']
    if fixed.get('hero_matter_id') not in core:
        return {'strategy':previous,'errors':['La corrección requiere revisar el Hero Matter; se conserva la selección anterior.'],'trace':trace,'selection_validated':False}
    return {'strategy':fixed,'errors':[],'trace':trace,'selection_repair_report':{'corrected_matter_ids':list(corrections),'unaffected_decisions_preserved':True,'source_uncertainties':result.get('unresolved',[])}}
