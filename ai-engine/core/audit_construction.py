"""Construct the internal Audit like the Submission: shared decisions in, owned slots out.

The writer receives the shared decisions, the CURRENT public prose and literal
source anchors, not the complete register again. Everything the final review
enforces as coverage (each core matter, each personally attributed contribution,
each additional leader, each client-visible comparison) is a required schema
slot rather than a prompt request. The application renders order, names,
headings and decisions; the model writes analysis only.

A source-bound review of those slots and ONE bounded repair run before the
documents are assembled. Nothing here approves delivery: the independent final
review of the exact files still follows.
"""
import copy
import json
import os
import re
import time
import unicodedata
from collections import OrderedDict
from hashlib import sha256
from typing import List
from pydantic import ConfigDict, Field, create_model

VERSION = 'audit-construction-v1'
REVIEW_VERSION = 'audit-field-review-v1'
EVIDENCE_LABEL = 'Aportaciones personales documentadas:'
LEADERS_LABEL = 'Otros líderes de asunto evaluados internamente:'
RESERVE_HEADING = '**Asuntos en reserva**'
EXCLUDED_HEADING = '**Asuntos excluidos del portafolio**'
LINE = '— '
WORD_LIMIT = 1800
REVIEW_SECONDS, REPAIR_SECONDS, RECHECK_SECONDS = 75, 90, 60

TASK = '''Write the internal executive Audit in Spanish from the CURRENT shared
decisions, the current Submission prose and the literal source anchors supplied.
You do not receive the complete register: every anchor is an exact original
quotation. Use only the anchors, the current Submission text, the supplied
lawyer profiles, filing details and ranking_verification; never add a fact,
figure, title, result or permission that they do not state. Preserve amounts
with their concept and currency, actors, chronology and uncertainty. A pending
matter is never an achieved result. Do not change selection, hero, nomination,
category or target: they are read-only decisions that the application prints.
Use names of clients and people, never internal IDs. This is an internal
document, so confidential client names may appear. Do not narrate system
stages, declare approval or ask the user to fix generated wording.
executive_assessment (about 220 words): filing recommendation, objective versus
verified position, main strength and limitation, and why the hero proves the
case better than the strongest other selected mandate, using source-grounded
qualitative criteria and no invented scores. Preserve the supplied target or
explain a proposed change. Where actual retrieved peer commentary exists in
ranking_verification, contrast concrete capabilities with this portfolio; a
table-only or absent retrieval permits a precise scoped limitation, never an
invented market comparison or forecast.
portfolio: one required slot per selected matter in the supplied order. Write
one or two compact sentences (maximum 55 words): the legal problem, the firm's
intervention and the achieved result or actual current stage, with decisive
scale. The application prints the number and client name before your sentence.
leadership: one required object per person. argument (80-130 words) explains
why this person, their career credentials and the scope and limits of their
personal evidence. Do not restate the nomination or category; the application
prints them with any pending criterion. contributions has one required slot per
personally attributed mandate used in that person's CURRENT B9: ONE compact
sentence (maximum 40 words) stating the person's own role and the achieved
result or actual pending stage of THAT mandate, consistent with its b9_passage
and source quote. Team membership is not leadership or a personal result. A
Lead partner form heading identifies the responsible lawyer; write "líder del
asunto" and never "socio" or "partner" unless partner status is confirmed in
the supplied profile. additional has one slot per further matter leader: the
documented matter leadership, the explicit internal decision not to nominate
that person in this filing with its reason, and the one missing fact that would
change it. Never invent a public profile or title for them.
evidence_gaps: comparisons has one required slot per client-visible reserve
comparison: concrete sourced differences on BOTH sides (legal mechanism, scope
or quantity with its concept, and ongoing/completed status). Never write menor
escala, mayor escala or an unqualified hierarchy. other_reserves is one
sentence on the remaining reserves, or an empty string. exclusions (maximum 120
words) gives the actual reasons, distinguishing practice relevance, represented
client side, strategic thesis and genuinely missing evidence; empty when no
matter is excluded. A reserve can have sufficient evidence and lose on
comparative value.
next_actions: only genuine remaining actions with their Studio destination and
what each answer would change; missing optional information never blocks
delivery. Do not reproduce private contact details.'''

REVIEW_TASK = '''Review only these internal Audit units, written in Spanish, before
document assembly. For EACH obligation judge whether the actual Audit passage
executes its rule against the supplied original anchors and, for a personal
contribution, the person's CURRENT B9 passage. The Audit is compact by design:
one accurate sentence stating the person's own role and the achieved result or
actual pending stage executes a personal obligation. Do not demand B9-level
development, arbitrary length or facts absent from the supplied anchors. Mark
failed only for a concrete material violation: an omitted decisive result or
stage, a wrong actor or professional title (a Lead partner form heading does
not establish partner seniority), a changed amount, concept or currency, a
pending matter presented as achieved, a vague scale hierarchy in a comparison,
or a nomination/category different from the shared decision. This internal
document may name clients. For a failed check set failure_kind: omission when
supported material is missing, unsupported_claim when the passage asserts a
wrong or unsupported fact, role or result, style for a concrete violation of
the writing contract; null for met checks. Identify an allowed output passage
and anchor passage. Keep each reason to one or two sentences (maximum 350
characters). Do not rewrite text or certify the complete documents. Every
check is required.'''

