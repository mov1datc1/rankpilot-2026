"""Source-derived obligations shared by development, Audit and exact-file review.

This is not a second strategist. It neither changes selection nor creates public
bios from matter headings. Scope and source evidence stay authoritative.
"""
import re
import unicodedata
from enum import Enum
from hashlib import sha256
from pydantic import BaseModel, Field, create_model, ConfigDict
from typing import Literal
from core.role_evidence import identity, matter_names_person

CASE_VERSION = 'editorial-case-v1'

class OutputQuote(str, Enum):
    """String-valued proofs on the engine's Python 3.10 runtime."""
    def __str__(self):
        return self.value

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
        result.append({'id':key,'field':field,'sources':sources,'instruction':instruction,
            'output_scope':'internal' if field.startswith('comparisons/') else 'audit' if field in ('leadership','evidence_gaps','executive_assessment') else 'submission'})
    for i,argument in enumerate(proposal.get('case_plan',{}).get('institutional_arguments',[])):
        sources=[register.get(e['matter_id'],{}) for e in argument.get('evidence',[])]
        for field in ('b10','c2'):
            add(f'argument:{i}:{field}',field,sources,'Execute the source strategy thesis: '+str(strategy.get('thesis',''))+'. '+argument['proposition']+' '+argument[field+'_contribution'])
    def public_profile(candidate):
        directory=str(package.get('directory') or '').casefold()
        return not ('500' in directory) or (candidate.get('recommendation')=='present' and str(candidate.get('suggested_ranking') or '').casefold()!='category pending')
    for i,candidate in enumerate(proposal.get('candidates',[])):
        sources=[register.get(s['matter_id'],{}) for s in candidate.get('supporting_matters',[])]
        sources += [p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))]
        heads=package.get('filing_details',{}).get('heads') or package.get('departmentHeads') or []
        head=next((h for h in heads if isinstance(h,dict) and identity(h.get('name'))==identity(candidate.get('name'))),None)
        if head and public_profile(candidate):
            add(f'head:{i}:b9',f'candidates/{i}/submission_bio',[{'name':head['name'],'confirmed_department_head':head}],
                'Preserve the separately confirmed department-head function in this person public bio using natural sourced prose. Headship does not by itself establish partner seniority. Judge actual leadership coverage against this original administrative head entry; the renderer cannot insert or promote a title to satisfy this obligation.')
            # This is structured confirmed input, not a verbatim form heading.
            # Let the reviewer cite the actual entry, never invent B7 labels.
            result[-1]['confirmed_input_name']=head['name']
        add(f'candidate:{i}:audit','leadership',sources,'Execute the CURRENT category, reason, personal evidence and actual remaining gap for '+candidate['name']+'. A reserve can support the person without being selected. Require the exact proposed category, its source-grounded criterion and reason, or Category pending with its specific missing criterion and action; a generic band candidacy is not a category. Current decision: '+str({k:candidate.get(k) for k in ('suggested_ranking','category_rationale','category_missing_criterion','recommended_action')}))
        if candidate.get('recommendation')=='present' and public_profile(candidate):
            from core.editorial_execution import EXECUTION_CONTRACT
            linked=proposal.get('execution_contract')==EXECUTION_CONTRACT and candidate.get('submission_case_coverage')
            if linked:
                for j,link in enumerate(candidate['submission_case_coverage']):
                    add(f'personal_case:{i}:{j}',f'candidates/{i}/submission_bio',[register.get(link.get('matter_id'),{})],
                        'Independently verify that '+candidate['name']+' B9 develops the personally attributed legal contribution, distinctive issue and evidenced result of THIS source. When the source supplies an achieved interim or final result, state that result; an ongoing mandate or intended stability cannot replace it. Use an actual pending position only when no achieved result is supplied. A generic specialty list or a different mandate is not execution. Preserve safe public generalisation; do not demand restricted names or metrics. Internal intended passage: '+str(link.get('public_quote','')))
            else:
                add(f'candidate:{i}:b9',f'candidates/{i}/submission_bio',sources,'Develop '+candidate['name']+' through personally attributed work; execute the current candidacy without disclosing restricted identities or metrics.')
    if proposal.get('version')=='editorial-development-v4':
        from core.candidate_evidence import profile_units
        for i,candidate in enumerate(proposal.get('candidates',[])):
            if not public_profile(candidate):continue
            person=next((p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))),{})
            coverage={c.get('reference'):c for c in candidate.get('profile_coverage',[])}
            for unit in profile_units(person):
                decision=coverage.get(unit['reference'],{})
                add(f'profile:{i}:{unit["reference"]}',f'candidates/{i}/submission_bio',[{'source_excerpt':unit['source_quote']}],
                    'Independently judge preservation of this ORIGINAL profile credential alongside matter work. Material prior employment, professional office, regional responsibility and qualifications must survive. Privacy may generalize an identity but must preserve the role and relationship. An omit decision is not proof: reject an unsupported loss of a material credential. Internal proposal decision: '+str(decision))
    for i,leader in enumerate(additional_leaders(package,strategy)):
        add(f'leader:{i}','leadership',[register[mid] for mid in leader['matter_ids']], 'Evaluate '+leader['name']+' internally; preserve documented work and request only genuinely absent seniority/profile facts. Do not invent a public bio.')
    for i,comparison in enumerate(proposal.get('comparisons',[])):
        add(f'comparison:{i}','evidence_gaps' if comparison.get('audit_required',True) else f'comparisons/{i}/tradeoff',[register.get(comparison.get(k),{}) for k in ('selected_id','alternative_id')], ('Preserve this specific validated tradeoff in the Audit. ' if comparison.get('audit_required',True) else 'Evaluate this INTERNAL tradeoff in the development proposal; do not require its publication in the executive Audit. ')+'Do not replace the comparative reasoning with a generic dilution statement: '+comparison.get('incremental_contribution','')+' '+comparison.get('tradeoff',''))
    # The public argument must keep a supplied target as a request, not a ranking.
    if package.get('requested_target'):
        add('target','executive_assessment',[{'source_excerpt':str(package['requested_target'])}], 'Preserve or explicitly justify changing the supplied target: '+str(package['requested_target']))
    if proposal.get('version')=='editorial-development-v4':
        core={d['matter_id'] for d in strategy.get('matters',[]) if d.get('disposition')=='core'}
        for i,draft in enumerate(proposal.get('matters',[])):
            matter=register.get(draft.get('matter_id'),{})
            if draft.get('matter_id') not in core:continue
            restricted=matter.get('publication_route')=='E' or matter.get('resolved_publication_status')!='publishable'
            add(f'matter:{draft["matter_id"]}:evidence',f'matters/{i}/text',[matter],
                'Independently compare this selected matter narrative against its ORIGINAL source. Preserve the distinctive legal issue, evidenced contribution, outcome, personal attribution and decisive scale, including material workforce, locations, proceedings and economic quantities with their correct concepts and currencies. Internal decisive_source_quotes are evidence to execute, not a substitute for facts in the narrative. '+
                ('This is confidential section E: public-profile anonymization does not justify removing private source metrics here. Respect any explicit source restriction on a particular fact. ' if restricted else 'This is public section D: respect all explicit publication restrictions. ')+
                'Do not require irrelevant numbers, invent missing outcomes, conflate aggregate and individual amounts or resolve genuine source contradictions. Declared decisive evidence: '+str(draft.get('decisive_source_quotes',[])))
    return result


