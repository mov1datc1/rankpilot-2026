"""Independent source-to-decision review before any selected matter is developed."""
import re
import hashlib
import json
import copy
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, create_model
from core.editorial_development import bind_quote, literal_quote
from utils.review_policy import APPLICATION_RULES, bind_application_rule


SELECTION_REASONING = '''Separate source facts from editorial decisions and application constraints. The application permits at most 20 core matters; that maximum and remaining capacity are configuration, not facts that need a client-source quotation. Capacity alone never establishes legal merit or requires filling a slot. Evaluate the entire current decision, including legal_understanding, before alleging an omission: do not report as absent work or deliverables it already describes. Distinguish a conditional recommendation to strengthen evidence from a factual assertion that the existing evidence does not exist. A reserve can have concrete deliverables and still contribute less differentiated legal work than selected matters. Optional missing outcomes, values, dates or permission do not alone require exclusion when the documented work and confidential route support delivery.'''
SELECTION_REASONING += ''' For a concrete false comparative premise (unique, distinct or incremental capability), use evidence_kind=portfolio_comparison and comparison_reference for the OTHER original matter. Quote that other matter's actual source in source_quote and THIS questioned decision's exact comparative premise in decision_quote. Do not use a peer source to challenge this matter's standalone facts, attribute a peer outcome to it, or ask for your preferred ordering. For an own-source factual error use evidence_kind=source and comparison_reference=null. Application_rule and supported also require comparison_reference=null. Every comparative rejection still needs an explicit bound source for the questioned decision itself.'''


def bind_decision_quote(value, decision, fields=('rationale', 'legal_understanding', 'disposition')):
    """A rejection must identify words in this decision, never another one."""
    quote = ' '.join(literal_quote(value).split())
    if not quote:
        return ''
    for field in fields:
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


COMPARATIVE_PREMISE=re.compile(r'\b(?:incremental|distinct|unique|differentiated|compared|than|additional|overlap|duplicates?|relative|stronger|weaker|less|more|comparativ[aeo]|diferenciad[oa]|distint[oa]|adicional)\b',re.I)


def resolve_declared_comparison(check, target_ref, refs, decisions):
    """Recover an explicit Mxx proof address, never infer a comparative fact.

    Legacy diagnostics lacked a comparison type. Their own explanation may
    already identify the peer. Rebind that address only when both original
    sources, the target premise and the uniquely quoted peer are unambiguous.
    Ordinary source errors and unlabeled foreign quotations remain invalid.
    """
    if check.get('evidence_kind')!='source' or check.get('comparison_reference') or check.get('rule_id') or check.get('rule_quote'):
        return
    target=refs[target_ref];decision=decisions.get(target['id'],{})
    if (not COMPARATIVE_PREMISE.search(check.get('decision_quote',''))
        or not bind_decision_quote(check.get('decision_quote'),decision)
        or not bind_quote(decision.get('source_quote',''),target)
        or bind_selection_review_quote(check.get('source_quote'),target)):
        return
    declared=set(re.findall(r'\bM\d{2,}\b',check.get('explanation','').upper()))-{target_ref}
    matches=[ref for ref,m in refs.items() if ref!=target_ref and m['id'] in decisions
             and bind_selection_review_quote(check.get('source_quote'),m)]
    if len(matches)==1 and matches[0] in declared:
        check.update(evidence_kind='portfolio_comparison',comparison_reference=matches[0],
                     evidence_kind_original='source',comparison_reference_recovered=True)


def can_repair_selection(state):
    """Permit new failures or a strict shrinking residual within the same cap."""
    if state.get('selection_review_unavailable') or state.get('selection_diagnostic_invalid') or state.get('selection_review_attempts', 0) >= 3 or state.get('selection_repair_attempts', 0) >= 2:
        return False
    history = state.get('selection_failure_history', [])
    if not history or not history[-1]:
        return False
    previous = {mid for batch in history[:-1] for mid in batch}
    current=set(history[-1])
    return (not previous.intersection(current)
            or (len(history)>1 and current < set(history[-2])))