REPAIR_TASK = '''Correct ONLY the supplied internal Audit slots, in Spanish. Each
slot lists its current text, the concrete finding and the original anchors.
Fix the finding without adding facts beyond the anchors, the CURRENT B9 passage
and the shared decision. Keep the same compact length limits, preserve every
correct fact, amount with its concept, actor and status already present, and
never change selection, nomination or category. Write "líder del asunto" for a
matter lead without confirmed partner status. Return every supplied slot.'''


def enabled():
    return os.environ.get('RANKPILOT_AUDIT_CONSTRUCTION', 'on').strip().casefold() not in ('off', '0', 'false')


def active(state):
    development = state.get('development') or {}
    return (enabled() and development.get('construction_contract') == 'editorial-construction-v1'
            and bool(development.get('candidates'))
            and (state.get('case_requirements') or {}).get('audit_contract') == VERSION)


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def _norm(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).split())


def _fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')) if not unicodedata.combining(c)).casefold()


def _words(text):
    return len(str(text or '').split())


def _label(matter, fallback=''):
    return str(matter.get('client') or matter.get('name') or matter.get('title') or fallback).strip()


def visible(text):
    """The words a reader sees in the Word file: same rules as the renderer."""
    value = re.sub(r'\*\*([^*\n]+)\*\*|\*([^*\n]+)\*', lambda m: m.group(1) or m.group(2), str(text or ''))
    value = re.sub(r'(?m)^\s*#{1,6}\s+', '', value)
    return unicodedata.normalize('NFC', re.sub(r'\bnot_found\b', 'sin coincidencia exacta en la consulta', value))


def _signature(value):
    import hmac
    secret = os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if not secret:
        return None
    return hmac.new(secret.encode(), json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode(), sha256).hexdigest()


def proofs(reviewed_units, receipts):
    """Self-contained proof of a fully met Audit unit, bound to its visible lines.

    The final review can reuse it only while every reviewed line is present in
    the exact Audit file. Without the service secret nothing is reusable.
    """
    passed = {r['field']: r for r in receipts}
    result = []
    for item in reviewed_units:
        receipt = passed.get(item['field'])
        if not receipt or receipt.get('hash') != item['hash']:
            continue
        proof = {'version': REVIEW_VERSION, 'field': item['field'], 'hash': item['hash'],
                 'obligation_ids': [o['id'] for o in item['obligations']],
                 'output_lines': list(item['output_passages'].values())}
        signature = _signature(proof)
        if signature:
            result.append({**proof, 'signature': signature})
    return result


def verified_obligations(package):
    """Audit obligations proven on text that the exact Audit file still contains."""
    import hmac
    rendered = _norm(package.get('rendered_audit'))
    if not rendered or not os.environ.get('AI_ENGINE_SERVICE_TOKEN'):
        return []
    valid = []
    for proof in package.get('field_review_receipts') or []:
        if not isinstance(proof, dict) or proof.get('version') != REVIEW_VERSION or not isinstance(proof.get('signature'), str):
            continue
        expected = _signature({k: v for k, v in proof.items() if k != 'signature'})
        if not expected or not hmac.compare_digest(expected, proof['signature']):
            continue
        lines = proof.get('output_lines') or []
        if lines and all(_norm(line) and _norm(line) in rendered for line in lines):
            valid.extend(proof.get('obligation_ids') or [])
    return sorted(set(valid))


def anchor_register(state):
    """Every literal quotation already bound to a matter, with its compact facts.

    Anchors were validated against the original record when the selection, plan
    and bindings were accepted. Narrative fields are deliberately absent.
    """
    package, strategy = state['package'], state['strategy']
    proposal = state.get('development') or {}
    quotes = {}

    def add(matter_id, *values):
        for value in values:
            text = str(value or '').strip()
            if matter_id and text and text not in quotes.setdefault(matter_id, []):
                quotes[matter_id].append(text)
    decisions = {d['matter_id']: d for d in strategy.get('matters', [])}
    for matter_id, decision in decisions.items():
        add(matter_id, decision.get('source_quote'))
    for draft in proposal.get('matters', []):
        add(draft.get('matter_id'), draft.get('legal_issue_source_quote'), *draft.get('decisive_source_quotes', []))
    for candidate in proposal.get('candidates', []):
        for item in list(candidate.get('supporting_matters') or []) + list(candidate.get('submission_case_coverage') or []):
            add(item.get('matter_id'), item.get('source_quote'))
    for argument in (proposal.get('case_plan') or {}).get('institutional_arguments', []):
        for evidence in argument.get('evidence', []):
            add(evidence.get('matter_id'), evidence.get('source_quote'))
    facts = ('value', 'valueResolution', 'leadPartner', 'teamMembers', 'completionDate', 'clientDescription',
             'publication_route', 'resolved_publication_status')
    register = OrderedDict()
    for matter in package.get('matters', []):
        matter_id = matter.get('id')
        entry = {'id': matter_id, 'client': _label(matter, matter_id),
                 'disposition': (decisions.get(matter_id) or {}).get('disposition')}
        entry.update({key: matter[key] for key in facts if matter.get(key) not in (None, '', [], {})})
        entry['anchors'] = quotes.get(matter_id, [])
        register[matter_id] = entry
    return register


