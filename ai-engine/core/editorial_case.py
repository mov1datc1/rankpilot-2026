"""Source-derived obligations shared by development, Audit and exact-file review.

This is not a second strategist. It neither changes selection nor creates public
bios from matter headings. Scope and source evidence stay authoritative.
"""
import re
from pydantic import BaseModel, Field
from typing import Literal
from core.role_evidence import identity, matter_names_person

CASE_VERSION = 'editorial-case-v1'

class CaseEvidence(BaseModel):
    matter_id: str
    source_quote: str

class InstitutionalArgument(BaseModel):
    proposition: str = Field(description='Specific evidenced distinction, not a service catalogue or market superlative.')
    evidence: list[CaseEvidence] = Field(min_length=1)
    b10_contribution: str = Field(description='How this proposition builds the institutional case in B10, with safe public generalisation.')
    c2_contribution: str = Field(description='How it supports the requested coverage in C2; do not repeat the B10 catalogue.')

class LeaderAssessment(BaseModel):
    name: str
    matter_ids: list[str]
    decision: str = Field(description='Internal evaluation only. Do not invent title, specialty, public bio or individual eligibility from a matter heading.')
    remaining_action: str = Field(description='Only genuinely missing information; explain what it would change. Use no additional action when evidence suffices.')

class EditorialCase(BaseModel):
    version: str
    institutional_arguments: list[InstitutionalArgument] = Field(min_length=1)
    additional_leaders: list[LeaderAssessment]
    target_decision: str = Field(description='Preserve the supplied objective, or explicitly reason about a proposed alternative. No historical target is implied when none was supplied.')

class ExecutionCheck(BaseModel):
    obligation_id: str
    status: Literal['met','failed'] = Field(description='met or failed. Assess execution, not mere appearance of words. A stylistic preference alone is not a material failure.')
    artifact_quote: str = Field(description='Exact contiguous words in the required document/field that execute this obligation or demonstrate the omission. Never copy another field to excuse an omission.')
    source_quote: str = Field(description='Exact words from one of this obligation’s supplied sources, not from the generated plan.')
    reason: str = Field(description='Explain how this specific source-to-output link executes or fails the case; distinguish source absence from output omission.')


def support_ids(package, strategy):
    """Reserve is a filing decision, not loss of personally attributed evidence.

    Excluded records require a separate practice reassessment; they cannot be
    smuggled into an individual case through this more permissive evidence set.
    """
    register={m['id'] for m in package.get('matters', [])}
    return {d['matter_id'] for d in strategy.get('matters', [])
            if d.get('disposition') in ('core','reserve') and d['matter_id'] in register}