def execution_output(package, proposal, letter, path):
    """Same visible formatting as the renderers, without altering facts or words."""
    is_letter=path in ('leadership','evidence_gaps','executive_assessment')
    if is_letter:
        value=letter.get(path,'');rendered=package.get('rendered_audit')
        value=re.sub(r'\*\*([^*\n]+)\*\*|\*([^*\n]+)\*',lambda m:m.group(1) or m.group(2),str(value))
        value=re.sub(r'(?m)^\s*#{1,6}\s+','',value)
        value=re.sub(r'\bnot_found\b','sin coincidencia exacta en la consulta',value)
    else:
        value=proposal
        try:
            for part in path.split('/'):value=value[int(part)] if isinstance(value,list) else value[part]
        except (KeyError,IndexError,TypeError):value=''
        rendered=None if path.startswith('comparisons/') else package.get('rendered_artifact')
        if rendered is not None and proposal.get('version')=='editorial-development-v4' and path.startswith('candidates/'):
            try:name=proposal['candidates'][int(path.split('/')[1])]['name']
            except (IndexError,KeyError,ValueError):name=''
            value=(package.get('rendered_candidate_bios') or {}).get(name,'')
        if rendered is not None:value=re.sub(r'\*\*([^*]+)\*\*',r'\1',str(value))
    return unicodedata.normalize('NFC',str(value or '')),rendered