def can_recheck_selection_diagnostic(state):
    """One known invalid verdict may be reviewed again within the SAME cap."""
    def unknown(trace):
        return (bool((trace.get('usage') or {}).get('unknown_calls'))
                or trace.get('usage_status') in ('unknown','partial_unknown')
                or any(unknown(call) for call in trace.get('calls', [])))
    return (state.get('selection_diagnostic_invalid') is True
            and not state.get('selection_review_deferred')
            and state.get('selection_diagnostic_rechecks', 0) < 1
            and state.get('selection_review_attempts', 0) < 3
            and not any(unknown(trace) for trace in state.get('trace', [])))


class DecisionCheck(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['supported', 'repair_required', 'advisory']
    explanation: str = Field(description='Brief evidence-based reason; identify a concrete false premise or omitted decisive evidence, not a stylistic preference.')
    source_quote: str = Field(description='For source-based repair_required, one contiguous original source quote proving the error. Empty for application_rule and supported.')
    decision_quote: str = Field(default='', description='For repair_required, exact contiguous words from THIS decision rationale, legal_understanding or disposition that contain the false premise. For an omission, quote the affected rationale and first check the entire decision. Never translate or reconstruct a quotation. Empty for supported.')
    evidence_kind: Literal['source', 'application_rule', 'portfolio_comparison'] = Field(default='source', description='Source tests this matter own facts. Portfolio_comparison tests an explicit relative/incremental premise against another identified original matter, never assigns its facts to this matter. Application_rule tests only a supplied application constraint.')
    comparison_reference: str | None = Field(default=None, description='Only for portfolio_comparison: the exact Mxx reference of the OTHER matter whose original source_quote challenges this decision comparative premise. Null for source, application_rule and supported.')
    rule_id: Literal['restricted_confidential_delivery'] | None = None
    rule_quote: str = Field(default='', description='For application_rule only: exact statement from application_rules. source_quote must be empty. Never quote serialized application metadata as original source evidence.')
    correction_dispositions: list[Literal['core','reserve','excluded']] = Field(default_factory=list, max_length=3,
        description='For a bound repair_required that requires changing disposition, all source-defensible dispositions that resolve this defect. Empty when prose/fact correction can suffice. Never prescribe a preferred ordering or fill a quota.')
    review_dependencies: list[str] = Field(default_factory=list,
        description='Other Mxx decisions whose source or disposition affects this check, including every peer used for a supported comparison. Empty for a standalone own-source decision.')


def selection_proof_fingerprint(state, mid, check):
    """Bind a passing check to its exact sources, decision and dependencies."""
    package=state['package'];register={m['id']:m for m in package['matters']}
    decisions={d['matter_id']:d for d in state['strategy']['matters']}
    dependencies=set(check.get('review_dependencies',[]))
    decision=decisions.get(mid,{})
    # An undeclared comparative dependency is conservatively portfolio-wide.
    if not dependencies and COMPARATIVE_PREMISE.search(str(decision.get('rationale',''))+' '+str(decision.get('legal_understanding',''))):
        dependencies=set(register)-{mid}
    payload={'contract':'selection-proof-v1','scope':{k:package.get(k) for k in
             ('directory','practice_area','jurisdiction','delivery_policy','lawyers')},
             'rules':APPLICATION_RULES,'thesis':state['strategy'].get('thesis'),
             'hero':state['strategy'].get('hero_matter_id'),
             'inputs':[(key,register.get(key),decisions.get(key)) for key in sorted(dependencies|{mid})]}
    return hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False,default=str).encode()).hexdigest()


