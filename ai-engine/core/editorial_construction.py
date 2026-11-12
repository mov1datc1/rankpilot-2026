"""Construct one shared decision plan, then independently owned writing units.

Each paid unit is checkpointed before the next one. Original sources and the
validated selection are inputs, never outputs. This is construction, not repair.
"""
import copy
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
''' + DEPTH_INSTRUCTION

INSTITUTION_TASK = COMMON + ''' Write B10 and C2 in English from the SAME institutional
case_plan, speaking directly as the firm (never audit voice or market superlatives).
B10 demonstrates the practice's evidenced identity and capabilities (maximum 1000
words, no rigid minimum or padding; allocate depth to the available evidence, not
a sequential case list): (1) open with the strongest strategic differentiator from
this portfolio; (2) cover industry sector expertise, geographic/national footprint
and areas of recent growth where evidenced in the sources; (3) develop all shared
institutional_arguments and other documented capability pillars with concrete legal
mechanisms and outcomes; and (4) integrate department leadership and bench depth
(confirmed heads, team architecture and distinct practitioner roles/credentials
grounded in lawyers and shared_decisions, without inventing partner status or
rankings). C2 argues once for the requested coverage with distinct supported
reasons, without two equivalent opening sentences, copying B10 or repeating a
service catalogue. Use actual retrieved peer evidence only within its scope; never
invent market standing. Both are public: generalise confidential identities and
identifying combinations of geography, transaction details and private metrics
while preserving legal work and career credentials. Return institutional_execution
with literal b10_quote/c2_quote for each shared argument. These bindings are
internal, not additional public copy.'''

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
    while pending['pending_groups']:
        unit=pending['pending_groups'][0];kind=unit['kind'];work=pending['work']
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
                'shared_decisions':decision_snapshot(work),'strategy':strategy}
            if source_owned:
                payload['argument_bindings']={f'A{i+1:02d}':a for i,a in enumerate(work['case_plan']['institutional_arguments'])}
                task += '\nReturn institutional_execution for every supplied argument_bindings key, with distinct exact B10 and C2 passages. These argument_bindings are the shared core pillars to execute, not a cap on B10 structure: B10 must also cover opening thesis, sectors, footprint/growth when evidenced, and department leadership/bench depth. The application inserts the canonical argument index; do not select or reorder a different plan.'
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
                if source_owned:value=construction_bindings.complete_plan_support(package,strategy,value)
                validate_plan(package,strategy,value)
                work.update(value)
                schedule_writing(package, strategy, pending)
            elif kind=='plan_comparisons':
                pending['plan_comparison_recovery']['attempted'] = True
                completed = copy.deepcopy(work)
                completed['comparisons'] += reserve_comparisons.expand(value, bindings)
                validate_plan(package, strategy, completed)
                work.update(completed)
                pending['plan_comparison_recovery']['completed'] = True
                schedule_writing(package, strategy, pending)
            elif kind=='matters':
                if source_owned:
                    value,receipts=construction_bindings.expand_matters(value,bindings)
                    pending.setdefault('anchor_bindings',[]).extend(receipts)
                if sorted(m['matter_id'] for m in value['matters'])!=sorted(unit['ids']):raise ValueError('Narrative batch must cover each owned matter exactly once')
                values={m['matter_id']:m for m in value['matters']}
                work['matters']=[{**m,**values.get(m['matter_id'],{})} for m in work['matters']]
            elif kind=='bio':
                if source_owned:value=construction_bindings.expand_biography(value,bindings)
                work['candidates'][unit['index']].update(value)
            else:
                if source_owned:value=construction_bindings.expand_institutional(value,work['case_plan'])
                work.update(value)
        except Exception as error:
            # Retain the rejected response and usage without replaying a paid unit.
            pending['failed_unit']=unit;pending['rejected_response']=value
            pending['validation_error']=str(error);pending['pending_groups']=[]
            pending['content_hash']=digest(work)
            if kind == 'plan' and prepare_comparison_completion(package, strategy, pending, plan_schema):
                if not state.get('durable_repair_steps'):
                    continue
                return {'development':copy.deepcopy(pending['work']), 'development_validated':False,
                        'development_repair_unlocatable':False, 'repair_continuation':pending, 'errors':[], 'trace':trace}
            return {'development':copy.deepcopy(work),'development_validated':False,
                    'repair_continuation':pending,'development_repair_unlocatable':True,
                    'errors':['La construcción conservó una respuesta que no cumple el contrato: '+str(error)],
                    'trace':trace}

        pending['completed_units'].append(unit);pending['pending_groups'].pop(0)
        pending['content_hash']=digest(work)
        if pending['pending_groups'] and state.get('durable_repair_steps'):
            return {'development':copy.deepcopy(work),'development_validated':False,'errors':[],
                    'development_repair_unlocatable':False,'repair_continuation':pending,'trace':trace,'development_build_report':{
                        'version':VERSION,'completed_units':pending['completed_units'],'remaining_units':len(pending['pending_groups'])}}
    work.update(version=DEVELOPMENT_VERSION, execution_contract=EXECUTION_CONTRACT,
                personal_quality_contract=PERSONAL_QUALITY_CONTRACT, biography_depth_contract=DEPTH_CONTRACT)
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
                'first_pass_quality':first_pass,
                'initial_validation':{'errors':list(errors),'passed':not errors,'semantic_quality':'not_yet_measured'}}}
