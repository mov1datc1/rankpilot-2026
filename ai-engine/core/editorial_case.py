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

ExecutionStatus=OutputQuote('ExecutionStatus',{'MET':'met','FAILED':'failed'})
ExecutionStatus.__doc__='Judge actual execution: met or failed. Passage selection alone does not establish sufficiency.'

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
    for argument_index,argument in enumerate(plan.get('institutional_arguments', [])):
        if any(not str(argument.get(k) or '').strip() for k in ('proposition','b10_contribution','c2_contribution')) or not argument.get('evidence'):
            errors.append('Argumento institucional incompleto.')
        for evidence_index,evidence in enumerate(argument.get('evidence', [])):
            if evidence.get('matter_id') not in core or not bind_quote(evidence.get('source_quote'),register.get(evidence.get('matter_id'),{})):
                errors.append('Argumento institucional sin evidencia propia del núcleo. '
                              f'case_plan/institutional_arguments/{argument_index}/evidence/{evidence_index}: '
                              f'matter_id={evidence.get("matter_id")}; source_quote={evidence.get("source_quote")!r}. '
                              'Copy an exact contiguous passage from this own selected source; preserve the supported argument.')
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
    for i,comparison in enumerate(proposal.get('comparisons',[])):
        for field in ('incremental_contribution','tradeoff'):
            if vague_scale_comparison(comparison.get(field,'')):
                errors.append(f'Comparación de escala imprecisa: comparisons/{i}/{field}')
    return errors


VAGUE_SCALE=re.compile(r'\b(?:(?:menor|mayor)\s+escala|(?:smaller|larger|lower|greater)[ -]+scale)\b',re.I)

def vague_scale_comparison(value):
    # State concrete sourced facts, not a relative label that hides its basis.
    return bool(VAGUE_SCALE.search(str(value or '')))

def comparison_style_defects(letter):
    text=str(letter.get('evidence_gaps') or '')
    match=VAGUE_SCALE.search(text)
    if not match:return []
    return [{'code':'EDITORIAL_STYLE','severity':'critical','scope':'letter','owner':'rankpilot',
        'field_path':'evidence_gaps','matter_id':None,'artifact_quote':match.group(),'source_quote':'',
        'message':'Sustituye la etiqueta relativa de escala por diferencias jurídicas o cantidades comparables expresamente suministradas. No inventes mediciones ni conviertas un riesgo pendiente en un resultado alcanzado.'}]