def additional_leaders(package, strategy):
    roster={identity(p.get('name') or p.get('fullName')) for p in package.get('lawyers', [])}
    core={d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition')=='core'}
    result={}
    for matter in package.get('matters', []):
        if matter['id'] not in core: continue
        raw=str(matter.get('leadPartner') or matter.get('lead_partner') or '')
        raw=re.sub(r'(?i)^\s*(?:lead partners?|lead lawyers?|socios? responsables?)\s*[:(s)]*\s*','',raw)
        # Delimited source identities only. Never split a surname or infer aliases.
        for name in re.split(r'\s+(?:and|y|&)\s+|[;\n]|,\s*',raw):
            name=name.strip(' .\t')
            key=identity(name)
            if not 2<=len(key.split())<=7 or key in roster or key in ('not applicable','sin informacion','n a','not stated'): continue
            if not matter_names_person(name,matter): continue
            item=result.setdefault(key,{'name':name,'matter_ids':[]})
            if matter['id'] not in item['matter_ids']: item['matter_ids'].append(matter['id'])
    return list(result.values())


def case_errors(package, strategy, proposal):
    from core.editorial_development import bind_quote
    plan=proposal.get('case_plan')
    if not isinstance(plan,dict): return ['Falta propuesta editorial compartida.']
    errors=[]
    if plan.get('version')!=CASE_VERSION: errors.append('Versión de propuesta editorial inválida.')
    register={m['id']:m for m in package.get('matters', [])}
    core={d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition')=='core'}
    if not plan.get('institutional_arguments'):errors.append('Falta tesis institucional sustentada.')
    for argument in plan.get('institutional_arguments', []):
        if any(not str(argument.get(k) or '').strip() for k in ('proposition','b10_contribution','c2_contribution')) or not argument.get('evidence'):
            errors.append('Argumento institucional incompleto.')
        for evidence in argument.get('evidence', []):
            if evidence.get('matter_id') not in core or not bind_quote(evidence.get('source_quote'),register.get(evidence.get('matter_id'),{})):
                errors.append('Argumento institucional sin evidencia propia del núcleo.')
    expected={identity(p['name']):set(p['matter_ids']) for p in additional_leaders(package,strategy)}
    actual=plan.get('additional_leaders',[])
    if len(actual)!=len(expected) or {identity(p.get('name')) for p in actual}!=set(expected):
        errors.append('La evaluación interna debe cubrir los líderes documentados fuera del roster.')
    for person in actual:
        if set(person.get('matter_ids',[]))!=expected.get(identity(person.get('name')),set()) or not person.get('decision') or not person.get('remaining_action'):
            errors.append('Evaluación de líder sin atribuciones completas o decisión.')
    if not str(plan.get('target_decision') or '').strip():errors.append('Falta decisión explícita del objetivo.')
    reserves={d['matter_id'] for d in strategy.get('matters',[]) if d.get('disposition')=='reserve'}
    compared={c.get('alternative_id') for c in proposal.get('comparisons',[])}
    if reserves-compared:errors.append('Faltan comparaciones de reservas frente a su alternativa pertinente del núcleo.')
    if reserves and not any(c.get('audit_required',True) for c in proposal.get('comparisons',[])):
        errors.append('Falta una comparación visible de frontera en el Audit.')
    return errors


def obligations(package, strategy, proposal):
    """IDs come from source scope, never from the final judge's chosen examples."""
    result=[]
    register={m['id']:m for m in package.get('matters',[])}
    def add(key,field,sources,instruction):
        result.append({'id':key,'field':field,'sources':sources,'instruction':instruction})
    for i,argument in enumerate(proposal.get('case_plan',{}).get('institutional_arguments',[])):
        sources=[register.get(e['matter_id'],{}) for e in argument.get('evidence',[])]
        for field in ('b10','c2'):
            add(f'argument:{i}:{field}',field,sources,'Execute the source strategy thesis: '+str(strategy.get('thesis',''))+'. '+argument['proposition']+' '+argument[field+'_contribution'])
    for i,candidate in enumerate(proposal.get('candidates',[])):
        sources=[register.get(s['matter_id'],{}) for s in candidate.get('supporting_matters',[])]
        if not sources: sources=[p for p in package.get('lawyers',[]) if identity(p.get('name'))==identity(candidate.get('name'))]
        add(f'candidate:{i}:audit','leadership',sources,'Execute the CURRENT category, reason, personal evidence and actual remaining gap for '+candidate['name']+'. A reserve can support the person without being selected.')
        if candidate.get('recommendation')=='present':
            add(f'candidate:{i}:b9',f'candidates/{i}/submission_bio',sources,'Develop '+candidate['name']+' through personally attributed work; execute the current candidacy without disclosing restricted identities or metrics.')
    for i,leader in enumerate(additional_leaders(package,strategy)):
        add(f'leader:{i}','leadership',[register[mid] for mid in leader['matter_ids']], 'Evaluate '+leader['name']+' internally; preserve documented work and request only genuinely absent seniority/profile facts. Do not invent a public bio.')
    for i,comparison in enumerate(proposal.get('comparisons',[])):
        add(f'comparison:{i}','evidence_gaps' if comparison.get('audit_required',True) else f'comparisons/{i}/tradeoff',[register.get(comparison.get(k),{}) for k in ('selected_id','alternative_id')], 'Preserve this specific validated tradeoff, not a generic dilution statement: '+comparison.get('incremental_contribution','')+' '+comparison.get('tradeoff',''))
    # The public argument must keep a supplied target as a request, not a ranking.
    if package.get('requested_target'):
        add('target','executive_assessment',[{'source_excerpt':str(package['requested_target'])}], 'Preserve or explicitly justify changing the supplied target: '+str(package['requested_target']))
    return result


def execution_defects(package, strategy, proposal, letter, checks):
    """A positive review also needs own-source and expected-output evidence."""
    from core.editorial_development import bind_quote
    expected={o['id']:o for o in obligations(package,strategy,proposal)}
    if len(checks)!=len(expected) or {c.get('obligation_id') for c in checks}!=set(expected):
        raise ValueError('review diagnostic not grounded: case execution review omitted or duplicated obligations')
    norm=lambda v:' '.join(str(v or '').split())
    defects=[]
    for check in checks:
        obligation=expected[check['obligation_id']];path=obligation['field']
        is_letter=path in ('leadership','evidence_gaps','executive_assessment')
        if is_letter:
            generated=letter.get(path,'');rendered=package.get('rendered_audit')
        else:
            value=proposal
            try:
                for part in path.split('/'):value=value[int(part)] if isinstance(value,list) else value[part]
            except (KeyError,IndexError,TypeError):value=''
            generated=value;rendered=None if path.startswith('comparisons/') else package.get('rendered_artifact')
        quote=norm(check.get('artifact_quote'))
        if not quote or quote not in norm(generated) or (rendered is not None and quote not in norm(rendered)):
            raise ValueError('review diagnostic not grounded: case execution review quote is not in its expected field and artifact')
        source=check.get('source_quote','')
        bound=any(bind_quote(source,m) or (norm(source) and any(norm(source) in norm(m.get(k)) for k in ('bio','comments','key_focus','name','fullName','role'))) for m in obligation['sources'])
        if not bound or not check.get('reason') or check.get('status') not in ('met','failed'):
            raise ValueError('review diagnostic not grounded: case execution review lacks its own source evidence or valid decision')
        if check['status']=='failed':
            defects.append({'code':'EDITORIAL_OMISSION','severity':'critical','owner':'rankpilot',
                'scope':'letter' if is_letter else 'submission','matter_id':None,'field_path':path,
                'source_quote':source,'artifact_quote':check['artifact_quote'],'message':check['reason']})
    return defects


def prepare_case(state):
    """Unpaid graph boundary: derive obligations before drafting either document."""
    package,strategy=state['package'],state['strategy']
    eligible=support_ids(package,strategy)
    return {'case_requirements':{'version':CASE_VERSION,'strategy_thesis':strategy.get('thesis',''),
        'requested_target':package.get('requested_target'),
        'additional_leaders':additional_leaders(package,strategy),
        'reserve_ids':[d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='reserve'],
        'personal_evidence':{p.get('name') or p.get('fullName'):[m['id'] for m in package.get('matters',[]) if m['id'] in eligible and matter_names_person(p.get('name') or p.get('fullName'),m)] for p in package.get('lawyers',[])}}}