def execution_verdict_contract(package, strategy, proposal, letter, base):
    """Model-facing proof keys and quotations are bound before generation.

    Quote enums are shared by output field; the full leadership letter is not
    duplicated for every candidate. Status/reason remain independent judgments.
    A legal-looking quote from another field cannot satisfy this schema.
    """
    if proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):return base
    norm=lambda v:' '.join(unicodedata.normalize('NFC',str(v or '')).split())
    fields={};quote_types={}
    for obligation in obligations(package,strategy,proposal):
        path=obligation['field'];text,rendered=execution_output(package,proposal,letter,path)
        options=list(dict.fromkeys(norm(p) for p in text.splitlines() if norm(p)))
        if rendered is not None:options=[q for q in options if q in norm(rendered)]
        if not options:
            raise ValueError('review diagnostic not grounded: expected output field absent from exact artifact: '+path)
        key=(path,tuple(options))
        if key not in quote_types:
            name='OutputQuote_'+sha256(path.encode()).hexdigest()[:12]
            quote_types[key]=OutputQuote(name,{f'Q{i}':value for i,value in enumerate(options)})
        source_type=str
        source_description='Contiguous exact original words from one of this obligation own sources.'
        if obligation.get('confirmed_input_name'):
            source_type=OutputQuote('ConfirmedHead_'+sha256(obligation['confirmed_input_name'].encode()).hexdigest()[:12],
                {'NAME':obligation['confirmed_input_name']})
            source_description='Cite the exact name in this confirmed department-head entry. Its head function comes from the structured input field. Template headings, email labels and inferred titles are not source quotations. Independently judge whether the output preserves that function.'
        check=create_model('Proof_'+sha256(obligation['id'].encode()).hexdigest()[:12],__config__=ConfigDict(extra='forbid'),
            status=(Literal['met','failed'],Field(description='Judge actual execution of this obligation. Optional style preferences are not failures.')),
            artifact_quote=(quote_types[key],Field(description='Choose the exact passage in this obligation output field. Internal comparisons are not required in the Audit.')),
            source_quote=(source_type,Field(description=source_description)),
            reason=(str,Field(min_length=1,description='Explain the source-to-output reasoning; appearance of words alone is not proof.')))
        fields[obligation['id']]=(check,...)
    checks=create_model('EveryCaseExecutionProof',__config__=ConfigDict(extra='forbid'),**fields)
    return create_model('BoundCaseVerdict',__base__=base,case_checks=(checks,...))


def project_execution_checks(verdict):
    checks=verdict.get('case_checks')
    if not isinstance(checks,dict):return verdict
    return {**verdict,'case_checks':[{'obligation_id':key,**value,'artifact_quote':str(value['artifact_quote']),
        'source_quote':str(value.get('source_quote',''))} for key,value in checks.items()]}


def execution_defects(package, strategy, proposal, letter, checks):
    """A positive review also needs own-source and expected-output evidence."""
    from core.editorial_development import bind_quote
    expected={o['id']:o for o in obligations(package,strategy,proposal)}
    if len(checks)!=len(expected) or {c.get('obligation_id') for c in checks}!=set(expected):
        raise ValueError('review diagnostic not grounded: case execution review omitted or duplicated obligations')
    norm=lambda v:' '.join(unicodedata.normalize('NFC',str(v or '')).split())
    defects=[]
    for check in checks:
        obligation=expected[check['obligation_id']];path=obligation['field']
        is_letter=path in ('leadership','evidence_gaps','executive_assessment')
        generated,rendered=execution_output(package,proposal,letter,path)
        quote=norm(check.get('artifact_quote'))
        if not quote or quote not in norm(generated) or (rendered is not None and quote not in norm(rendered)):
            raise ValueError('review diagnostic not grounded: case execution review quote is not in its expected field and artifact')
        source=check.get('source_quote','')
        bound=any(bind_quote(source,m) or (norm(source) and any(norm(source) in norm(m.get(k)) for k in ('bio','comments','key_focus','name','fullName','role'))) for m in obligation['sources'])
        if not bound or not check.get('reason') or check.get('status') not in ('met','failed'):
            raise ValueError('review diagnostic not grounded: case execution review lacks its own source evidence or valid decision: '+obligation['id'].split(':')[0]+':'+path)
        if check['status']=='failed':
            defects.append({'code':'EDITORIAL_OMISSION','severity':'critical','owner':'rankpilot',
                'scope':'letter' if is_letter else 'submission','matter_id':None,'field_path':path,
                'source_quote':source,'artifact_quote':check['artifact_quote'],'message':check['reason']})
    return defects


def prepare_case(state):
    """Unpaid graph boundary: derive obligations before drafting either document."""
    package,strategy=state['package'],state['strategy']
    from core.candidate_evidence import profile_units, CHAMBERS_CATEGORY_GUIDANCE
    eligible=support_ids(package,strategy)
    return {'case_requirements':{'category_methodology':CHAMBERS_CATEGORY_GUIDANCE if 'chambers' in str(package.get('directory') or '').casefold() else None,'profile_requirements':[{'name':p.get('name') or p.get('fullName'),'units':profile_units(p)} for p in package.get('lawyers',[])],'version':CASE_VERSION,'strategy_thesis':strategy.get('thesis',''),
        'requested_target':package.get('requested_target'),
        'additional_leaders':additional_leaders(package,strategy),
        'reserve_ids':[d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='reserve'],
        'personal_evidence':{p.get('name') or p.get('fullName'):[m['id'] for m in package.get('matters',[]) if m['id'] in eligible and matter_names_person(p.get('name') or p.get('fullName'),m)] for p in package.get('lawyers',[])}}}