def slots(state):
    """Canonical slots derive from the SAME obligations the final review enforces."""
    from core.editorial_case import obligations
    package, strategy, proposal = state['package'], state['strategy'], state['development']
    register = {m['id']: m for m in package.get('matters', [])}
    name = lambda matter_id: _label(register.get(matter_id, {}), matter_id)
    candidates = proposal.get('candidates', [])
    people = [{'key': f'L{i+1:02d}', 'index': i, 'name': c['name'], 'contributions': OrderedDict()}
              for i, c in enumerate(candidates)]
    planned = {_fold(item.get('name')): item for item in (proposal.get('case_plan') or {}).get('additional_leaders', [])}
    leaders, comparisons = OrderedDict(), OrderedDict()
    for obligation in obligations(package, strategy, proposal):
        match = re.fullmatch(r'personal_audit:(\d+):(\d+)', obligation['id'])
        if match:
            i, j = int(match.group(1)), int(match.group(2))
            link = candidates[i]['submission_case_coverage'][j]
            people[i]['contributions'][f'C{j+1:02d}'] = {'obligation_id': obligation['id'],
                'matter_id': link.get('matter_id'), 'client': name(link.get('matter_id')),
                'b9_passage': link.get('public_quote', ''), 'source_quote': link.get('source_quote', '')}
            continue
        match = re.fullmatch(r'leader:(\d+)', obligation['id'])
        if match:
            from core.editorial_case import additional_leaders
            leader = additional_leaders(package, strategy)[int(match.group(1))]
            decision = planned.get(_fold(leader['name']), {})
            leaders[f'A{len(leaders)+1:02d}'] = {'obligation_id': obligation['id'], 'name': leader['name'],
                'matter_ids': list(leader['matter_ids']), 'clients': [name(mid) for mid in leader['matter_ids']],
                'decision': decision.get('decision', ''), 'remaining_action': decision.get('remaining_action', '')}
            continue
        match = re.fullmatch(r'comparison:(\d+)', obligation['id'])
        if match and obligation['field'] == 'evidence_gaps':
            comparison = proposal['comparisons'][int(match.group(1))]
            comparisons[f'G{len(comparisons)+1:02d}'] = {'obligation_id': obligation['id'], 'index': int(match.group(1)),
                'selected_id': comparison.get('selected_id'), 'alternative_id': comparison.get('alternative_id'),
                'selected': name(comparison.get('selected_id')), 'alternative': name(comparison.get('alternative_id')),
                'tradeoff': comparison.get('tradeoff', ''),
                'incremental_contribution': comparison.get('incremental_contribution', '')}
    core = [d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') == 'core']
    portfolio = OrderedDict((f'P{i+1:02d}', {'matter_id': mid, 'client': name(mid)}) for i, mid in enumerate(core))
    return {'portfolio': portfolio, 'people': people, 'leaders': leaders, 'comparisons': comparisons}


def _strict(name, fields):
    return create_model(name, __config__=ConfigDict(extra='forbid'), **fields)


def _text(description, limit):
    return (str, Field(min_length=1, max_length=limit, description=description))


def letter_schema(plan):
    from core.review_graph import NextAction
    portfolio = _strict('AuditPortfolio', {key: _text(
        'Contribution of ' + item['client'] + ' to the case in one or two compact Spanish sentences (maximum 55 words).', 600)
        for key, item in plan['portfolio'].items()})
    people = {}
    for person in plan['people']:
        fields = {'argument': _text('Internal analysis for ' + person['name'] + ' in Spanish (80-130 words): why this person, '
            'career credentials and scope/limits of personal evidence. Do not restate nomination or category.', 1600)}
        if person['contributions']:
            fields['contributions'] = (_strict('AuditContributions_' + person['key'], {key: _text(
                'ONE compact Spanish sentence (maximum 40 words) for ' + item['client'] + ': this person\'s own role and the '
                'achieved result or actual pending stage, consistent with the supplied B9 passage.', 450)
                for key, item in person['contributions'].items()}), ...)
        people[person['key']] = (_strict('AuditPerson_' + person['key'], fields), ...)
    if plan['leaders']:
        people['additional'] = (_strict('AuditAdditionalLeaders', {key: _text(
            'Internal Spanish assessment of ' + item['name'] + ' (maximum 60 words): documented matter leadership as líder del '
            'asunto, explicit decision not to nominate in this filing with its reason, and the missing fact that would change it.', 650)
            for key, item in plan['leaders'].items()}), ...)
    gaps = {'other_reserves': (str, Field(max_length=500, description='One Spanish sentence on reserves without an individual comparison; empty string if none.')),
            'exclusions': (str, Field(max_length=1200, description='Actual exclusion reasons in Spanish (maximum 120 words); empty string when nothing is excluded.'))}
    if plan['comparisons']:
        gaps['comparisons'] = (_strict('AuditComparisons', {key: _text(
            'Concrete sourced tradeoff in Spanish (maximum 60 words) between selected ' + item['selected'] + ' and reserve '
            + item['alternative'] + ', with facts and status on BOTH sides. No menor/mayor escala.', 700)
            for key, item in plan['comparisons'].items()}), ...)
    return _strict('ConstructedAudit', {
        'executive_assessment': _text('Executive verdict in Spanish (about 220 words).', 2600),
        'portfolio': (portfolio, ...), 'leadership': (_strict('AuditLeadership', people), ...),
        'evidence_gaps': (_strict('AuditEvidenceGaps', gaps), ...),
        'next_actions': (List[NextAction], Field(description='Genuine remaining actions with their destination; empty when none remain.'))})


def audit_view(state, plan=None):
    """Decisions + current prose + anchors. No source narrative is sent again."""
    from core.editorial_construction import decision_snapshot
    from core.editorial_case import obligations
    package, strategy, proposal = state['package'], state['strategy'], state['development']
    plan = plan or slots(state)
    register = anchor_register(state)
    drafts = {m['matter_id']: m for m in proposal.get('matters', [])}
    for matter_id, entry in register.items():
        if matter_id in drafts:
            entry['current_narrative'] = drafts[matter_id].get('text', '')
            entry['current_status'] = drafts[matter_id].get('completion_status', '')
    scope = {key: package[key] for key in ('directory', 'practice_area', 'firm_name', 'guide_region', 'jurisdiction',
             'ranking_jurisdiction', 'ranking_edition', 'research_period', 'current_band', 'requested_target',
             'objectives', 'filing_details', 'delivery_policy') if package.get(key) not in (None, '', [], {})}
    people = []
    for person in plan['people']:
        candidate = proposal['candidates'][person['index']]
        people.append({'slot': person['key'], 'name': person['name'],
            'shared_decision': {k: candidate.get(k) for k in ('recommendation', 'current_ranking', 'suggested_ranking',
                'category_rationale', 'category_missing_criterion', 'category_assessment', 'why_candidate',
                'external_evidence', 'evidence_gaps', 'recommended_action', 'biography_depth')},
            'current_b9': candidate.get('submission_bio', ''),
            'supporting_matters': candidate.get('supporting_matters', []),
            'contribution_slots': person['contributions']})
    audit_obligations = [{'id': o['id'], 'field': o['field'], 'instruction': o['instruction'], 'sources': []}
                         for o in obligations(package, strategy, proposal) if o['output_scope'] == 'audit']
    return {'scope': scope,
            'ranking_verification': state.get('ranking_verification') or package.get('ranking_verification') or {},
            'lawyers': copy.deepcopy(package.get('lawyers', [])),
            'department_source': {'b10_source': package.get('b10_source', ''), 'c2_source': package.get('c2_source', '')},
            'internal_referee_notes': package.get('internal_referee_notes'),
            'strategy': copy.deepcopy(strategy),
            'shared_decisions': {k: v for k, v in decision_snapshot(proposal).items() if k != 'candidates'},
            'current_submission': {'b10': proposal.get('b10', ''), 'c2': proposal.get('c2', '')},
            'matter_register': list(register.values()),
            'portfolio_slots': plan['portfolio'], 'people': people,
            'additional_leader_slots': plan['leaders'], 'comparison_slots': plan['comparisons'],
            'selection_advisories': state.get('selection_advisories', []),
            'repair_source_notes': (state.get('repair_report') or {}).get('source_notes', []),
            'case_obligations': audit_obligations}


def _person_block(state, plan, content, person):
    from core.audit_decisions import decision_heading
    candidate = state['development']['candidates'][person['index']]
    built = content['leadership'][person['key']]
    lines = [decision_heading(candidate) + ' ' + built['argument'].strip()]
    if candidate.get('suggested_ranking') == 'Category pending':
        lines[0] += (' Criterio pendiente: ' + str(candidate.get('category_missing_criterion') or '').strip()
                     + ' Acción: ' + str(candidate.get('recommended_action') or '').strip())
    if person['contributions']:
        lines.append(EVIDENCE_LABEL)
        lines += [LINE + item['client'] + ': ' + built['contributions'][key].strip()
                  for key, item in person['contributions'].items()]
    return '\n'.join(lines)


def _leader_line(item, text):
    return LINE + item['name'] + ' (' + ', '.join(item['clients']) + '): ' + text.strip()


def _comparison_line(item, text):
    return item['alternative'] + ' frente a ' + item['selected'] + ': ' + text.strip()


def render(state, plan, content):
    """Order, names, headings and decisions are application-owned."""
    from core.review_graph import reconcile_next_actions
    portfolio = '\n'.join(f"{i+1}. {item['client']}: {content['portfolio'][key].strip()}"
                          for i, (key, item) in enumerate(plan['portfolio'].items()))
    blocks = [_person_block(state, plan, content, person) for person in plan['people']]
    if plan['leaders']:
        blocks.append('\n'.join([LEADERS_LABEL] + [_leader_line(item, content['leadership']['additional'][key])
                                                  for key, item in plan['leaders'].items()]))
    gaps = content['evidence_gaps']
    reserve = [_comparison_line(item, gaps['comparisons'][key]) for key, item in plan['comparisons'].items()]
    if str(gaps.get('other_reserves') or '').strip():
        reserve.append(gaps['other_reserves'].strip())
    sections = ([RESERVE_HEADING] + reserve if reserve else []) + (
        [EXCLUDED_HEADING, gaps['exclusions'].strip()] if str(gaps.get('exclusions') or '').strip() else [])
    letter = {'executive_assessment': content['executive_assessment'].strip(), 'portfolio': portfolio,
              'leadership': '\n\n'.join(blocks), 'evidence_gaps': '\n'.join(sections),
              'next_steps': '', 'next_actions': copy.deepcopy(content.get('next_actions', []))}
    names = {str(m['id']): _label(m) for m in state['package'].get('matters', [])}
    for field, text in list(letter.items()):
        if not isinstance(text, str):
            continue
        for matter_id, client in names.items():
            if client:
                text = re.sub(r'(?<!\w)' + re.escape(matter_id) + r'(?!\w)', lambda _: client, text)
        letter[field] = text
    return reconcile_next_actions(letter, state['package'])


def analytical_words(letter):
    """Application-printed evidence lines are a register, not executive prose."""
    total = 0
    for text in letter.values():
        if isinstance(text, str):
            total += sum(_words(line) for line in text.splitlines() if not line.startswith(LINE))
    return total


def _unconfirmed_partners(state, plan):
    """People a title check may act on: NOT confirmed as partner in their profile."""
    package = state['package']
    roster = [p.get('name') or p.get('fullName') for p in package.get('lawyers', [])]
    confirmed = {_fold(p.get('name') or p.get('fullName')) for p in package.get('lawyers', [])
                 if p.get('isPartner') is True or p.get('is_partner') is True
                 or _fold(p.get('role')) in ('partner', 'socio', 'socia')}
    people = [n for n in roster if n] + [i['name'] for i in plan['leaders'].values()]
    return [n for n in dict.fromkeys(people) if _fold(n) not in confirmed], [n for n in dict.fromkeys(people)]


NON_EVIDENCE = ('anchors', 'id', 'url', 'disposition', 'publication_route', 'resolved_publication_status',
                'recommendation', 'current_narrative', 'current_status')
TITLE = re.compile(r'(?<!\w)soci[oa]s?(?!\w)', re.I)
LINKING = re.compile(r'[\s,(:\u2014-]*(?:(?:figura|actua|actuo|es|fue|aparece|consta|identificad[oa])\s+)?(?:como\s+)?(?:el\s+|la\s+|un\s+|una\s+)?', re.I)


def slot_texts(plan, content):
    """Every model-owned text with its address and, where implicit, its subject."""
    yield 'executive_assessment', content['executive_assessment'], None
    for key in plan['portfolio']:
        yield 'portfolio/' + key, content['portfolio'][key], None
    for person in plan['people']:
        built = content['leadership'][person['key']]
        yield 'leadership/' + person['key'] + '/argument', built['argument'], person['name']
        for key in person['contributions']:
            yield 'leadership/' + person['key'] + '/contributions/' + key, built['contributions'][key], person['name']
    for key, item in plan['leaders'].items():
        yield 'leadership/additional/' + key, content['leadership']['additional'][key], item['name']
    for key in plan['comparisons']:
        yield 'evidence_gaps/comparisons/' + key, content['evidence_gaps']['comparisons'][key], None
    for key in ('other_reserves', 'exclusions'):
        if str(content['evidence_gaps'].get(key) or '').strip():
            yield 'evidence_gaps/' + key, content['evidence_gaps'][key], None


def title_findings(state, plan, content):
    """A person without confirmed partner status must not be called socio.

    Deterministic and deliberately narrow. In a slot owned by that person the
    title refers to them unless it sits next to another named person. Elsewhere
    the title must be attached to their name by a plain linking phrase.
    """
    targets, known = _unconfirmed_partners(state, plan)
    target_keys = {_fold(n): n for n in targets}
    known_keys = [_fold(n) for n in known]
    findings = []
    for path, text, subject in slot_texts(plan, content):
        for sentence in re.split(r'(?<=[.;])\s+|\n+', str(text or '')):
            folded = _fold(sentence)
            hit = None
            for match in TITLE.finditer(folded):
                before, after = folded[:match.start()], folded[match.end():]
                near_after = ' '.join(after.split()[:7])
                near_before = ' '.join(before.split()[-4:])
                other = [k for k in known_keys if k in near_after or k in near_before]
                if subject and _fold(subject) in target_keys and not [k for k in other if k != _fold(subject)] \
                        and not re.search(r'\b(?:no|sin|ni)\b[^.;]{0,30}$', before):
                    hit = subject
                    break
                for key, name in target_keys.items():
                    position = folded.find(key)
                    if position < 0:
                        continue
                    if position >= match.end():
                        gap = folded[match.end():position]
                        attached = re.fullmatch(r'\s+(?:lider\s+)?(?:del\s+asunto\s+)?(?:responsable\s+)?[\s,:]*', gap)
                    else:
                        gap = folded[position + len(key):match.start()]
                        attached = LINKING.fullmatch(gap)
                    if attached:
                        hit = name
                        break
                if hit:
                    break
            if hit:
                findings.append({'path': path, 'name': hit, 'sentence': sentence.strip()})
    return findings


def locate(plan, content, quote):
    """Address of the model-owned slot a literal finding belongs to, if unique."""
    wanted = _norm(quote)
    if not wanted:
        return None
    exact = [path for path, text, _ in slot_texts(plan, content) if wanted in _norm(text)]
    if len(exact) == 1:
        return exact[0]
    partial = [path for path, text, _ in slot_texts(plan, content)
               if any(len(part) >= 24 and part in wanted for part in (_norm(x) for x in re.split(r'(?<=[.;])\s+', str(text))))]
    return partial[0] if len(partial) == 1 else None


def _passages(texts):
    result = OrderedDict()
    for text in texts:
        for sentence in re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“])', _norm(text)):
            while len(sentence) > 360:
                end = sentence.rfind(' ', 0, 361)
                end = end if end > 0 else 360
                result.setdefault('S_' + sha256(sentence[:end].encode()).hexdigest()[:16], sentence[:end])
                sentence = sentence[end:].lstrip()
            if sentence:
                result.setdefault('S_' + sha256(sentence.encode()).hexdigest()[:16], sentence)
    return result