def obligations(package, strategy, proposal):
    """IDs come from source scope, never from the final judge's chosen examples."""
    result=[]
    register={m['id']:m for m in package.get('matters',[])}
    def add(key,field,sources,instruction):
        result.append({'id':key,'field':field,'sources':sources,'instruction':instruction,
            'output_scope':'internal' if field.startswith('comparisons/') or (field.startswith('candidates/') and not field.endswith('/submission_bio')) else 'audit' if field in ('leadership','evidence_gaps','executive_assessment') else 'submission'})
    for i,argument in enumerate(proposal.get('case_plan',{}).get('institutional_arguments',[])):
        sources=[register.get(e['matter_id'],{}) for e in argument.get('evidence',[])]
        for field in ('b10','c2'):
            add(f'argument:{i}:{field}',field,sources,'Execute the source strategy thesis: '+str(strategy.get('thesis',''))+'. '+argument['proposition']+' '+argument[field+'_contribution'])
    def public_profile(candidate):
        from core.editorial_execution import public_bio_included
        return public_bio_included(package,candidate)
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
        if public_profile(candidate) and (candidate.get('recommendation')=='present' or candidate.get('supporting_matters') or candidate.get('submission_case_coverage')):
            add(f'candidate:{i}:b9_audit_consistency',f'candidates/{i}/submission_bio',sources,
                'Compare this person actual Audit leadership argument with their actual public B9. Every distinctive personally attributed legal contribution or achieved result materially used by the Audit to defend this person must be developed in their own B9, with safe public generalisation. Also check every mandate the BIO itself describes: where the original source supplies an achieved interim/final result, intended prevention or ongoing status cannot replace it. Do not require every peripheral mandate, confidential names or metrics, internal category caveats, invented results or a nomination for a develop/do_not_present decision. Preserve supported pending work when no result exists. A valid pair of individual source links cannot excuse a material mismatch elsewhere in the same BIO.')
            from core.editorial_execution import EXECUTION_CONTRACT
            linked=proposal.get('execution_contract')==EXECUTION_CONTRACT and candidate.get('submission_case_coverage')
            if linked:
                for j,link in enumerate(candidate['submission_case_coverage']):
                    from core.participation_contract import participation_link, INSTRUCTION as PARTICIPATION_INSTRUCTION
                    if participation_link(package,candidate,link):
                        add(f'personal_case:{i}:{j}',f'candidates/{i}/submission_bio',[register.get(link.get('matter_id'),{})],
                            PARTICIPATION_INSTRUCTION+' Person: '+candidate['name']+'. Actual bound passage: '+str(link.get('public_quote','')))
                        continue
                    add(f'personal_case:{i}:{j}',f'candidates/{i}/submission_bio',[register.get(link.get('matter_id'),{})],
                        'Independently verify that '+candidate['name']+' B9 develops the personally attributed legal contribution, distinctive issue and evidenced result of THIS source. When the source supplies an achieved interim or final result, state that result; an ongoing mandate or intended stability cannot replace it. Use an actual pending position only when no achieved result is supplied. A generic specialty list or a different mandate is not execution. Preserve safe public generalisation; do not demand restricted names or metrics. Internal intended passage: '+str(link.get('public_quote','')))
                if proposal.get('personal_quality_contract')=='complete-personal-case-v1':
                    for j,link in enumerate(candidate['submission_case_coverage']):
                        if participation_link(package,candidate,link):
                            continue
                        add(f'personal_audit:{i}:{j}','leadership',[register.get(link.get('matter_id'),{})],
                            'Execute the SAME personally attributed contribution and achieved result or actual pending status used in this person B9, in a compact individual Audit argument. Do not replace it with an unrelated mandate or let the Audit invent a stronger result. Person: '+candidate['name']+'. B9 passage: '+str(link.get('public_quote','')))
            else:
                from core.editorial_execution import personal_argument_requirement,primary_lead_anchor
                limited=personal_argument_requirement(package,candidate)==0 and not primary_lead_anchor(package,strategy,candidate)
                instruction=('The original mandate evidence establishes team participation only for '+candidate['name']+'. Preserve supplied profile credentials and participation; do not demand or invent individual legal responsibility, leadership, results or a nomination. Follow up missing evidence internally without blocking this limited accurate profile.' if limited else 'Develop '+candidate['name']+' through personally attributed work; execute the current candidacy without disclosing restricted identities or metrics.')
                add(f'candidate:{i}:b9',f'candidates/{i}/submission_bio',sources,instruction)
        from core.participation_contract import participation_requirement
        participation=participation_requirement(package,strategy,candidate)
        if participation:
            add(participation['id'],f'candidates/{i}/submission_bio',
                [register[s['matter_id']] for s in participation['sources']],participation['instruction'])
    if proposal.get('personal_quality_contract')=='complete-personal-case-v1':
        for i,candidate in enumerate(proposal.get('candidates',[])):
            person=next((p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))),{})
            sources=[person]+[register.get(item.get('matter_id'),{}) for item in candidate.get('supporting_matters',[])]
            assessment=candidate.get('category_assessment') or {}
            add(f'category:{i}:fit',f'candidates/{i}/category_rationale',sources,
                'Independently assess the proposed category against THIS person career stage, positive eligibility criterion, personal work and counterevidence. Missing current-ranking matches do not establish emerging reputation. Partner status alone neither proves nor rules out Up and Coming. That category needs developing reputation and contribution to practice growth; established experience/leadership must be addressed. Reject a generic category applied without an individual evidentiary explanation; when unsupported, require Category pending and a precise criterion/action. For an explicit do_not_present recommendation with a not_proposed assessment, evaluate the supported reason not to nominate; do not force a Category pending nomination or request a category-selection action for someone not being proposed. Evaluate that requirement across the structured decision fields below; do not demand that category_rationale repeat a category, missing criterion or action already accurately stated in its own field. These generated fields are review context, not original evidence; assess their support against the supplied sources. Person: '+candidate['name']+'. Current category: '+str(candidate.get('suggested_ranking'))+'. Decision fields: '+str({k:candidate.get(k) for k in ('recommendation','category_missing_criterion','recommended_action')})+'. Structured assessment: '+str(assessment))
    from core.biography_depth import DEPTH_CONTRACT, DEPTH_POLICY
    if proposal.get('biography_depth_contract') == DEPTH_CONTRACT:
        for i,candidate in enumerate(proposal.get('candidates',[])):
            if not public_profile(candidate): continue
            person=next((p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))),{})
            from core.role_evidence import matter_names_person
            own=[m for mid,m in register.items() if mid in support_ids(package,strategy) and matter_names_person(candidate.get('name'),m)]
            add(f'depth:{i}:b9',f'candidates/{i}/submission_bio',[person]+own,
                DEPTH_POLICY+' Independently compare the complete original evidence to the actual BIO. Reject superficial compression, repeated leadership sentences, catalogues and unsupported padding even when word count passes. For a depth defect, identify the specific original legal mechanism, personal action, achieved outcome or credential omitted from the BIO and its precise field. Do not reject by word count alone. Explain pending work directly without commentary about what the record states. Verify source_limited against all these sources; it is not a self-certified waiver. If actually insufficient, accept the accurate shorter profile and keep the precise optional follow-up internal. A former employer or professional association must not be anonymized merely because a client identity needs permission; honor actual register restrictions. Internal depth assessment: '+str(candidate.get('biography_depth')))
    if proposal.get('version')=='editorial-development-v4':
        from core.candidate_evidence import profile_units
        for i,candidate in enumerate(proposal.get('candidates',[])):
            if not public_profile(candidate):continue
            person=next((p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))),{})
            for unit in profile_units(person):
                decisions=[c for c in candidate.get('profile_coverage',[]) if c.get('reference')==unit['reference']]
                privacy_sources=[]
                for decision in decisions:
                    basis=decision.get('privacy_basis') or {}
                    source=person if basis.get('kind')=='profile_restriction' else register.get(basis.get('matter_id'))
                    if source is not None and source not in privacy_sources:privacy_sources.append(source)
                add(f'profile:{i}:{unit["reference"]}',f'candidates/{i}/submission_bio',[{'source_excerpt':unit['source_quote']}]+privacy_sources,
                    'Independently judge preservation of this ORIGINAL profile credential alongside matter work. Material prior employment, professional office, regional responsibility and qualifications must survive. Privacy may generalize an identity but must preserve the role and relationship. A former employer or professional association must retain its source name unless an actual source/register restriction applies; a hypothetical client-permission gap is not such a restriction. Check EVERY named entity, relationship and privacy_basis against the original, including entities omitted from the internal records. A quote about employment alone is NOT a confidentiality restriction, and another entity\'s restriction does not apply. A literal privacy_basis is not semantic permission to anonymize. An omit decision is not proof: reject an unsupported loss of a material credential. Internal proposal decisions: '+str(decisions))
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
            # Same field, same request and same repair budget. Each decisive
            # source passage needs its own verdict; a generic description of
            # the mandate cannot stand in for all its outcomes and scale.
            from core.editorial_development import bind_quote
            for quote in dict.fromkeys(draft.get('decisive_source_quotes',[])):
                bound=bind_quote(quote,matter)
                if not bound:continue  # Literal binding faults use the existing repair route.
                key=sha256(bound.encode()).hexdigest()[:16]
                add(f'matter:{draft["matter_id"]}:fact:{key}',f'matters/{i}/text',[matter],
                    'Check execution of THIS decisive original passage in this SAME matter narrative: '+bound+
                    '. Require its material contribution, achieved result or actual pending status, and meaningful scale; another passage cannot satisfy this obligation. '+
                    ('This narrative is confidential section E: retain evidenced identities and quantities unless a specific original restriction applies to the fact itself. Public B9/B10/C2 anonymization is not a reason to erase E evidence. ' if restricted else 'This narrative is public section D: honor actual publication restrictions and permit faithful safe generalisation. ')+
                    'Do not copy source wording mechanically, infer seniority from a form heading, require an irrelevant detail, or restore a disputed result. Where sources conflict, accept the qualified supported result and retain the uncertainty in the internal Audit. A citation is evidence, not proof that the output executes it.')
                result[-1]['fact_source_quote']=bound
    # Explicit editorial obligations, not hidden inside an aggregate pass flag.
    if proposal.get('construction_contract')=='editorial-construction-v1':
        all_sources=[register[d['matter_id']] for d in strategy.get('matters',[])
                     if d.get('disposition')=='core' and d['matter_id'] in register]
        add('editorial:c2_distinct_argument','c2',all_sources,
            'Make one direct coverage request and develop distinct evidenced reasons. Two equivalent introductory requests or a repeated service catalogue do not execute this requirement. Check semantic repetition, not just identical strings. Do not demand invented market standing or longer prose.')
        add('editorial:market_comparison','executive_assessment',
            all_sources+[{'source_excerpt':str(package.get('ranking_verification',{}))}],
            'Where retrieved scoped peer commentary exists, compare its actual capabilities with the selected portfolio using concrete distinctions. A table-only or absent retrieval supports a precise limitation, not invented competitors or a comparative market claim. Check this obligation independently of hero rationale and letter length.')
        for i,candidate in enumerate(proposal.get('candidates',[])):
            add(f'editorial:shared_category:{i}','leadership',
                [p for p in package.get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))],
                'The internal Audit and Submission must execute ONE current nomination/category decision. Do not qualify a different label in Audit while leaving it asserted in the Submission. Compare this exact structured decision and explain source-supported uncertainty consistently: '+str({k:candidate.get(k) for k in ('name','recommendation','suggested_ranking','category_missing_criterion','recommended_action')}))
    verified=set(package.get('_verified_field_obligations',[]))
    return [item for item in result if item['id'] not in verified]


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
        internal=path.startswith('comparisons/') or (path.startswith('candidates/') and not path.endswith('/submission_bio'))
        rendered=None if internal else package.get('rendered_artifact')
        if rendered is not None and proposal.get('version')=='editorial-development-v4' and path.startswith('candidates/'):
            try:name=proposal['candidates'][int(path.split('/')[1])]['name']
            except (IndexError,KeyError,ValueError):name=''
            value=(package.get('rendered_candidate_bios') or {}).get(name,'')
        if rendered is not None:value=re.sub(r'\*\*([^*]+)\*\*',r'\1',str(value))
    return unicodedata.normalize('NFC',str(value or '')),rendered


