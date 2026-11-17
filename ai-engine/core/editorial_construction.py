"""Construct one shared decision plan, then independently owned writing units.

Each paid unit is checkpointed before the next one. Original sources and the
validated selection are inputs, never outputs. This is construction, not repair.
"""
import copy
import re
import hashlib
import json
from typing import Literal
from pydantic import ConfigDict, create_model
from core import construction_bindings, reserve_comparisons

VERSION = 'editorial-construction-v1'
BATCH_SIZE = 4
BIO_FIELDS = ('submission_bio', 'profile_coverage', 'submission_case_coverage', 'biography_depth')
PLAN_FIELDS = ('case_plan', 'filing_recommendation', 'positioning', 'target',
               'target_rationale', 'principal_strength', 'principal_vulnerability',
               'hero_rationale', 'comparisons')

COMMON = '''Use only the supplied original evidence and immutable selected portfolio.
Write the requested unit only. Do not change other units, selection or shared decisions.
Preserve source qualifications, chronology, actors, currencies and uncertainty.
Do not convert a firm action into an individual achievement, a former employer into
a client, team membership into leadership, or a pending case into a victory.
Generated plans are decisions to execute, not independent evidence. Public text
speaks as the firm, never as the source auditor. Keep missing evidence and questions
in internal decision fields; do not ask for facts already supplied.'''

PLAN_TASK = COMMON + ''' Prepare shared editorial decisions BEFORE prose. Do not write
B9, B10, C2 or matter narratives. Account for every selected matter and every lawyer
once. For each matter select literal source anchors for legal issue, concrete work,
documented results/current stage, material scale and actual roles. These anchors
govern the subsequent narrative; selecting them is not proof of execution.
Form the institutional case_plan, comparative hero rationale and concrete reserve
tradeoffs from original evidence. A reserve remains eligible personal evidence.
For each lawyer decide nomination, proposed category, reason, personally attributed
support and remaining action. Do not equate maturity descriptors with directory
categories or unverified targets with current recognition. Use Category pending
with the specific undecided criterion and action when no defensible category is
established. Preserve supplied objectives or explain a proposed change. Evaluate
additional source leaders internally without inventing roster titles.'''
PLAN_TASK += '\n' + reserve_comparisons.INSTRUCTION

MATTER_TASK = COMMON + ''' Write these matter narratives in English. The destination
and original restrictions are explicit in field_contracts. E is confidential:
retain the client's evidenced identity, legal mechanisms, locations, workforce,
proceedings and financial context with their actual concepts unless an ORIGINAL
restriction covers that fact. Public B9/B10/C2 rules do not erase E evidence.
D is public: respect actual permissions, including a restricted value distinct
from identity. Develop commercial purpose, legal obstacle, firm intervention,
lawyer role and achieved result or actual stage. State the documented procedural
status (e.g., ongoing, completed or pending resolution) inside the matter
narrative itself whenever present in the source. Never soften or hedge a sourced
achieved result into a mere aim (write "preserved" rather than "sought to
preserve" when achieved), and retain sourced strategic significance or precedent.
If confidentialityEvidence.client_register and the narrative disagree on a
nonessential client sector, omit the disputed sector label. Incorporate later documented
updates without inventing resolution of conflicting source outcomes. Execute all
material anchors meaningfully, not as a list of quotations. Never insert advice
about publication or what the source does not say. completion_status describes
the documented stage only in neutral factual terms (never audit voice such as
"not stated", "source does not explain", "pending confirmation" or "unresolved").
Do not return new anchors or change the selected facts.'''

def bio_task():
    from core.biography_depth import DEPTH_INSTRUCTION
    return COMMON + ''' Write ONLY this person's English B9 and its evidence bindings.
The shared nomination/category/attribution decision is read-only. If the source or
filing_details confirms this lawyer as department head, state that department-head
role explicitly in submission_bio. Preserve material career credentials, scale
qualifiers (such as "high-value" disputes), prior
employment, professional offices (such as bar association committee/officer roles)
and all substantive personally attributed core/reserve work without softening
sourced achieved results into aims. Vary sentence openings across matter
paragraphs (never start consecutive paragraphs with repetitive phrases such as
"named lead partner"). Distinguish their own
role from the firm's result. Generalise private client identities and identifying
metric combinations without deleting legal substance. A biography employer or
association is not a client; generalisation requires an actual restriction for
that entity/relationship. Bind each original profile unit/entity in
profile_coverage: entity_name MUST appear literally in THAT unit's source_quote
(never from another unit), copy source_quote literally, and for every retained
credential copy public_quote verbatim from the actual resulting submission_bio.
Preserve every distinct substantive contribution in submission_case_coverage. Do
not narrate verification rules, missing rankings or source sufficiency in public
prose. Keep limited team participation proportionate without inventing a
nomination or personal result.

ARCHITECTURE OF A NOMINATED B9 (the method the editorial owner applies):
1. Opening, one or two sentences: who this lawyer is in THIS practice: current
   role, confirmed headship, and the kind of legal problem clients bring them,
   shown by the evidence rather than adjectives.
2. Body grouped by two to four legal themes drawn from their own mandates
   (for example development continuity, expropriation, boundaries). Open each
   theme with its most significant mandate: the client's problem, the legal
   obstacle, this lawyer's own action or strategy, and the achieved result or
   exact current stage with its decisive scale. Related mandates in the same
   theme follow briefly. Never one paragraph per matter in list form.
3. Career credentials (education, teaching, professional offices, prior
   employment) appear once, where they explain the expertise.
4. Close with one factual sentence on what this body of work shows for the
   target practice: no superlatives, no ranking claims.
Use natural verbs for the lead role (led, advised, represented); form
vocabulary such as "named lead partner" is replaced by the application. State a
confirmed headship once, in the opening. Write in the active voice (never "is
led by X" or a trailing "; X leads the matter") and never as a list of matters
("X also leads…", "Finally, X leads…"): at most eight paragraphs. The application
checks this shape before review.
''' + DEPTH_INSTRUCTION