def source_passages(source):
    """Citable sentences of ONE compact source; the same text is never sent twice."""
    texts = list(source.get('anchors') or [])
    texts += [str(v) for k, v in source.items() if k not in NON_EVIDENCE and isinstance(v, str) and v.strip()]
    for nested in source.values():
        if isinstance(nested, dict):
            texts += [str(v) for k, v in nested.items() if k not in NON_EVIDENCE and isinstance(v, str) and v.strip()]
    return _passages(texts)


def review_payload(batch):
    """Each source appears once, as its own citable passages plus short facts."""
    facts = ('id', 'client', 'name', 'fullName', 'role', 'isPartner', 'disposition')
    sources, items = {}, []
    for item in batch:
        for key, source in item['sources'].items():
            sources[key] = {**{k: source[k] for k in facts if k in source}, 'passages': source_passages(source)}
        items.append({'field': item['field'], 'output_passages': item['output_passages'],
                      'obligations': [{'id': o['id'], 'instruction': o['instruction'], 'source_ids': o['source_ids']}
                                      for o in item['obligations']]})
    return {'units': items, 'original_sources': sources}


def units(state, plan, letter, content):
    """Source-bound Audit units in the shape used by the field reviewer."""
    from core.editorial_case import obligations
    from utils.review_policy import EDITORIAL_RULES
    package, strategy, proposal = state['package'], state['strategy'], state['development']
    register = anchor_register(state)
    people = {p['index']: p for p in plan['people']}
    slot_of = {}
    for person in plan['people']:
        for key, item in person['contributions'].items():
            slot_of[item['obligation_id']] = ('leadership', person['key'], key)
    for key, item in plan['leaders'].items():
        slot_of[item['obligation_id']] = ('leadership', 'additional', key)
    for key, item in plan['comparisons'].items():
        slot_of[item['obligation_id']] = ('evidence_gaps', 'comparisons', key)
    grouped = OrderedDict()

    def unit(name, output):
        return grouped.setdefault(name, {'field': name, 'output': output, 'obligations': [], 'sources': {}})

    def compact(source):
        if isinstance(source, dict) and source.get('id') in register:
            entry = register[source['id']]
            return {k: v for k, v in entry.items() if k not in ('current_narrative', 'current_status')}
        return source

    for obligation in obligations(package, strategy, proposal):
        if obligation['output_scope'] != 'audit':
            continue
        identifier = obligation['id']
        match = re.fullmatch(r'(?:candidate|personal_audit|editorial:shared_category):(\d+)(?::.*)?', identifier)
        extra = []
        if match and int(match.group(1)) in people:
            person = people[int(match.group(1))]
            target = unit('leadership#' + person['key'], _person_block(state, plan, content, person))
            candidate = proposal['candidates'][person['index']]
            extra.append({'shared_decision': {k: candidate.get(k) for k in ('name', 'recommendation', 'suggested_ranking',
                          'category_missing_criterion', 'recommended_action')}})
            slot = slot_of.get(identifier)
            if slot:
                item = person['contributions'][slot[2]]
                extra.append({'current_b9_passage': item['b9_passage'], 'source_excerpt': item['source_quote']})
        elif identifier.startswith('leader:'):
            target = unit('leadership#additional', '\n'.join([LEADERS_LABEL] + [
                _leader_line(item, content['leadership']['additional'][key]) for key, item in plan['leaders'].items()]))
            slot = slot_of.get(identifier)
            if slot:
                item = plan['leaders'][slot[2]]
                extra.append({'shared_decision': {'name': item['name'], 'decision': item['decision'],
                                                  'remaining_action': item['remaining_action']}})
        elif obligation['field'] in ('evidence_gaps', 'executive_assessment', 'leadership'):
            target = unit(obligation['field'], letter.get(obligation['field'], ''))
            slot = slot_of.get(identifier)
            if slot:
                item = plan['comparisons'][slot[2]]
                extra.append({'shared_tradeoff': item['tradeoff'], 'incremental_contribution': item['incremental_contribution']})
        else:
            continue
        refs, passages = {}, OrderedDict()
        for source in [compact(s) for s in obligation['sources']] + extra:
            if not isinstance(source, dict) or not source:
                continue
            key = digest(source)
            target['sources'][key] = source
            refs[key] = True
            passages.update(source_passages(source))
        if not passages:
            passages = _passages([obligation['instruction']])
        target['obligations'].append({'id': identifier, 'instruction': obligation['instruction'],
                                      'source_ids': list(refs), 'source_passages': passages,
                                      **({'slot': list(slot_of[identifier])} if identifier in slot_of else {})})
    result = []
    for item in grouped.values():
        item['output'] = visible(item['output'])
        if not _norm(item['output']):
            continue
        item['output_passages'] = {'P_' + digest(q)[:16]: q for q in
                                   dict.fromkeys(_norm(line) for line in item['output'].splitlines() if line.strip())}
        item['hash'] = digest({'version': REVIEW_VERSION, 'policy': EDITORIAL_RULES, **item})
        result.append(item)
    return result