def execution_quote_catalog(package, strategy, proposal, letter):
    """Own-field passage references; generated text and source facts never change."""
    if proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):return {}
    norm=lambda v:' '.join(unicodedata.normalize('NFC',str(v or '')).split())
    catalog={}
    for obligation in obligations(package,strategy,proposal):
        path=obligation['field'];text,rendered=execution_output(package,proposal,letter,path)
        options=list(dict.fromkeys(norm(p) for p in text.splitlines() if norm(p)))
        if rendered is not None:options=[q for q in options if q in norm(rendered)]
        if not options:
            raise ValueError('review diagnostic not grounded: expected output field absent from exact artifact: '+path)
        catalog[obligation['id']]={'P_'+sha256((path+'\0'+q).encode()).hexdigest()[:16]:q for q in options}
    return catalog


def execution_source_catalog(package, strategy, proposal):
    """Own-source passage choices, never model-authored proof quotations.

    Complete sources remain in the review payload. These lossless excerpts only
    transport citations; selecting one does not decide semantic sufficiency.
    Shared source sets reuse the same schema enum instead of repeating its text.
    """
    if proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):return {}
    from core.editorial_development import SOURCE_FIELDS
    normalize=lambda value:' '.join(unicodedata.normalize('NFC',str(value or '')).split())
    result={}
    for obligation in obligations(package,strategy,proposal):
        texts=[normalize(obligation['fact_source_quote'])] if obligation.get('fact_source_quote') else list(dict.fromkeys(normalize(source.get(field))
            for source in obligation['sources']
            for field in SOURCE_FIELDS+('bio','comments','key_focus','name','fullName','role','credentials','professional_roles','confidentialityEvidence')
            if normalize(source.get(field))))
        # source_excerpt normally contains the narrative and role cells already.
        texts=[text for text in texts if not any(text!=other and text in other for other in texts)]
        passages=[]
        for text in texts:
            for sentence in re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])',text):
                while len(sentence)>360:
                    end=sentence.rfind(' ',0,361)
                    if end<1:end=360
                    passages.append(sentence[:end]);sentence=sentence[end:].lstrip()
                if sentence:passages.append(sentence)
        choices={ 'S_'+sha256(quote.encode()).hexdigest()[:16]:quote
            for quote in dict.fromkeys(passages) if quote }
        if not choices:
            raise ValueError('review diagnostic not grounded: own source passage absent: '+obligation['id'])
        result[obligation['id']]=choices
    return result