INSTITUTION_TASK = COMMON + ''' Write B10 and C2 in English from the SAME institutional
case_plan, speaking directly as the firm (never audit voice or market superlatives).
B10 demonstrates the practice's evidenced identity and capabilities. 1,000 words
is a MAXIMUM, not a target and not a 500-word limit: develop as far as the
evidence supports, never padding. When the original department narrative
(b10_source) is short, EXPAND it with the portfolio's evidenced mechanisms and
results; never compress or drop its substance (allocate depth to the evidence, not
a sequential case list): (1) open with the strongest strategic differentiator from
this portfolio; (2) cover industry sector expertise, geographic/national footprint
and areas of recent growth where evidenced in the sources; (3) develop all shared
institutional_arguments and other documented capability pillars with concrete legal
mechanisms and outcomes; and (4) integrate department leadership and bench depth
(confirmed heads, team architecture and distinct practitioner roles/credentials
grounded in lawyers and shared_decisions, without inventing partner status or
rankings). C2 argues once for the requested coverage with distinct supported
reasons developed with concrete evidence (same 1,000-word maximum, expanding a
short original c2_source rather than shortening it), without two equivalent opening sentences, copying B10 or repeating a
service catalogue. Use actual retrieved peer evidence only within its scope; never
invent market standing. Both are public: generalise confidential identities and
identifying combinations of geography, transaction details and private metrics
while preserving legal work and career credentials. A former employer, public
office or professional association named in a lawyer's profile is a career fact,
not a client: keep its name unless an explicit restriction covers it. When you
state the size of the team, use department_size exactly: partners and other
lawyers are separate figures; never present either one as the whole team, and a
total is only their sum. Return institutional_execution
with literal b10_quote/c2_quote for each shared argument. These bindings are
internal, not additional public copy.'''

# One self-correction per construction unit: enough to act on a precise
# validator diagnosis, never an open-ended paid loop.
MAX_UNIT_CORRECTIONS = 1
CORRECTION_TASK = '''
SELF-CORRECTION: validator_feedback.rejected_response is your previous answer for
THIS SAME unit, validator_feedback.errors is the application's exact reason for
rejecting it, and validator_feedback.expected states concretely what each
corrected element must contain (allowed IDs, exact source records). Return the
complete corrected unit in the same schema. Follow every expected item
literally; keep every part of the previous answer that the errors do not concern. Remove a claim the original records do not support rather than
inventing evidence for it. Do not change the selection, other units or sources.'''


def recover_plan(package, strategy, plan, pending, correcting, source_owned):
    """Fix what the application knows; after the one correction, never stop."""
    from core import plan_recovery
    value,dropped=drop_unbound_support(package,strategy,plan)
    if dropped:pending.setdefault('dropped_support',[]).extend(dropped)
    value,fixes=plan_recovery.exact_fixes(package,strategy,value)
    if correcting:
        # The single paid correction has been used: conservative, source-bound
        # defaults close whatever remains, recorded as observations.
        value,fallbacks=plan_recovery.safe_fallbacks(package,strategy,value)
        fixes+=fallbacks
    skipped=[]
    if source_owned:value=construction_bindings.complete_plan_support(package,strategy,value,skipped)
    fixes+=[{'fallback':'required_support_without_literal_source',**s} for s in skipped]
    if fixes:pending.setdefault('plan_fixes',[]).extend(fixes)
    return value


PENDING_SOURCE = re.compile(r'\b(?:pending|ongoing|in progress|remains? (?:active|open|pending|ongoing)|awaiting|sub judice|pendiente|en tr[áa]mite|en curso)\b', re.I)
PENDING_OUTPUT = re.compile(r'\b(?:pending|ongoing|in progress|remain\w*|awaiting|continu\w+|active|not yet|under way|underway)\b', re.I)


def status_faults(package, matters):
    """A documented pending stage must be stated; a mandate to file is not a filing."""
    register={m['id']:m for m in package.get('matters',[])}
    faults=[]
    for item in matters:
        source=register.get(item.get('matter_id'),{})
        text=' '.join(str(source.get(k) or '') for k in ('source_excerpt','rawNotes','summary','completionDate','otherInfo'))
        output=f"{item.get('text','')} {item.get('completion_status','')}"
        label=source.get('client') or item.get('matter_id')
        if PENDING_SOURCE.search(text) and not PENDING_OUTPUT.search(output) and not re.search(r'\b(?:won|concluded|completed|final judgment|dismissed)\b',text,re.I):
            faults.append(f'{label}: the source records a pending or ongoing stage; state the current procedural status in the narrative or completion_status.')
        if re.search(r'\b(?:hired|retained|engaged|instructed) to (?:file|bring|initiate|commence)\b',text,re.I) and re.search(r'\b(?:filed|brought|initiated|commenced)\b',output,re.I) and not re.search(r'\b(?:filed|brought|initiated|commenced)\b',text,re.I):
            faults.append(f'{label}: the source says the firm was hired to file the action, not that it was filed; describe the mandate without inventing the procedural step.')
    return faults