def _batches(items):
    result, batch = [], []
    for item in items:
        combined = batch + [item]
        if batch and (sum(len(u['obligations']) for u in combined) > 24
                      or len(json.dumps(review_payload(combined), ensure_ascii=False).encode()) > 100000):
            result.append(batch)
            batch = []
        batch.append(item)
    return result + ([batch] if batch else [])


def _remaining(state):
    return state.get('stage_deadline', float('inf')) - time.monotonic()


def _unknown(trace):
    from core.editorial_repair import unknown_repair_usage
    return unknown_repair_usage(trace)


def review(state, pending, invoke, trace, minimum=REVIEW_SECONDS):
    """Return (receipts, defects, reviewed_fields, trace, stopped_reason)."""
    from core.field_review import contract, project_checks
    receipts, defects, reviewed, stopped = [], [], [], None
    for batch in _batches(pending):
        if _remaining(state) < minimum:
            stopped = 'stage_time'
            break
        result, trace = invoke({**state, 'trace': trace}, 'field_reviewer', contract(batch), REVIEW_TASK, review_payload(batch))
        signed, failed = project_checks(batch, result)
        slots_by_id = {o['id']: o.get('slot') for u in batch for o in u['obligations']}
        for defect in failed:
            unit_field = defect['field_path']
            defect.update(scope='letter', audit_unit=unit_field, field_path=unit_field.split('#')[0],
                          slot=slots_by_id.get(defect.get('obligation_id')))
        receipts += signed
        defects += failed
        reviewed += [u['field'] for u in batch]
    return receipts, defects, reviewed, trace, stopped