def execution_verdict_contract(package, strategy, proposal, letter, base, compact=False, source_refs=False):
    """Model-facing proof keys and quotations are bound before generation.

    Quote enums are shared by output field; the full leadership letter is not
    duplicated for every candidate. Status/reason remain independent judgments.
    A legal-looking quote from another field cannot satisfy this schema.
    """
    if proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):return base
    norm=lambda v:' '.join(unicodedata.normalize('NFC',str(v or '')).split())
    fields={};quote_types={};source_types={}
    source_catalog=execution_source_catalog(package,strategy,proposal) if source_refs else {}
    catalog=execution_quote_catalog(package,strategy,proposal,letter) if compact else {}
    for obligation in obligations(package,strategy,proposal):
        path=obligation['field'];text,rendered=execution_output(package,proposal,letter,path)
        options=list(dict.fromkeys(norm(p) for p in text.splitlines() if norm(p)))
        if rendered is not None:options=[q for q in options if q in norm(rendered)]
        if not options:
            raise ValueError('review diagnostic not grounded: expected output field absent from exact artifact: '+path)
        key=(path,tuple(options))
        if key not in quote_types:
            name='OutputQuote_'+sha256(path.encode()).hexdigest()[:12]
            if compact:
                refs=catalog[obligation['id']]
                quote_types[key]=OutputQuote(name,{f'Q{i}':ref for i,ref in enumerate(refs)})
                quote_types[key].__doc__='Choose a passage ID after reading its complete text. This is a field-bound reference, not a semantic approval. Passage catalog: '+str(refs)
            else:
                quote_types[key]=OutputQuote(name,{f'Q{i}':value for i,value in enumerate(options)})
        source_type=str
        source_description='Contiguous exact original words from one of this obligation own sources.'
        if obligation.get('confirmed_input_name'):
            source_type=OutputQuote('ConfirmedHead_'+sha256(obligation['confirmed_input_name'].encode()).hexdigest()[:12],
                {'NAME':obligation['confirmed_input_name']})
            source_description='Cite the exact name in this confirmed department-head entry. Its head function comes from the structured input field. Template headings, email labels and inferred titles are not source quotations. Independently judge whether the output preserves that function.'
        if source_refs:
            choices=source_catalog[obligation['id']]
            source_key=tuple(sorted(choices.items()))
            if source_key not in source_types:
                source_type=OutputQuote('SourcePassage_'+sha256(str(source_key).encode()).hexdigest()[:16],
                    {f'S{i}':ref for i,ref in enumerate(choices)})
                source_type.__doc__='Choose an allowed ID in the source_passages table in the review payload. Read the full original source; the passage is a citation, never semantic approval.'
                source_types[source_key]=source_type
            source_type=source_types[source_key]
            source_description='Choose an original source passage ID from this obligation catalog. Never paraphrase the original. Independently judge whether the output executes the required evidence.'
        check=create_model('Proof_'+sha256(obligation['id'].encode()).hexdigest()[:12],__config__=ConfigDict(extra='forbid'),
            status=((ExecutionStatus,...) if compact else (Literal['met','failed'],Field(description='Judge actual execution of this obligation. Optional style preferences are not failures.'))),
            **{('artifact_ref' if compact else 'artifact_quote'):((quote_types[key],...) if compact else (quote_types[key],Field(description='Choose the passage in this obligation output field. Read its full text in the passage catalog before judging execution. Internal comparisons are not required in the Audit.')))},
            **{('source_ref' if source_refs else 'source_quote'):((source_type,...) if source_refs else (source_type,Field(description=source_description+(' Copy a short decisive fragment, at most 360 characters.' if compact else ''),**({'max_length':360} if compact and source_type is str else {}))))},
            reason=(str,Field(min_length=1,description='Explain the source-to-output reasoning in at most 40 words; appearance of words alone is not proof.',**({'max_length':400} if compact else {}))))
        fields[obligation['id']]=(check,...)
    checks=create_model('EveryCaseExecutionProof',__config__=ConfigDict(extra='forbid'),**fields)
    return create_model('BoundCaseVerdict',__base__=base,case_checks=(checks,...))