def length_faults(package, value):
    """B10/C2 must develop the original up to a 1,000-word maximum, never shrink it."""
    words=lambda text:len(str(text or '').split())
    faults=[]
    for field,source_key in (('b10','b10_source'),('c2','c2_source')):
        generated,original=words(value.get(field)),words(package.get(source_key))
        if generated>1000:
            faults.append(f'{field.upper()} has {generated} words; the maximum is 1,000. Keep every evidenced argument and tighten wording only.')
        elif original>=150 and generated<0.9*original:
            faults.append(f'{field.upper()} has {generated} words but the original {source_key} has {original}. Develop it with the supplied evidence up to at most 1,000 words; do not compress or drop its substance.')
    return faults


def department_size(package):
    """Exact headcount from the filing form; the total is computed, never guessed."""
    details=package.get('filing_details') or {}
    def number(value):
        try:return int(str(value).strip())
        except (TypeError,ValueError):return None
    partners,others=number(details.get('num_partners')),number(details.get('num_lawyers'))
    result={'partners':partners,'other_lawyers':others}
    if partners is not None and others is not None:result['total']=partners+others
    return result


PARALLEL_KINDS = ('matters', 'bio')


def parallel_units():
    import os
    try:return max(1,min(6,int(os.environ.get('RANKPILOT_PARALLEL_UNITS','4'))))
    except ValueError:return 1


def parallel_batch(pending):
    """Consecutive independent units from the front, none under self-correction."""
    feedback=(pending.get('unit_feedback') or {}).get('unit')
    batch=[]
    for unit in pending['pending_groups']:
        if unit.get('kind') not in PARALLEL_KINDS or unit==feedback or len(batch)>=parallel_units():break
        batch.append(unit)
    return batch


def run_parallel(state, invoke, build, batch):
    """Invoke independent units concurrently; return {unit_key: (value, trace_entry) | exception}.

    Each call runs in a copy of the current context so the request budget and
    usage accounting apply exactly as in a sequential call.
    """
    import contextvars
    from concurrent.futures import ThreadPoolExecutor
    jobs={}
    for unit in batch:
        schema,task,payload,_,_,_,kind,_=build(unit)
        jobs[unit_key(unit)]=(unit,schema,task,payload,kind)
    def call(item):
        unit,schema,task,payload,kind=item
        try:
            value,trace=invoke({**state,'trace':[],'rag_unit':kind},'development',schema,task,payload)
            entry=trace[-1] if trace else {'role':'development','usage':{'unknown_calls':1},'usage_status':'unknown'}
            return value,{**entry,'construction_unit':copy.deepcopy(unit),'parallel_batch':len(batch)}
        except Exception as error:  # Returned, never lost: siblings keep their paid results.
            return error
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        futures={key:pool.submit(contextvars.copy_context().run,call,item) for key,item in jobs.items()}
        return {key:future.result() for key,future in futures.items()}


def unit_key(unit):
    return json.dumps(unit, sort_keys=True)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()

def decision_snapshot(proposal):
    return {'case_plan':copy.deepcopy(proposal.get('case_plan', {})),
            **{k:copy.deepcopy(proposal.get(k)) for k in PLAN_FIELDS if k != 'case_plan'},
            'candidates':[{k:copy.deepcopy(v) for k,v in c.items() if k not in BIO_FIELDS}
                          for c in proposal.get('candidates', [])]}

def source_key(state):
    # Transport-generated documents and review receipts are not original inputs.
    excluded={'rendered_artifact','rendered_audit','rendered_candidate_bios',
              'editorial_development','_verified_field_obligations','field_review_receipts'}
    return digest({'package':{k:v for k,v in state['package'].items() if k not in excluded},
                   'strategy':state['strategy']})

def model_fields(model, keys):
    return {k:(model.model_fields[k].annotation, copy.deepcopy(model.model_fields[k])) for k in keys}

def strict_model(name, fields):
    return create_model(name, __config__=ConfigDict(extra='forbid'), **fields)

def contracts(package, strategy):
    register={m['id']:m for m in package.get('matters', [])}
    def destination(matter):
        if matter.get('publication_route') in ('D','E'):return matter['publication_route']
        return 'D' if matter.get('publish_status')=='publishable' else 'E'
    return {d['matter_id']:{'destination':destination(register[d['matter_id']]),
            'source_id':d['matter_id'], 'dimensions':['commercial_objective','legal_obstacle',
            'firm_intervention','personal_role','result_or_stage','material_scale'],
            'restriction_evidence':copy.deepcopy(register[d['matter_id']].get('confidentialityEvidence', {})),
            'instruction':'Preserve evidenced meaning and explicit restrictions. Missing source facts are not invented.'}
            for d in strategy.get('matters', []) if d.get('disposition')=='core'}