def _repair_plan(plan, content, defects):
    """Only the slots a finding owns; an unlocated finding stays an observation."""
    targets = OrderedDict()
    people = {p['key']: p for p in plan['people']}
    labels = {path: (subject or path) for path, _, subject in slot_texts(plan, content)}
    current = {path: text for path, text, _ in slot_texts(plan, content)}

    def add(path, finding):
        if path in current:
            targets.setdefault(path, {'current': current[path], 'label': labels[path], 'findings': []})['findings'].append(finding)
            return True
        return False
    unlocated = []
    for defect in defects:
        slot, unit_name = defect.get('slot'), str(defect.get('audit_unit') or '')
        finding = {k: defect.get(k) for k in ('message', 'artifact_quote', 'source_quote', 'code') if defect.get(k)}
        path = defect.get('slot_path')
        if not path and slot and slot[0] == 'leadership' and slot[1] in people:
            item = people[slot[1]]['contributions'][slot[2]]
            path = '/'.join(['leadership', slot[1], 'contributions', slot[2]])
            finding.update(current_b9_passage=item['b9_passage'], anchor=item['source_quote'], client=item['client'])
        elif not path and slot and slot[0] == 'leadership':
            item = plan['leaders'][slot[2]]
            path = 'leadership/additional/' + slot[2]
            finding.update(shared_decision=item['decision'], matters=item['clients'])
        elif not path and slot and slot[0] == 'evidence_gaps':
            item = plan['comparisons'][slot[2]]
            path = 'evidence_gaps/comparisons/' + slot[2]
            finding.update(shared_tradeoff=item['tradeoff'], selected=item['selected'], reserve=item['alternative'])
        elif not path and unit_name.startswith('leadership#') and unit_name.split('#')[1] in people:
            path = locate(plan, content, defect.get('artifact_quote')) or 'leadership/' + unit_name.split('#')[1] + '/argument'
        elif not path and defect.get('field_path') == 'executive_assessment':
            path = 'executive_assessment'
        elif not path:
            path = locate(plan, content, defect.get('artifact_quote'))
        if not (path and add(path, finding)):
            unlocated.append(defect)
    return targets, unlocated