def project_execution_checks(verdict, quote_catalog=None, source_catalog=None):
    """Resolve compact transport before the existing literal/source validation.

    Never treat a reference as approval. Unknown, foreign-field or stale IDs
    fail closed. Saved proofs retain full literal passages, not provider IDs.
    """
    checks=verdict.get('case_checks')
    if not isinstance(checks,dict):return verdict
    projected=[]
    for key,value in checks.items():
        check=dict(value)
        if 'artifact_ref' in check:
            ref=str(check.pop('artifact_ref'))
            allowed=(quote_catalog or {}).get(key,{})
            if 'artifact_quote' in check or ref not in allowed:
                raise ValueError('review diagnostic not grounded: unknown or foreign output passage reference: '+key)
            check['artifact_quote']=allowed[ref]
        if 'source_ref' in check:
            ref=str(check.pop('source_ref'))
            allowed=(source_catalog or {}).get(key,{})
            if 'source_quote' in check or ref not in allowed:
                raise ValueError('review diagnostic not grounded: unknown or foreign source passage reference: '+key)
            check['source_quote']=allowed[ref]
        projected.append({'obligation_id':key,**check,'artifact_quote':str(check['artifact_quote']),
            'source_quote':str(check.get('source_quote',''))})
    return {**verdict,'case_checks':projected}


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
    from core.personal_quality import required_personal_matters
    from core.candidate_evidence import profile_units, CHAMBERS_CATEGORY_GUIDANCE
    from core.participation_contract import participation_sources, INSTRUCTION as PARTICIPATION_INSTRUCTION, VERSION as PARTICIPATION_VERSION
    eligible=support_ids(package,strategy)
    return {'case_requirements':{'biography_depth_contract':'sourced-biography-depth-v1','personal_quality_contract':'complete-personal-case-v1','category_methodology':CHAMBERS_CATEGORY_GUIDANCE if 'chambers' in str(package.get('directory') or '').casefold() else None,'profile_requirements':[{'name':p.get('name') or p.get('fullName'),'units':profile_units(p)} for p in package.get('lawyers',[])],'version':CASE_VERSION,'strategy_thesis':strategy.get('thesis',''),
        'personal_work_requirements':{(p.get('name') or p.get('fullName')):required_personal_matters(package,strategy,{'name':p.get('name') or p.get('fullName'),'recommendation':'present','suggested_ranking':'prospective source assessment'}) for p in package.get('lawyers',[])},
        'participation_requirements':{'version':PARTICIPATION_VERSION,'instruction':PARTICIPATION_INSTRUCTION,
            'applies_when':'The directory includes this profile, no nomination is proposed and sources establish only team membership rather than personal substantive work.',
            'people':{(p.get('name') or p.get('fullName')):participation_sources(package,strategy,p.get('name') or p.get('fullName')) for p in package.get('lawyers',[])}},
        'recovery_contract':'field-recovery-v1',
        'requested_target':package.get('requested_target'),
        'additional_leaders':additional_leaders(package,strategy),
        'reserve_ids':[d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='reserve'],
        'personal_attribution_policy':'A team listing establishes participation only, not individual legal responsibility or results. For a category-pending profile not proposed for nomination, preserve actual credentials and participation without inventing substantive case contributions. Exact lead names establish their own role; a shorter name alone does not establish identity with a longer name. Substantively attributed work still requires developed, distinct B9 arguments.',
        'personal_evidence':{p.get('name') or p.get('fullName'):[m['id'] for m in package.get('matters',[]) if m['id'] in eligible and matter_names_person(p.get('name') or p.get('fullName'),m)] for p in package.get('lawyers',[])}}}