def schemas(package, strategy):
    from core.editorial_development import development_contract
    full=development_contract(package, strategy, personal_quality=True, biography_depth=True)
    candidate=full.model_fields['candidates'].annotation.__args__[0]
    matter=full.model_fields['matters'].annotation.__args__[0]
    decision=strict_model('SharedCandidateDecision',model_fields(candidate,[k for k in candidate.model_fields if k not in BIO_FIELDS]))
    anchor=strict_model('MatterEvidencePlan',model_fields(matter,('matter_id','legal_issue_source_quote','decisive_source_quotes')))
    plan=strict_model('SharedEditorialPlan',{**model_fields(full,PLAN_FIELDS),
        'candidates':(list[decision],...), 'matters':(list[anchor],...)})
    return full, candidate, matter, plan

def reconcile_categories(plan):
    """A professional maturity descriptor must not become a verified category."""
    for c in plan.get('candidates', []):
        normalized=''.join(ch for ch in c.get('suggested_ranking','').casefold() if ch.isalpha())
        if normalized!='establishedindividual':continue
        c['suggested_ranking']='Category pending'
        c['category_missing_criterion']='La madurez profesional descrita no identifica por sí sola una categoría concreta de la guía y edición objetivo.'
        c['recommended_action']='Confirmar la categoría concreta aplicable y contrastar su criterio con la trayectoria y los mandatos ya documentados.'
        c['category_rationale'] += ' La experiencia establecida sustenta la candidatura, pero la categoría concreta permanece pendiente.'
        if c.get('category_assessment'):
            c['category_assessment']={**c['category_assessment'],'decision':'pending','criterion':'pending'}
    return plan

def drop_unbound_support(package, strategy, plan):
    """Withdraw supporting claims the original records do not sustain.

    A supporting entry is the model's claim that a mandate supports a person.
    One that cites a passage absent from that record, names a record outside the
    eligible portfolio, or attributes a mandate whose record does not name the
    person is a false attribution: it is removed, never repaired by inventing a
    role. Required personal mandates are restored afterwards from canonical lead
    records by complete_plan_support, and validate_plan still runs on the result.
    """
    from core.editorial_development import bind_quote
    from core.editorial_case import support_ids
    from core.role_evidence import matter_names_person
    register={m['id']:m for m in package.get('matters', [])}
    eligible=support_ids(package,strategy)
    result=copy.deepcopy(plan);dropped=[]
    for candidate in result.get('candidates', []):
        kept=[]
        for item in candidate.get('supporting_matters', []):
            matter=register.get(item.get('matter_id'),{})
            reason=('not_eligible' if item.get('matter_id') not in eligible else
                    'quote_not_in_record' if not bind_quote(item.get('source_quote',''),matter) else
                    'person_not_named_in_record' if not matter_names_person(candidate['name'],matter) else None)
            if reason:
                dropped.append({'candidate':candidate['name'],'matter_id':item.get('matter_id'),'reason':reason})
            else:
                kept.append(item)
        candidate['supporting_matters']=kept
    return result,dropped


def validate_plan(package, strategy, plan):
    from core.editorial_development import bind_quote
    from core.editorial_case import case_errors, support_ids
    from core.role_evidence import matter_names_person
    expected=[d['matter_id'] for d in strategy['matters'] if d['disposition']=='core']
    actual=[m['matter_id'] for m in plan['matters']]
    names=[p.get('name') or p.get('fullName') for p in package.get('lawyers', [])]
    if len(actual)!=len(expected) or set(actual)!=set(expected):raise ValueError('Plan must cover the exact selected matters once')
    if sorted(c['name'] for c in plan['candidates'])!=sorted(names):raise ValueError('Plan must cover the exact roster once')
    errors=case_errors(package,strategy,plan)
    register={m['id']:m for m in package['matters']}
    for m in plan['matters']:
        if not m['decisive_source_quotes']:errors.append('Missing material evidence anchors: '+m['matter_id'])
        for quote in [m['legal_issue_source_quote'], *m['decisive_source_quotes']]:
            if not bind_quote(quote,register[m['matter_id']]):errors.append('Unbound original matter anchor: '+m['matter_id'])
    for c in plan['candidates']:
        for s in c['supporting_matters']:
            m=register.get(s['matter_id'],{})
            if s['matter_id'] not in support_ids(package,strategy) or not bind_quote(s['source_quote'],m) or not matter_names_person(c['name'],m):
                errors.append('Unbound personal attribution: '+c['name'])
    if errors:raise ValueError('; '.join(errors))


def person_obligations(requirements, name):
    result=copy.deepcopy(requirements)
    result['profile_requirements']=[p for p in result.get('profile_requirements',[]) if p.get('name')==name]
    for key in ('personal_work_requirements','personal_evidence'):
        result[key]={name:result.get(key,{}).get(name,[])}
    participation=result.get('participation_requirements',{})
    if 'people' in participation:participation['people']={name:participation['people'].get(name,[])}
    result.pop('additional_leaders',None)
    return result