def _set(content, path, value):
    node = content
    parts = path.split('/')
    for part in parts[:-1]:
        node = node[part]
    node[parts[-1]] = value


def repair(state, plan, content, defects, invoke, trace):
    """One bounded correction of the owned slots. Returns (content, changed, trace)."""
    targets, _ = _repair_plan(plan, content, defects)
    if not targets:
        return content, [], trace
    keys = {f'R{i+1:02d}': path for i, path in enumerate(targets)}
    limits = {'executive_assessment': 2600, 'argument': 1600, 'exclusions': 1200, 'other_reserves': 500}
    schema = _strict('AuditSlotRepair', {key: _text('Corrected Spanish text for ' + str(targets[path]['label']) + '.',
                     limits.get(path.split('/')[-1], 700)) for key, path in keys.items()})
    payload = {'slots': {key: {'slot': path, **targets[path]} for key, path in keys.items()},
               'lawyers': [{k: p.get(k) for k in ('name', 'fullName', 'role', 'isPartner')} for p in state['package'].get('lawyers', [])]}
    result, trace = invoke({**state, 'trace': trace, 'rag_disabled': True}, 'writer', schema, REPAIR_TASK, payload)
    fixed = copy.deepcopy(content)
    changed = []
    for key, path in keys.items():
        value = str(result.get(key) or '').strip()
        if value and value != targets[path]['current']:
            _set(fixed, path, value)
            changed.append(path)
    return fixed, changed, trace


