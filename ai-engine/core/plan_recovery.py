"""Resolve a rejected shared plan without stopping the case or looping on spend.

Three layers, in order:

1. exact_fixes: the application already knows the right answer (selected matter
   IDs, roster, additional leaders, literal source passages, plan version,
   duplicate or foreign comparisons). It applies it; no model call.
2. expectations: for what needs editorial judgement, the single correction
   request states exactly what is wrong and what a valid answer must contain.
3. safe_fallbacks: if the correction still leaves a fault, a conservative,
   source-bound default is used and recorded as an observation. The case keeps
   moving; later field review and the final review still judge the prose.

Nothing here invents facts: every default quotes an already validated selection
decision or a literal original passage, and every change is recorded.
"""
import copy
import re

VERSION = 'plan-recovery-v1'


def _core(strategy):
    return [d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') == 'core']


def _reserves(strategy):
    return [d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') == 'reserve']


def _decision(strategy, matter_id):
    return next((d for d in strategy.get('matters', []) if d.get('matter_id') == matter_id), {})


def _roster(package):
    return [p.get('name') or p.get('fullName') for p in package.get('lawyers', []) if p.get('name') or p.get('fullName')]


def _bound(quote, matter):
    from core.editorial_development import bind_quote
    return bind_quote(quote, matter) if quote else None


def _selection_quote(strategy, register, matter_id):
    """The selection's own source quote, already validated as literal."""
    return _bound(_decision(strategy, matter_id).get('source_quote', ''), register.get(matter_id, {}))


def _record_quote(matter):
    """First literal sentence of the record itself: an exact, own-source passage."""
    from core.editorial_development import NARRATIVE_SOURCE_FIELDS
    for field in NARRATIVE_SOURCE_FIELDS:
        for sentence in re.split(r'(?<=[.!?])\s+|\n+', str(matter.get(field) or '')):
            sentence = sentence.strip()
            if len(sentence.split()) >= 4:
                bound = _bound(sentence, matter)
                if bound:
                    return bound
    return None


def _fallback_quote(strategy, register, matter_id, *preferred):
    """Selection quote, then an already bound plan quote, then the record itself."""
    matter = register.get(matter_id, {})
    for quote in (_selection_quote(strategy, register, matter_id), *preferred):
        bound = _bound(quote, matter) if quote else None
        if bound:
            return bound
    return _record_quote(matter)


def plan_errors(package, strategy, plan):
    from core.editorial_construction import validate_plan
    try:
        validate_plan(package, strategy, plan)
        return []
    except ValueError as error:
        return [e for e in str(error).split('; ') if e]


def _fallback_candidate(package, name):
    from core.role_evidence import identity
    person = next((p for p in package.get('lawyers', []) if identity(p.get('name') or p.get('fullName')) == identity(name)), {})
    current = str(person.get('currentRank') or person.get('current_ranking') or 'Not verified')
    return {'name': name, 'recommendation': 'develop', 'current_ranking': current,
            'suggested_ranking': 'Category pending',
            'category_rationale': 'Category pending: the shared plan did not establish a defensible category for this person.',
            'category_missing_criterion': 'A specific directory category supported by this person\'s career stage and personally attributed work.',
            'category_assessment': {'decision': 'pending', 'criterion': 'pending', 'career_stage_evidence': [], 'growth_evidence': [],
                'career_stage_assessment': 'Not assessed in the shared plan; based on the supplied profile only.',
                'alternative_category': 'Category pending',
                'alternative_comparison': 'No category is proposed until its criterion is established.',
                'counterevidence': 'Not assessed in the shared plan.'},
            'why_candidate': 'Included in the supplied roster; personal case to be built from their attributed mandates.',
            'supporting_matters': [], 'external_evidence': 'No verified external ranking evidence.',
            'evidence_gaps': 'Category criterion not yet established.',
            'recommended_action': 'Confirm the applicable category and the personal contribution in the attributed mandates.'}


def exact_fixes(package, strategy, plan):
    """Apply every correction whose right answer the application already knows."""
    from core.editorial_case import CASE_VERSION, additional_leaders
    from core.role_evidence import identity
    from core.reserve_comparisons import bindings
    register = {m['id']: m for m in package.get('matters', [])}
    result = copy.deepcopy(plan)
    fixes = []
    # Plan version is an application constant.
    case = result.setdefault('case_plan', {})
    if isinstance(case, dict) and case.get('version') != CASE_VERSION:
        case['version'] = CASE_VERSION
        fixes.append({'fix': 'case_plan_version'})
    # Matters: exactly the selected core, each once, in selection order.
    core = _core(strategy)
    by_id = {}
    for item in result.get('matters', []):
        if item.get('matter_id') in core and item['matter_id'] not in by_id:
            by_id[item['matter_id']] = item
        else:
            fixes.append({'fix': 'matter_removed', 'matter_id': item.get('matter_id')})
    for matter_id in core:
        item = by_id.get(matter_id)
        if item is None:
            continue
        matter = register.get(matter_id, {})
        issue = _bound(item.get('legal_issue_source_quote'), matter)
        if issue is None:
            issue = _selection_quote(strategy, register, matter_id)
            if issue:
                fixes.append({'fix': 'legal_issue_quote_from_selection', 'matter_id': matter_id})
        if issue:
            item['legal_issue_source_quote'] = issue
        quotes = []
        for quote in item.get('decisive_source_quotes', []):
            bound = _bound(quote, matter)
            if bound and bound not in quotes:
                quotes.append(bound)
                if bound != quote:
                    fixes.append({'fix': 'decisive_quote_literal', 'matter_id': matter_id})
            elif not bound:
                fixes.append({'fix': 'decisive_quote_removed', 'matter_id': matter_id})
        item['decisive_source_quotes'] = quotes
    result['matters'] = [by_id[m] for m in core if m in by_id]
    # Candidates: exactly the roster, each once.
    roster = _roster(package)
    seen, candidates = set(), []
    for candidate in result.get('candidates', []):
        key = identity(candidate.get('name'))
        match = next((n for n in roster if identity(n) == key), None)
        if match is None or key in seen:
            fixes.append({'fix': 'candidate_removed', 'name': candidate.get('name')})
            continue
        seen.add(key)
        candidates.append({**candidate, 'name': match})
    result['candidates'] = candidates
    # Additional leaders are computed from the sources; keep the model's prose
    # decision when the identity and mandates match.
    if isinstance(case, dict):
        expected = additional_leaders(package, strategy)
        given = {identity(p.get('name')): p for p in case.get('additional_leaders', [])}
        leaders = []
        for leader in expected:
            prior = given.get(identity(leader['name']), {})
            leaders.append({'name': leader['name'], 'matter_ids': list(leader['matter_ids']),
                'decision': prior.get('decision') or '', 'remaining_action': prior.get('remaining_action') or ''})
        if leaders != case.get('additional_leaders', []):
            fixes.append({'fix': 'additional_leaders_from_sources'})
        case['additional_leaders'] = leaders
        if not str(case.get('target_decision') or '').strip() and package.get('requested_target'):
            case['target_decision'] = 'Preserve the requested objective: ' + str(package['requested_target'])
            fixes.append({'fix': 'target_decision_from_request'})
        # Institutional evidence: literal own core passages only.
        arguments = []
        for argument in case.get('institutional_arguments', []):
            evidence = []
            for item in argument.get('evidence', []):
                bound = _bound(item.get('source_quote'), register.get(item.get('matter_id'), {})) if item.get('matter_id') in core else None
                if bound:
                    evidence.append({**item, 'source_quote': bound})
                else:
                    fixes.append({'fix': 'argument_evidence_removed', 'matter_id': item.get('matter_id')})
            arguments.append({**argument, 'evidence': evidence})
        case['institutional_arguments'] = arguments
    # Comparisons: each reserve once against a selected matter.
    reserves = set(bindings(strategy).values())
    kept, covered = [], set()
    for comparison in result.get('comparisons', []):
        if comparison.get('alternative_id') in reserves and comparison.get('selected_id') in core and comparison['alternative_id'] not in covered:
            kept.append(comparison)
            covered.add(comparison['alternative_id'])
        else:
            fixes.append({'fix': 'comparison_removed', 'alternative_id': comparison.get('alternative_id')})
    if kept and not any(c.get('audit_required', True) for c in kept):
        kept[0] = {**kept[0], 'audit_required': True}
        fixes.append({'fix': 'comparison_made_visible', 'alternative_id': kept[0]['alternative_id']})
    result['comparisons'] = kept
    return result, fixes


def expectations(package, strategy, plan, errors):
    """What a valid corrected plan must contain, stated concretely for each fault."""
    from core.reserve_comparisons import missing
    register = {m['id']: m for m in package.get('matters', [])}
    core = _core(strategy)
    result = []
    if not isinstance(plan.get('comparisons', []), list):
        plan = {**plan, 'comparisons': []}
    case = plan.get('case_plan') or {}
    for index, argument in enumerate(case.get('institutional_arguments', [])):
        if not argument.get('evidence') or any(not str(argument.get(k) or '').strip() for k in ('proposition', 'b10_contribution', 'c2_contribution')):
            result.append({'path': f'case_plan/institutional_arguments/{index}',
                'expected': 'A non-empty proposition, b10_contribution and c2_contribution, and at least one evidence item whose '
                            'matter_id is one of allowed_matter_ids and whose source_quote is copied exactly from that matter.',
                'allowed_matter_ids': core})
    if not case.get('institutional_arguments'):
        result.append({'path': 'case_plan/institutional_arguments', 'expected': 'At least one evidenced institutional argument.',
                       'allowed_matter_ids': core})
    for leader in case.get('additional_leaders', []):
        if not leader.get('decision') or not leader.get('remaining_action'):
            result.append({'path': 'case_plan/additional_leaders', 'name': leader['name'], 'matter_ids': leader['matter_ids'],
                'expected': 'An internal decision for this source-attributed matter leader (normally: not nominated in this filing, with '
                            'the reason) and the one missing fact that would change it. Never invent a title or public profile.'})
    for matter_id in missing({**strategy}, plan.get('comparisons', [])):
        result.append({'path': 'comparisons', 'reserve_id': matter_id,
            'expected': 'One comparison of this reserve with its closest selected matter (selected_id from allowed_matter_ids): concrete '
                        'legal mechanism, scope/quantity with its concept and ongoing/completed status on BOTH sides.',
            'allowed_matter_ids': core})
    for index, comparison in enumerate(plan.get('comparisons', [])):
        from core.editorial_case import vague_scale_comparison
        for field in ('incremental_contribution', 'tradeoff'):
            if vague_scale_comparison(comparison.get(field, '')):
                result.append({'path': f'comparisons/{index}/{field}', 'current': comparison.get(field),
                    'expected': 'Replace the vague scale label (menor/mayor escala, smaller/larger scale) with the actual supplied facts '
                                'or comparable quantities with their concepts, keeping everything else.'})
    for item in plan.get('matters', []):
        if not item.get('decisive_source_quotes'):
            matter = register.get(item['matter_id'], {})
            result.append({'path': 'matters', 'matter_id': item['matter_id'],
                'expected': 'At least one decisive_source_quotes entry copied exactly (contiguous words) from this matter\'s own record: '
                            'its outcome or current stage, scale, or personal role.',
                'source_record': {k: matter.get(k) for k in ('client', 'source_excerpt') if matter.get(k)}})
    if not result:
        result = [{'errors': errors, 'expected': 'Resolve each listed validator error in this same plan, changing nothing else.'}]
    return result


def safe_fallbacks(package, strategy, plan):
    """Conservative source-bound defaults so the case never stops on the plan."""
    from core.editorial_case import vague_scale_comparison
    from core.reserve_comparisons import missing
    register = {m['id']: m for m in package.get('matters', [])}
    core = _core(strategy)
    hero = strategy.get('hero_matter_id') or (core[0] if core else None)
    result = copy.deepcopy(plan)
    fixes = []
    case = result.setdefault('case_plan', {})
    # Matters missing from the plan or without decisive anchors: use the
    # selection's own validated quote for this record.
    present = {m['matter_id']: m for m in result.get('matters', [])}
    matters = []
    for matter_id in core:
        item = present.get(matter_id) or {'matter_id': matter_id, 'legal_issue_source_quote': '', 'decisive_source_quotes': []}
        issue = _bound(item.get('legal_issue_source_quote'), register.get(matter_id, {}))
        if not issue:
            issue = _fallback_quote(strategy, register, matter_id)
            if issue:
                item['legal_issue_source_quote'] = issue
                fixes.append({'fallback': 'legal_issue_from_own_source', 'matter_id': matter_id})
        if not item.get('decisive_source_quotes'):
            quote = _fallback_quote(strategy, register, matter_id, issue)
            if quote:
                item['decisive_source_quotes'] = [quote]
                fixes.append({'fallback': 'decisive_quote_from_own_source', 'matter_id': matter_id})
        if matter_id not in present:
            fixes.append({'fallback': 'matter_added_from_selection', 'matter_id': matter_id})
        matters.append(item)
    result['matters'] = matters
    # Missing roster members get a conservative pending decision.
    from core.role_evidence import identity
    have = {identity(c['name']) for c in result.get('candidates', [])}
    for name in _roster(package):
        if identity(name) not in have:
            result.setdefault('candidates', []).append(_fallback_candidate(package, name))
            fixes.append({'fallback': 'candidate_pending_decision', 'name': name})
    # Institutional arguments without evidence or text.
    arguments = []
    for argument in case.get('institutional_arguments', []):
        if not argument.get('evidence'):
            fixes.append({'fallback': 'argument_without_evidence_removed', 'proposition': str(argument.get('proposition', ''))[:120]})
            continue
        proposition = str(argument.get('proposition') or '').strip() or str(strategy.get('thesis') or '').strip()
        for key in ('b10_contribution', 'c2_contribution'):
            if not str(argument.get(key) or '').strip():
                argument[key] = proposition
                fixes.append({'fallback': key + '_from_proposition'})
        arguments.append({**argument, 'proposition': proposition})
    if not arguments and hero:
        quote = _fallback_quote(strategy, register, hero)
        if quote:
            thesis = str(strategy.get('thesis') or 'Evidenced capability shown by the selected portfolio.').strip()
            arguments = [{'proposition': thesis, 'evidence': [{'matter_id': hero, 'source_quote': quote}],
                          'b10_contribution': thesis, 'c2_contribution': thesis}]
            fixes.append({'fallback': 'institutional_argument_from_selection_thesis', 'matter_id': hero})
    case['institutional_arguments'] = arguments
    for leader in case.get('additional_leaders', []):
        if not leader.get('decision'):
            leader['decision'] = ('Not nominated in this filing: the sources record their matter leadership but supply no '
                                  'professional profile or broader personal track record.')
            fixes.append({'fallback': 'leader_decision', 'name': leader['name']})
        if not leader.get('remaining_action'):
            leader['remaining_action'] = 'A professional profile and further personally attributed mandates would allow a candidacy assessment.'
            fixes.append({'fallback': 'leader_action', 'name': leader['name']})
    if not str(case.get('target_decision') or '').strip():
        case['target_decision'] = 'No change to the supplied objective is proposed.'
        fixes.append({'fallback': 'target_decision'})
    # Reserve comparisons: each missing reserve against the hero, from the
    # selection's own validated rationales and quotes.
    comparisons = result.setdefault('comparisons', [])
    for matter_id in missing(strategy, comparisons):
        if not hero:
            break
        selected, reserve = _decision(strategy, hero), _decision(strategy, matter_id)
        comparisons.append({'selected_id': hero, 'alternative_id': matter_id, 'audit_required': not comparisons,
            'incremental_contribution': str(selected.get('rationale') or '').strip() or 'Selected for its documented contribution.',
            'tradeoff': (str(reserve.get('rationale') or '').strip() or 'Retained as reserve after comparative review.')})
        fixes.append({'fallback': 'comparison_from_selection_rationales', 'alternative_id': matter_id})
    for index, comparison in enumerate(comparisons):
        for key in ('incremental_contribution', 'tradeoff'):
            text = str(comparison.get(key) or '')
            if vague_scale_comparison(text):
                sentences = [s for s in re.split(r'(?<=[.;])\s+', text) if s and not vague_scale_comparison(s)]
                comparison[key] = ' '.join(sentences) or str(_decision(strategy, comparison.get('alternative_id')).get('rationale') or 'Retained as reserve after comparative review.')
                fixes.append({'fallback': 'vague_scale_sentence_removed', 'path': f'comparisons/{index}/{key}'})
    if comparisons and not any(c.get('audit_required', True) for c in comparisons):
        comparisons[0]['audit_required'] = True
    return result, fixes