def prepare_comparison_completion(package, strategy, pending, legacy_schema):
    """Recover only a proven coverage omission, never regenerate an accepted plan.

The original response remains attached to the checkpoint. A completion has one
owned set of missing reserves, so another click/deploy cannot replenish it.
"""
    if pending.get('failed_unit', {}).get('kind') != 'plan' or pending.get('plan_comparison_recovery'):
        return False
    try:
        plan = legacy_schema.model_validate(pending.get('rejected_response')).model_dump()
        absent = reserve_comparisons.missing(strategy, plan['comparisons'])
        if not absent:
            return False
        try:
            validate_plan(package, strategy, plan)
        except ValueError as error:
            allowed = {reserve_comparisons.MISSING_ERROR, 'Falta una comparación visible de frontera en el Audit.'}
            if not set(str(error).split('; ')).issubset(allowed):
                return False
        else:
            return False
    except (ValueError, TypeError, KeyError):
        return False
    pending['work'] = copy.deepcopy(plan)
    pending['plan_comparison_recovery'] = {'version': reserve_comparisons.VERSION,
        'missing_ids': absent, 'preserved_comparisons': copy.deepcopy(plan['comparisons']), 'attempted': False}
    pending.pop('failed_unit', None)
    pending.pop('validation_error', None)
    pending['pending_groups'] = [{'kind': 'plan_comparisons', 'ids': absent}]
    pending['content_hash'] = digest(pending['work'])
    return True


def schedule_writing(package, strategy, pending):
    work = pending['work']
    ordered = [d['matter_id'] for d in strategy['matters'] if d['disposition'] == 'core']
    by_id = {m['matter_id']: m for m in work['matters']}
    work['matters'] = [by_id[mid] for mid in ordered]
    by_name = {c['name']: c for c in work['candidates']}
    work['candidates'] = [by_name[p.get('name') or p.get('fullName')] for p in package.get('lawyers', [])]
    pending['pending_groups'] += ([{'kind': 'matters', 'ids': ordered[i:i+BATCH_SIZE]} for i in range(0, len(ordered), BATCH_SIZE)]
        + [{'kind': 'bio', 'index': i} for i in range(len(work['candidates']))] + [{'kind': 'institutional'}])