def _deterministic(state, plan, letter, content):
    from core.editorial_case import comparison_style_defects
    from core.portfolio_counts import enumeration_defects
    defects = enumeration_defects(state['strategy'], letter, require_numbered=True) + comparison_style_defects(letter)
    for finding in title_findings(state, plan, content):
        defects.append({'code': 'UNSUPPORTED_CLAIM', 'severity': 'critical', 'scope': 'letter', 'owner': 'rankpilot',
            'field_path': finding['path'].split('/')[0], 'slot_path': finding['path'], 'matter_id': None,
            'source_quote': '', 'artifact_quote': finding['sentence'],
            'message': 'El Audit llama socio a ' + finding['name'] + ' sin que su perfil confirme esa categoría profesional. '
                       'Usa «líder del asunto» o su cargo documentado.'})
    return defects


def _unit_of(path):
    """Review unit that a model-owned slot renders into."""
    parts = path.split('/')
    if parts[0] == 'leadership':
        return 'leadership#' + parts[1]
    return parts[0]


def write(state, invoke):
    """Generate, render, check, review and repair once; never lose a paid letter."""
    from core.field_review import receipt_matches
    from core.portfolio_consistency import verify_portfolio_consistency, portfolio_defects
    trace = list(state.get('trace', []))
    plan = slots(state)
    schema = letter_schema(plan)
    content, trace = invoke({**state, 'trace': trace}, 'writer', schema, TASK, audit_view(state, plan))
    content = schema.model_validate(content).model_dump()
    letter = render(state, plan, content)
    report = {'version': REVIEW_VERSION, 'status': 'not_started', 'receipts': [], 'observations': [],
              'repaired_slots': [], 'unreviewed_units': []}
    defects, review_error, final_units = _deterministic(state, plan, letter, content), None, []
    try:
        conflicts, trace = verify_portfolio_consistency({**state, 'trace': trace}, letter)
        pending = units(state, plan, letter, content)
        receipts, failed, reviewed, trace, stopped = review(state, pending, invoke, trace)
        report['receipts'] = receipts
        final_units = pending
        defects = defects + conflicts + failed
        report['first_review'] = {'units': len(pending), 'reviewed_units': len(reviewed),
            'obligations': sum(len(u['obligations']) for u in pending if u['field'] in reviewed),
            'failed': len(failed), 'deterministic_findings': len(defects) - len(failed)}
        report['unreviewed_units'] = [u['field'] for u in pending if u['field'] not in reviewed]
        report['status'] = 'partially_reviewed' if stopped else 'reviewed'
        if defects and _remaining(state) >= REPAIR_SECONDS and not _unknown(trace):
            content, changed, trace = repair(state, plan, content, defects, invoke, trace)
            report['repaired_slots'] = changed
            if changed:
                letter = render(state, plan, content)
                touched = {_unit_of(path) for path in changed}
                valid = {r['field']: r for r in report['receipts']}
                current = final_units = units(state, plan, letter, content)
                recheck = [u for u in current if u['field'] in reviewed
                           and not (u['field'] in valid and receipt_matches(u, valid[u['field']]))
                           and (u['field'] in touched or u['field'] not in valid)]
                recheck = [u for u in recheck if u['field'] in touched]
                signed, refailed, rechecked, trace, stopped = review(state, recheck, invoke, trace, RECHECK_SECONDS)
                report['receipts'] = [r for r in report['receipts'] if r['field'] not in touched] + signed
                report['unreviewed_units'] += [u['field'] for u in recheck if u['field'] not in rechecked]
                # Findings on untouched text stay; changed text is judged anew.
                untouched = [d for d in failed if d.get('audit_unit') not in touched]
                literal = {_norm(d.get('artifact_quote')) for d in conflicts}
                remaining_conflicts = [d for d in portfolio_defects(state['package'], state['strategy'], letter)
                                       if _norm(d.get('artifact_quote')) in literal]
                defects = _deterministic(state, plan, letter, content) + remaining_conflicts + untouched + refailed
                report['status'] = 'repaired_partially_rechecked' if stopped else 'repaired_and_rechecked'
    except Exception as error:  # A review failure must not discard the paid letter.
        review_error = error
        history = getattr(error, 'trace_history', None)
        if history:
            trace = list(history)
        elif getattr(error, 'trace', None):
            trace = trace + [error.trace]
        report['status'] = 'review_unavailable'
        report['review_error'] = str(error)[:300]
    words = analytical_words(letter)
    errors = list(dict.fromkeys(d['message'] for d in defects))
    if words > WORD_LIMIT:
        errors.append('El Audit excede la extensión ejecutiva acordada.')
    if review_error is not None and _unknown(trace):
        errors.append('La comprobación del Audit quedó sin resultado confirmado del proveedor; se conserva la carta.')
    report['observations'] = defects
    report['analytical_words'] = words
    # Proofs travel with the Submission receipts to the exact-file review; a
    # rewritten Audit replaces the proofs of the previous one.
    carried = [r for r in state.get('field_review_receipts') or [] if r.get('version') != REVIEW_VERSION]
    return {'letter': letter, 'trace': trace,
            'field_review_receipts': carried + proofs(final_units, report['receipts']), 'writer_attempts': state.get('writer_attempts', 0) + 1,
            'writer_validated': not errors, 'errors': errors,
            'audit_build': {'version': VERSION, 'content': content,
                            'slots': {'portfolio': plan['portfolio'], 'people': plan['people'],
                                      'leaders': plan['leaders'], 'comparisons': plan['comparisons']}},
            'audit_review': report}