def review_selection(state, invoke):
    matters = state['package']['matters']
    refs = {f'M{i+1:02d}': m for i, m in enumerate(matters)}
    reverse = {m['id']: ref for ref, m in refs.items()}
    previous=state.get('selection_review_proofs',{})
    reused={mid:copy.deepcopy(proof['check']) for mid,proof in previous.items()
            if mid in reverse and proof.get('check',{}).get('status') in ('supported','advisory')
            and proof.get('fingerprint')==selection_proof_fingerprint(state,mid,proof['check'])}
    active={ref:m for ref,m in refs.items() if m['id'] not in reused}
    if not active:
        return {'selection_review':{'checks':reused},'selection_review_validated':True,
                'selection_validated':True,'errors':[],'trace':[],
                'selection_review_unavailable':False,'selection_diagnostic_invalid':False,
                'selection_review_deferred':False,
                'selection_review_reused_ids':list(reused)}
    check_contract=create_model('ReferencedDecisionCheck',__base__=DecisionCheck,
                                comparison_reference=(Literal[tuple(refs)] | None,None),
                                review_dependencies=(list[Literal[tuple(refs)]],Field(default_factory=list)))
    checks = create_model('EveryDecisionReview', __config__=ConfigDict(extra='forbid'),
                          **{ref: (check_contract, ...) for ref in active})
    schema = create_model('SelectionReview', checks=(checks, ...))
    proposal, trace = invoke(state, 'selection_reviewer', schema, SELECTION_REASONING + ''' Independently test every reference listed in review_targets, including reserves and exclusions, against the original source, not merely against its quote. Other matters are comparison context, not new review targets. Return only the required schema keys. Declare all review_dependencies for comparisons, including supported ones. Use advisory for internal follow-up on optional dates or unexplained amounts when the decision does not rely on their meaning and does not assert a false concept; preserve the uncertainty for the Audit without blocking selection. An omitted decisive amount underpinning selection, an invented economic meaning or a false outcome remains repair_required. Verify that legal_understanding accurately represents asset/transaction, legal problem, work, outcome versus pending relief and practice nexus. A literal quote can coexist with a false rationale. Reject a property/development mandate mislabeled tax, or a transaction recast as litigation. Industry, monetary size, client name or procedural forum alone cannot establish practice fit. Check that borderline selected matters have defensible incremental value over stronger source-backed reserves. Do not require your preferred order or a fixed count: flag only a concrete unsupported premise, lost decisive evidence or contradictory decision. For a source-based error, identify the exact affected decision_quote and its exact original source_quote. If the disposition itself contradicts the documented practice/client-side thesis or a supplied constraint, set correction_dispositions to ALL source-defensible dispositions resolving that precise defect; exclude the present disposition only when changing it is necessary. A textual disclaimer cannot cure a rejected inclusion decision. For ordinary factual/prose defects, supported decisions or a mere ordering preference, leave correction_dispositions empty. Missing optional evidence alone does not require demotion. For an error applying restricted confidential delivery, set evidence_kind=application_rule, use the supplied rule_id and exact rule_quote, and leave source_quote empty. Never treat serialized routing metadata as original client evidence or use an application rule as evidence of legal facts. Provide a precise corrective explanation in Spanish. No new facts, no demands for missing optional data, no questions to the user about mistakes made by RankPilot. Keep supported explanations under 20 words; repair explanations under 80 words.''',
        {'scope': {k: state['package'].get(k) for k in ('directory','practice_area','jurisdiction')},
         'delivery_policy': state['package'].get('delivery_policy'),
         'application_rules': APPLICATION_RULES,
         'review_targets':list(active),
         **({'previous_invalid_diagnostic': {'checks':state.get('selection_review',{}).get('checks',{}),
             'instruction':'Reassess the SAME unchanged decisions. Correct the diagnosis and its evidence type or quote; never invent a quotation or treat an application rule as a client fact. Recheck all decisions independently.'}}
            if state.get('selection_diagnostic_invalid') else {}),
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
            resolve_declared_comparison(check,ref,refs,decisions)
            if check['evidence_kind'] == 'application_rule':
                quote = '' if check['source_quote'] or check['comparison_reference'] else bind_application_rule(check['rule_id'], check['rule_quote'], matter, state['package'])
            elif check['evidence_kind']=='portfolio_comparison':
                other=refs.get(check['comparison_reference'])
                decision=decisions.get(matter['id'],{})
                # The reviewer explicitly declares the comparison and peer. Bind its
                # literal prose and both sources; a keyword list cannot decide
                # whether a grounded comparison may enter repair. Disposition
                # alone is not a comparative premise. Legacy inference above
                # retains its stricter lexical guard.
                comparative=bool(bind_decision_quote(check['decision_quote'],decision,
                    fields=('rationale','legal_understanding')))
                target_bound=bind_quote(decision.get('source_quote',''),matter)
                quote=bind_selection_review_quote(check['source_quote'],other) if (
                    other and other['id']!=matter['id'] and other['id'] in decisions
                    and comparative and target_bound and not check['rule_id'] and not check['rule_quote']) else ''
                if quote:check['comparison_matter_id']=other['id']
            else:
                quote = '' if check['rule_id'] or check['rule_quote'] or check['comparison_reference'] else bind_selection_review_quote(check['source_quote'], matter)
            decision_quote = bind_decision_quote(check['decision_quote'], decisions.get(matter['id'], {}))
            check['evidence_bound'] = bool(quote and decision_quote)
            if not quote or not decision_quote:
                diagnostics_bound = False
                errors.append('La revisión de la selección debe vincular su hallazgo con la fuente y con la decisión exacta que cuestiona.')
            else:
                check['rule_quote' if check['evidence_kind']=='application_rule' else 'source_quote'] = quote
                check['decision_quote'] = decision_quote
                errors.append(f"Revisar la interpretación de {matter.get('client') or matter['id']}: {check['explanation']}")
    result['checks'] = {refs[ref]['id']: check for ref, check in result['checks'].items()}
    for check in result['checks'].values():
        check['review_dependencies']=[refs[ref]['id'] for ref in check.get('review_dependencies',[])]
    result['checks']={**reused,**result['checks']}
    proofs={mid:{'check':copy.deepcopy(check),'fingerprint':selection_proof_fingerprint(state,mid,check)}
            for mid,check in result['checks'].items() if check['status']=='supported' or (
                check['status']=='advisory' and bind_selection_review_quote(check.get('source_quote'),next(m for m in matters if m['id']==mid)))}
    failed = {mid:c for mid,c in result['checks'].items() if c['status']=='repair_required'}
    # Unbound diagnoses must not buy a correction or become a passing review.
    bound = diagnostics_bound
    history = list(state.get('selection_failure_history', [])) + [sorted(failed) if bound else []]
    return {'selection_review': result, 'selection_review_validated': not errors, 'selection_review_unavailable':not diagnostics_bound, 'selection_diagnostic_invalid':not diagnostics_bound, 'selection_review_deferred':False,
            'selection_review_proofs':proofs,'selection_review_reused_ids':list(reused),
            'selection_advisories':[{**check,'matter_id':mid} for mid,check in result['checks'].items()
                if check['status']=='advisory' and bind_selection_review_quote(check.get('source_quote'),next(m for m in matters if m['id']==mid))],
            'selection_diagnostic_rechecks':state.get('selection_diagnostic_rechecks',0)+int(bool(state.get('selection_diagnostic_invalid'))),
            'selection_failure_history': history,
            'selection_validated': not errors, 'errors': errors, 'trace': trace,
            'selection_review_attempts': state.get('selection_review_attempts', 0) + 1,
            'selection_feedback': {'strategy': state['strategy'], 'errors': errors, 'semantic_rejection': bool(errors) and diagnostics_bound,'failed_checks':failed}}


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
    if feedback.get('field_only'):
        return repair_selection_fields(state,invoke,previous,failed,register,ids)
    from core.review_graph import Disposition
    # A local correction still consumes the GLOBAL portfolio capacity. Separate
    # core corrections in the transport schema so a reserve cannot silently
    # become the 21st selected matter while unaffected decisions stay locked.
    unchanged_core=[d for d in previous['matters'] if d['matter_id'] not in ids and d['disposition']=='core']
    capacity=max(0,20-len(unchanged_core))
    # A prose/fact diagnosis is not permission to reselect the portfolio.
    # Changing disposition requires an explicit, source-bound review constraint.
    current={d['matter_id']:d['disposition'] for d in previous['matters']}
    allowed={mid:set(failed[mid].get('correction_dispositions') or (current[mid],)) for mid in ids}
    core_ids=tuple(mid for mid in ids if 'core' in allowed[mid])
    core_decision=create_model('SelectedDecisionCorrection',__base__=Disposition,
        matter_id=(Literal[core_ids or ids],...),disposition=(Literal['core'],...))
    other_decision=create_model('UnselectedDecisionCorrection',__base__=Disposition,
        matter_id=(Literal[ids],...),disposition=(Literal['reserve','excluded'],...))
    schema=create_model('BoundedSelectionRepair',
        core_corrections=(list[core_decision],Field(max_length=min(capacity,len(core_ids)))),
        other_corrections=(list[other_decision],Field(max_length=len(ids))),unresolved=(list[str],...))
    result,trace=invoke(state,'strategist',schema,
        SELECTION_REASONING + ' Correct ONLY the supplied rejected selection decisions against original sources. Resolve the decision the diagnosis rejects, not merely its wording: if inclusion contradicts the evidenced portfolio thesis, a disclaimer retaining that inclusion is not a correction. Respect allowed_dispositions for each target: an empty or absent correction_dispositions locks its current disposition; do not ask for optional evidence when a faithful reserve decision is already possible. Preserve every unaffected decision, portfolio order and hero. Do not regenerate the portfolio. Respect portfolio_constraints: core_corrections share only the remaining capacity after unchanged cores. Capacity bookkeeping controls the schema only: never copy remaining slots or a quota into rationale or legal_understanding. Justify legal contribution on its own merits. Return each rejected ID exactly once across core_corrections and other_corrections. A request to correct a reserve rationale does NOT require promotion. Compare its legal contribution with the supplied unchanged-core context and the other rejected decisions; retain reserve with a defensible comparative rationale when appropriate. Any promotion must fit remaining capacity, including a source-backed demotion among the rejected decisions when necessary; never demote an unaffected matter or the hero to make space. Pending publication permission does not itself justify reserve or exclusion when confidential delivery is available. A contradiction in source outcomes is not permission to invent a reconciliation or claim an unqualified victory: distinguish documented procedural work from the unresolved final outcome, and say what remains uncertain in the internal rationale. Do not discard relevant work solely because optional information is missing. Correct a false practice classification when supported. Keep each matter_id exact; quote one contiguous source passage from that matter. If the final outcome is genuinely ambiguous, qualify that outcome explicitly while retaining the undisputed legal work and report the source uncertainty in unresolved; a qualified correction is still required. Leave corrections absent only if no faithful decision can be formulated. Corrections remain subject to the same independent semantic review.',
        {'scope':{k:state['package'].get(k) for k in ('directory','practice_area','jurisdiction')},
         'delivery_policy': state['package'].get('delivery_policy'),
         'application_rules': APPLICATION_RULES,
         'portfolio_constraints':{'core_limit':20,'unchanged_core_count':len(unchanged_core),'correction_core_capacity':capacity,'hero_matter_id':previous.get('hero_matter_id')},
         'unchanged_core_context':unchanged_core,
         'allowed_dispositions':{mid:sorted(allowed[mid]) for mid in ids},
         'failed_checks':failed,'sources':[register[mid] for mid in ids],
         'comparison_sources':[register[mid] for mid in dict.fromkeys(
             c.get('comparison_matter_id') for c in failed.values() if c.get('evidence_kind')=='portfolio_comparison') if mid in register],
         'rejected_decisions':[d for d in previous['matters'] if d['matter_id'] in ids]})
    # Validate even when an alternate caller bypasses invoke_role's schema gate.
    result=schema.model_validate(result).model_dump()
    proposed=result['core_corrections']+result['other_corrections']
    fixed=copy.deepcopy(previous);corrections={d['matter_id']:d for d in proposed}
    if set(corrections)!=set(ids) or len(corrections)!=len(proposed):
        return {'strategy':previous,'errors':['RankPilot debe completar la corrección de las decisiones señaladas; las demás se conservan.'],'trace':trace,'selection_validated':False}
    if any(d['disposition'] not in allowed[d['matter_id']] for d in proposed):
        return {'strategy':previous,'errors':['La corrección debe resolver la decisión señalada, además de su redacción.'],
                'trace':trace,'selection_validated':False,'selection_repair_attempts':state.get('selection_repair_attempts',0)+1}
    fixed['matters']=[corrections.get(d['matter_id'],d) for d in previous['matters']]
    core=[d['matter_id'] for d in fixed['matters'] if d['disposition']=='core']
    if fixed.get('hero_matter_id') not in core:
        return {'strategy':previous,'errors':['La corrección requiere revisar el Hero Matter; se conserva la selección anterior.'],'trace':trace,'selection_validated':False}
    return {'strategy':fixed,'errors':[],'trace':trace,'selection_repair_attempts':state.get('selection_repair_attempts',0)+1,'selection_repair_report':{'corrected_matter_ids':list(corrections),'unaffected_decisions_preserved':True,'source_uncertainties':result.get('unresolved',[])}}


def repair_selection_fields(state,invoke,previous,failed,register,ids):
    """Repair only located generated quotes/rationales, never portfolio or sources."""
    import copy
    targets={(mid,path) for mid in ids for path in failed[mid]['field_paths']}
    correction=create_model('SelectionFieldCorrection',matter_id=(Literal[ids],...),
        field_path=(Literal['rationale','source_quote'],...),text=(str,Field(min_length=1)))
    schema=create_model('SelectionFieldRepairs',corrections=(list[correction],Field(min_length=len(targets),max_length=len(targets))))
    result,trace=invoke(state,'strategist',schema,
        'Correct ONLY the identified field_paths against their own original sources. '
        'Preserve legal contribution and all unaffected fields. For source_quote copy one contiguous exact '
        'passage of the SAME source that substantiates this decision; never fabricate or borrow evidence. '
        'For rationale use exact source amounts/currencies or omit a nonessential numeric restatement '
        'while retaining the legal rationale. Never change disposition, hero, order or legal understanding. '
        'Return each identified matter_id/field_path pair exactly once. This correction requires the '
        'unchanged grounding gate and independent source-to-decision review; it grants no approval.',
        {'failed_checks':failed,'sources':[register[mid] for mid in ids],
         'rejected_decisions':[d for d in previous['matters'] if d['matter_id'] in ids]})
    result=schema.model_validate(result).model_dump()
    patches={(p['matter_id'],p['field_path']):p['text'] for p in result['corrections']}
    attempts=state.get('selection_repair_attempts',0)+1
    if set(patches)!=targets or len(patches)!=len(result['corrections']):
        return {'strategy':previous,'errors':['La corrección debe cubrir cada campo señalado una sola vez.'],
                'trace':trace,'selection_validated':False,'selection_repair_attempts':attempts}
    fixed=copy.deepcopy(previous)
    for decision in fixed['matters']:
        for path in ('rationale','source_quote'):
            key=(decision['matter_id'],path)
            if key in patches:decision[path]=patches[key]
    return {'strategy':fixed,'errors':[],'trace':trace,'selection_repair_attempts':attempts,
            'selection_repair_report':{'corrected_matter_ids':list(ids),
                'field_paths':sorted({path for _,path in targets}),
                'unaffected_decisions_preserved':True,'portfolio_preserved':True}}