def advance(state, invoke):
    """One completed provider response per durable request; direct callers loop."""
    from core.editorial_development import bind_development, development_errors, DEVELOPMENT_VERSION
    from core.editorial_execution import EXECUTION_CONTRACT
    from core.personal_quality import PERSONAL_QUALITY_CONTRACT
    from core.biography_depth import DEPTH_CONTRACT
    package=state['package'];strategy=state['strategy'];trace=list(state.get('trace',[]))
    full,candidate,matter,plan_schema=schemas(package,strategy)
    pending=copy.deepcopy(state.get('repair_continuation') or {})
    if pending and (pending.get('version')!=VERSION or pending.get('source_key')!=source_key(state)
                    or pending.get('content_hash')!=digest(pending.get('work'))):
        raise ValueError('Saved construction no longer matches its sources or completed units')
    if pending.get('failed_unit'):
        prepare_comparison_completion(package, strategy, pending, plan_schema)
    if pending.get('failed_unit'):
        return {'development':copy.deepcopy(pending['work']),'repair_continuation':pending,
                'development_validated':False,'development_repair_unlocatable':True,
                'errors':['La respuesta guardada requiere corregir su contrato antes de continuar.'],'trace':trace}
    if not pending:
        pending={'version':VERSION,'source_key':source_key(state),'work':{},
                 'pending_groups':[{'kind':'plan'}], 'completed_units':[],
                 'binding_contract':construction_bindings.VERSION,
                 'plan_binding_contract':reserve_comparisons.VERSION}
    def build(unit):
        """Schema, task and payload of one unit; pure, so it can be prepared for a batch."""
        kind=unit['kind'];work=pending['work']
        source_owned=pending.get('binding_contract')==construction_bindings.VERSION
        bindings=None
        common={k:copy.deepcopy(package[k]) for k in ('directory','practice_area','firm_name',
            'guide_region','jurisdiction','ranking_edition','research_period','filing_details') if k in package}
        if kind=='plan':
            schema=plan_schema;task=PLAN_TASK
            payload={'package':package,'strategy':strategy,'source_obligations':state.get('case_requirements',{}),
                     'field_contracts':contracts(package,strategy)}
            if pending.get('plan_binding_contract') == reserve_comparisons.VERSION:
                schema = reserve_comparisons.plan_schema(plan_schema, strategy)
                payload['reserve_comparison_bindings'] = reserve_comparisons.bindings(strategy)
        elif kind=='plan_comparisons':
            bindings = reserve_comparisons.bindings(strategy, unit['ids'])
            preserved = work['comparisons']
            schema = reserve_comparisons.completion_schema(plan_schema, strategy, bindings, preserved)
            task = COMMON + '\n' + reserve_comparisons.INSTRUCTION + '\nComplete ONLY the missing comparisons. The accepted shared plan and existing comparisons are read-only; do not generate biographies, matter narratives or institutional prose.'
            ids = set(unit['ids']) | {d['matter_id'] for d in strategy['matters'] if d['disposition'] == 'core'}
            payload = {'package': {**common, 'matters': [m for m in package['matters'] if m['id'] in ids]},
                'strategy': strategy, 'reserve_comparison_bindings': bindings,
                'preserved_comparisons': preserved, 'institutional_case': work['case_plan'],
                'hero_rationale': work['hero_rationale']}
        elif kind=='matters':
            ids=unit['ids'];schema=strict_model('MatterNarratives',{'matters':(list[strict_model('OwnedNarrative',{
                'matter_id':(Literal[tuple(ids)],...),**model_fields(matter,('text','completion_status'))})],...)})
            task=MATTER_TASK;payload={'package':{**common,'matters':[m for m in package['matters'] if m['id'] in ids]},
                'field_contracts':{i:contracts(package,strategy)[i] for i in ids},
                'evidence_plan':[m for m in work['matters'] if m['matter_id'] in ids], 'thesis':strategy.get('thesis','')}
            if source_owned:
                bindings=construction_bindings.matter_bindings(payload['evidence_plan'])
                schema=construction_bindings.matter_schema(matter,bindings)
                payload['source_bindings']=bindings
                task += '\nWrite the supplied canonical matter slots exactly once. Do not return matter IDs or source quotations: the application owns them. For every original anchor return anchor_execution with an exact passage from this same narrative that develops its material meaning. A public restriction changes disclosure, not legal substance. Bindings are not a semantic approval: retain all original qualifications, actors and outcomes in the prose.'
        elif kind=='bio':
            i=unit['index'];c=work['candidates'][i]
            schema=strict_model('OwnedBiography',model_fields(candidate,BIO_FIELDS));task=bio_task()
            if source_owned:
                bindings=construction_bindings.biography_bindings(package,strategy,c)
                schema=construction_bindings.biography_schema(candidate,bindings)
                task += '\nSOURCE-OWNED OUTPUT: profile_coverage keys are the original profile units; provide entity decisions for every unit without copying its original quotation or reference. submission_case_coverage keys are the supplied case_sources; return the exact B9 passage for each mandatory mandate and null only for unused optional mandates. The application inserts original source quotes and matter IDs. Read each complete original mandate for the actual issue, actor and achieved result. A lead record is not evidence that the lead personally performed every firm action. Preserve the required number of distinct contributions; these bindings do not certify semantic quality.'
            # Include full register restrictions; only own eligible sources carry narrative evidence.
            from core.role_evidence import matter_names_person
            from core.editorial_case import support_ids
            eligible=support_ids(package,strategy)
            ids={s['matter_id'] for s in c['supporting_matters']}
            ids.update(m['id'] for m in package['matters'] if m['id'] in eligible and matter_names_person(c['name'],m))
            payload={'package':{**common,'lawyers':[p for p in package.get('lawyers',[]) if (p.get('name') or p.get('fullName'))==c['name']],
                'matters':[m for m in package['matters'] if m['id'] in ids]},
                'privacy_register':construction_bindings.privacy_register(package),
                'shared_decision':c,'source_obligations':person_obligations(state.get('case_requirements',{}),c['name']),
                'eligible_support_ids':sorted(ids & eligible)}
            if bindings is not None:payload['source_bindings']=bindings
        else:
            schema=strict_model('InstitutionalProse',model_fields(full,('b10','c2','institutional_execution')))
            if source_owned:schema=construction_bindings.institutional_schema(full,work['case_plan'])
            selected={d['matter_id'] for d in strategy['matters'] if d['disposition']=='core'}
            task=INSTITUTION_TASK;payload={'package':{**package,'matters':[m for m in package['matters'] if m['id'] in selected]},
                'privacy_register':construction_bindings.privacy_register(package),
                'shared_decisions':decision_snapshot(work),'strategy':strategy,
                'department_size':department_size(package)}
            if source_owned:
                payload['argument_bindings']={f'A{i+1:02d}':a for i,a in enumerate(work['case_plan']['institutional_arguments'])}
                task += '\nReturn institutional_execution for every supplied argument_bindings key, with distinct exact B10 and C2 passages. These argument_bindings are the shared core pillars to execute, not a cap on B10 structure: B10 must also cover opening thesis, sectors, footprint/growth when evidenced, and department leadership/bench depth. The application inserts the canonical argument index; do not select or reorder a different plan.'
        feedback=pending.get('unit_feedback') or {}
        correcting=feedback.get('unit')==unit
        if correcting:
            # The validator already said exactly what is wrong with this unit's
            # last response. Give that diagnosis back once and ask for the same
            # unit corrected, instead of stopping the whole case.
            payload={**payload,'validator_feedback':{'errors':feedback['errors'],'expected':feedback.get('expected',[]),
                     'rejected_response':feedback['rejected_response']}}
            task += CORRECTION_TASK
        return schema,task,payload,bindings,correcting,source_owned,kind,work

    prefetched={}
    while pending['pending_groups']:
        unit=pending['pending_groups'][0]
        schema,task,payload,bindings,correcting,source_owned,kind,work=build(unit)
        key=unit_key(unit)
        if key not in prefetched and state.get('durable_repair_steps') and not correcting and kind in PARALLEL_KINDS:
            batch=parallel_batch(pending)
            if len(batch)>1:prefetched.update(run_parallel(state,invoke,build,batch))
        if key in prefetched:
            outcome=prefetched.pop(key)
            if isinstance(outcome,BaseException):
                if any(not isinstance(o,BaseException) for o in prefetched.values()):
                    # Keep every paid sibling: process them first, this unit last.
                    pending['pending_groups'].append(pending['pending_groups'].pop(0))
                    prefetched[key]=outcome
                    continue
                failed=[getattr(e,'trace',None) for e in [outcome,*prefetched.values()] if isinstance(e,BaseException)]
                trace=trace+[t for t in failed if isinstance(t,dict)]
                if state.get('durable_repair_steps') and pending['completed_units']:
                    pending['content_hash']=digest(work)
                    return {'development':copy.deepcopy(work),'development_validated':False,'errors':[],
                            'development_repair_unlocatable':False,'repair_continuation':pending,'trace':trace}
                raise outcome
            value,entry=outcome
            trace=trace+[entry]
        else:
            value,new_trace=invoke({**state,'trace':trace,'rag_unit':kind},'development',schema,task,payload)
            if len(new_trace)>len(trace):
                new_trace=[*new_trace[:-1],{**new_trace[-1],'construction_unit':copy.deepcopy(unit)}]
            trace=new_trace
        try:
            value=schema.model_validate(value).model_dump()
            if kind=='plan':
                if pending.get('plan_binding_contract') == reserve_comparisons.VERSION:
                    value = reserve_comparisons.expand_plan(value, strategy)
                value=reconcile_categories(value)
                value=recover_plan(package,strategy,value,pending,correcting,source_owned)
                validate_plan(package,strategy,value)
                work.update(value)
                schedule_writing(package, strategy, pending)
            elif kind=='plan_comparisons':
                pending['plan_comparison_recovery']['attempted'] = True
                completed = copy.deepcopy(work)
                completed['comparisons'] += reserve_comparisons.expand(value, bindings)
                completed = recover_plan(package, strategy, completed, pending, correcting, False)
                validate_plan(package, strategy, completed)
                work.update(completed)
                pending['plan_comparison_recovery']['completed'] = True
                schedule_writing(package, strategy, pending)
            elif kind=='matters':
                if source_owned:
                    value,receipts=construction_bindings.expand_matters(value,bindings)
                    pending.setdefault('anchor_bindings',[]).extend(receipts)
                if sorted(m['matter_id'] for m in value['matters'])!=sorted(unit['ids']):raise ValueError('Narrative batch must cover each owned matter exactly once')
                faults=status_faults(package,value['matters'])
                if faults and not correcting:raise ValueError('; '.join(faults))
                if faults:pending.setdefault('status_observations',[]).extend(faults)
                values={m['matter_id']:m for m in value['matters']}
                work['matters']=[{**m,**values.get(m['matter_id'],{})} for m in work['matters']]
            elif kind=='bio':
                if source_owned:value=construction_bindings.expand_biography(value,bindings)
                # Style rules the prompt alone has not held: title in the first
                # sentence and varied paragraph openings, enforced in code.
                from core import biography_openings,biography_shape,prose_rules
                profile={**work['candidates'][unit['index']],**value}
                profile,titled=biography_openings.place_title(profile,package)
                profile,_=prose_rules.polish_candidate(profile,package)
                shape=biography_shape.faults(profile)
                prior=(pending.get('shape_fallback') or {}).get(key)
                if shape and not correcting:
                    # Ángela's B9 architecture, checked before review: one
                    # self-correction with the exact expectation; this draft is
                    # kept in case the correction is worse.
                    pending.setdefault('shape_fallback',{})[key]={'fields':{k:profile[k] for k in value},'faults':len(shape)}
                    raise ValueError('; '.join(shape))
                if correcting and prior and len(shape)>prior['faults']:
                    profile={**profile,**prior['fields']}
                    shape=biography_shape.faults(profile)
                    pending.setdefault('bio_shape',[]).append({'candidate':profile['name'],'kept_prior':True})
                if shape:pending.setdefault('shape_observations',[]).extend(shape)
                (pending.get('shape_fallback') or {}).pop(key,None)
                profile,trace,style=biography_openings.vary_openings(state,invoke,profile,trace)
                if titled or style:
                    pending.setdefault('bio_style',[]).append({'candidate':profile['name'],'title_placed':titled,**(style or {})})
                work['candidates'][unit['index']].update({k:profile[k] for k in value})
            else:
                if source_owned:value=construction_bindings.expand_institutional(value,work['case_plan'])
                faults=length_faults(package,value)
                if faults and not correcting:
                    # Ángela's rule: develop up to 1,000 words, never shrink the
                    # original. One self-correction states the exact expectation.
                    raise ValueError('; '.join(faults))
                if faults:pending.setdefault('length_observations',[]).extend(faults)
                work.update(value)
        except Exception as error:
            # Retain the rejected response and usage without replaying a paid unit.
            corrections=pending.setdefault('unit_corrections',{})
            key=unit_key(unit)
            pending.setdefault('rejected_responses',[]).append({'unit':copy.deepcopy(unit),'error':str(error)[:4000],
                'correction':corrections.get(key,0)})
            remaining=list(pending['pending_groups'])
            pending['failed_unit']=unit;pending['rejected_response']=value
            pending['validation_error']=str(error);pending['pending_groups']=[]
            pending['content_hash']=digest(work)
            if kind == 'plan' and prepare_comparison_completion(package, strategy, pending, plan_schema):
                pending.pop('unit_feedback',None)
                if not state.get('durable_repair_steps'):
                    continue
                return {'development':copy.deepcopy(pending['work']), 'development_validated':False,
                        'development_repair_unlocatable':False, 'repair_continuation':pending, 'errors':[], 'trace':trace}
            if corrections.get(key,0)<MAX_UNIT_CORRECTIONS:
                # Self-correct the same unit once with the validator's own
                # diagnosis and the concrete expected content. Completed
                # units, sources and usage are kept.
                corrections[key]=corrections.get(key,0)+1
                expected=[]
                if kind in ('plan','plan_comparisons') and isinstance(value,dict):
                    from core import plan_recovery
                    expected=plan_recovery.expectations(package,strategy,value if kind=='plan' else work,str(error).split('; '))
                pending['unit_feedback']={'unit':copy.deepcopy(unit),'errors':str(error)[:4000],'expected':expected,'rejected_response':value}
                for stale in ('failed_unit','rejected_response','validation_error'):pending.pop(stale,None)
                pending['pending_groups']=remaining
                pending['content_hash']=digest(work)
                if not state.get('durable_repair_steps') or any(not isinstance(o,BaseException) for o in prefetched.values()):
                    # Paid sibling responses of the same parallel batch are still
                    # in memory: correct this unit now and keep them, never re-buy.
                    continue
                return {'development':copy.deepcopy(work),'development_validated':False,'errors':[],
                        'development_repair_unlocatable':False,'repair_continuation':pending,'trace':trace,
                        'development_build_report':{'version':VERSION,'completed_units':pending['completed_units'],
                            'remaining_units':len(remaining),'self_correction':{'unit':copy.deepcopy(unit),'error':str(error)[:600]}}}
            prior=(pending.get('shape_fallback') or {}).pop(key,None)
            if kind=='bio' and prior:
                # The correction of a B9 shape broke another contract: keep the
                # earlier valid draft (shape recorded as an observation), never stop.
                work['candidates'][unit['index']].update(prior['fields'])
                pending.setdefault('bio_shape',[]).append({'candidate':work['candidates'][unit['index']]['name'],
                    'kept_prior':True,'correction_error':str(error)[:300]})
                for stale in ('failed_unit','rejected_response','validation_error','unit_feedback'):pending.pop(stale,None)
                pending['pending_groups']=remaining
            else:
                pending.pop('unit_feedback',None)
                return {'development':copy.deepcopy(work),'development_validated':False,
                    'repair_continuation':pending,'development_repair_unlocatable':True,
                    'errors':['La construcción conservó una respuesta que no cumple el contrato: '+str(error)],
                    'trace':trace}

        pending['completed_units'].append(unit);pending['pending_groups'].pop(0)
        if (pending.get('unit_feedback') or {}).get('unit')==unit:pending.pop('unit_feedback')
        pending['content_hash']=digest(work)
        if pending['pending_groups'] and state.get('durable_repair_steps') and not any(not isinstance(o,BaseException) for o in prefetched.values()):
            # A sibling whose provider outcome is unknown stays in the trace:
            # its possible cost is recorded and no second copy is bought blindly.
            trace=trace+[t for t in (getattr(e,'trace',None) for e in prefetched.values() if isinstance(e,BaseException)) if isinstance(t,dict)]
            return {'development':copy.deepcopy(work),'development_validated':False,'errors':[],
                    'development_repair_unlocatable':False,'repair_continuation':pending,'trace':trace,'development_build_report':{
                        'version':VERSION,'completed_units':pending['completed_units'],'remaining_units':len(pending['pending_groups'])}}
    work.update(version=DEVELOPMENT_VERSION, execution_contract=EXECUTION_CONTRACT,
                personal_quality_contract=PERSONAL_QUALITY_CONTRACT, biography_depth_contract=DEPTH_CONTRACT)
    # Known editorial answers are applied in code before any review: form
    # vocabulary, auditor voice, confirmed headship, duplicated value lines.
    from core.prose_rules import polish_proposal
    work,prose_report=polish_proposal(package,work)
    proposal=bind_development(package,full.model_validate(work).model_dump())
    proposal['version']=DEVELOPMENT_VERSION
    proposal['construction_contract']=VERSION
    errors=development_errors(package,strategy,proposal)
    from core.construction_quality import initial_quality
    first_pass=initial_quality({**state,'development':proposal})
    return {'development':proposal,'development_validated':not errors,'errors':errors,'trace':trace,
            'development_repair_unlocatable':False,
            'repair_continuation':None,'development_build_report':{'version':VERSION,
                'completed_units':pending['completed_units'],'remaining_units':0,
                'decision_hash':digest(decision_snapshot(proposal)),
                'binding_contract':pending.get('binding_contract'),
                'plan_binding_contract':pending.get('plan_binding_contract'),
                'plan_comparison_recovery':pending.get('plan_comparison_recovery'),
                'anchor_bindings':pending.get('anchor_bindings',[]),
                'dropped_support':pending.get('dropped_support',[]),
                'unit_corrections':pending.get('unit_corrections',{}),
                'plan_fixes':pending.get('plan_fixes',[]),
                'bio_style':pending.get('bio_style',[]),
                'prose_rules':prose_report,
                'length_observations':pending.get('length_observations',[]),
                'status_observations':pending.get('status_observations',[]),
                'bio_shape':pending.get('bio_shape',[]),
                'shape_observations':pending.get('shape_observations',[]),
                'rejected_responses':[{k:v for k,v in r.items()} for r in pending.get('rejected_responses',[])],
                'first_pass_quality':first_pass,
                'initial_validation':{'errors':list(errors),'passed':not errors,'semantic_quality':'not_yet_measured'}}}
