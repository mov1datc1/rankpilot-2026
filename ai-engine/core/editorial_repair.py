"""Bounded, source-grounded repair of rejected editorial fields.

A repair may touch only validator-identified generated fields. It cannot edit
sources, selection, permissions, user answers, or approval state. Its result is
still a proposal and must pass the original validators and final document judge.
"""
import copy
from typing import Literal, Union
from pydantic import BaseModel, create_model
from core.editorial_development import Candidate

class Correction(BaseModel):
    path: str
    value: Union[str, Candidate]
    reason: str

class Repair(BaseModel):
    corrections: list[Correction]
    unresolved: list[str]

TASK='''Repair only the rejected generated fields identified in repair_targets. This is a targeted correction, not a new submission or strategy. Use the supplied original sources and preserve all unaffected content. For a quotation, copy a contiguous exact passage from the SAME named matter; do not paraphrase, stitch separate passages, borrow from another matter or create evidence. Select the passage that actually supports the claimed fact/role; never replace it with an unrelated matching quote just to satisfy validation. If no supporting passage exists, leave the correction unresolved. For prose, retain documented outcomes, numbers, attribution, uncertainty and confidentiality. Correct incompatible ranking categories using the confirmed seniority; do not invent a current rank. Shorten B10 only when requested, preserving decisive evidence. Never change sources, confirmed user answers, the portfolio, identities, publication permissions or approval status. Return only allowed paths, with a concise internal reason for each correction. Do not ask the user to repair generated wording. If evidence is genuinely missing or contradictory, report that in unresolved rather than guessing. A subsequent independent source and final-document review will assess every repair.'''
TASK+=''' When an entire candidates/N object is an allowed target, reassess that candidate's generated attribution against the supplied person and selected matters. If a claimed supporting matter names someone else and does not support this candidate, REMOVE that supporting entry; do not seek or invent a quote for an unsupported role. Revise the same candidate's recommendation, ranking rationale, internal strategy and public bio to match the remaining actual evidence. Preserve the exact candidate name, confirmed seniority and all supported work. If no personally attributed matter remains, use develop or do_not_present and accurately describe the gap. Do not leave an avoidable false generated attribution unresolved merely because no evidence exists for it: withdraw that claim. Genuine source contradictions remain unresolved. Return the complete corrected candidate object as value for this path, not JSON encoded inside a string.'''
TASK+=''' repair_targets and their problem labels describe defects in GENERATED text, never source evidence. A wrong quote or duplicate entry does not invalidate the underlying matter or another source-backed attribution to it. Retain a valid attribution once and remove only the unsupported/duplicate claims. Do not report a source conflict merely because the generated proposal disagrees with its source.'''

def repair_targets(package, strategy, proposal):
    from core.editorial_development import SOURCE_FIELDS, _norm, literal_quote, development_errors, submission_voice_paths
    errors=development_errors(package,strategy,proposal)
    source_keys=set(SOURCE_FIELDS) | {'id','client','name','title','source_label','source_heading','publish_status','confidentialityConfirmed','isConfidential','confidentialityEvidence','valueResolution','valueConflict'}
    register={m['id']:{k:v for k,v in m.items() if k in source_keys} for m in package.get('matters',[])}
    roster={_norm(l.get('name') or l.get('fullName')):l for l in package.get('lawyers',[])}
    core={d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='core'}
    targets={}
    def add(path,value,problem,evidence):
        targets[path]={'current_value':value,'problem':problem,'source_evidence':evidence}
    for i,draft in enumerate(proposal.get('matters',[])):
        matter=register.get(draft.get('matter_id'),{})
        for j,quote in enumerate(draft.get('decisive_source_quotes',[])):
            if not _norm(literal_quote(quote)) or not any(_norm(literal_quote(quote)) in _norm(matter.get(f)) for f in SOURCE_FIELDS):
                add(f'matters/{i}/decisive_source_quotes/{j}',quote,'Quotation is not literal in this matter.',matter)
        if not str(draft.get('text','')).strip():add(f'matters/{i}/text',draft.get('text',''),'Missing source-backed matter prose.',matter)
    for i,candidate in enumerate(proposal.get('candidates',[])):
        person=roster.get(_norm(candidate.get('name')), {})
        invalid_support=[]
        for support in candidate.get('supporting_matters',[]):
            matter=register.get(support.get('matter_id'),{})
            quote=literal_quote(support.get('source_quote'))
            if support.get('matter_id') not in core or not _norm(quote) or not any(_norm(quote) in _norm(matter.get(f)) for f in SOURCE_FIELDS):
                invalid_support.append(support.get('matter_id'))
        support_ids=[s.get('matter_id') for s in candidate.get('supporting_matters',[])]
        if invalid_support or len(support_ids)!=len(set(support_ids)) or (candidate.get('recommendation')=='present' and not support_ids):
            add(f'candidates/{i}',candidate,'Correct this generated candidacy; remove unsupported personal attributions and duplicates, then reconcile the bio, category and recommendation with actual evidence. This flags generated claims, not invalid source matters.',{'person':person,'selected_matters':[m for mid,m in register.items() if mid in core]})
            continue
        for j,support in enumerate(candidate.get('supporting_matters',[])):
            matter=register.get(support.get('matter_id'),{})
            quote=literal_quote(support.get('source_quote'))
            if support.get('matter_id') in core and (not _norm(quote) or not any(_norm(quote) in _norm(matter.get(f)) for f in SOURCE_FIELDS)):
                add(f'candidates/{i}/supporting_matters/{j}/source_quote',quote,'Quote must substantiate this person’s stated role in this matter.',{'person':person,'claimed_role':support.get('personal_role'),'matter':matter})
            if not str(support.get('personal_role','')).strip():add(f'candidates/{i}/supporting_matters/{j}/personal_role','','Missing personal role; do not upgrade membership to leadership.',{'person':person,'matter':matter})
        for field in ('current_ranking','suggested_ranking','category_rationale','why_candidate','external_evidence','evidence_gaps','recommended_action','submission_bio'):
            if not str(candidate.get(field,'')).strip() or field=='suggested_ranking' and any(e in (f"Categoría incompatible con cargo confirmado: {candidate.get('name')}", f"Falta una categoría razonada o una brecha explícita: {candidate.get('name')}") for e in errors):
                add(f'candidates/{i}/{field}',candidate.get(field,''),'Specify a reasoned directory category, or Category pending with the precise missing criterion; explain changes to input objectives. Never invent eligibility or ranking.',{'person':person,'support':candidate.get('supporting_matters',[]),'matters':[register.get(s.get('matter_id'),{}) for s in candidate.get('supporting_matters',[])]})
    for field in ('filing_recommendation','positioning','target','target_rationale','principal_strength','principal_vulnerability','hero_rationale','b10','c2'):
        if not str(proposal.get(field,'')).strip() or field=='b10' and len(proposal.get(field,'').split())>500:
            add(field,proposal.get(field,''),'Missing editorial field; B10 must not exceed 500 words.',{'package':package,'strategy':strategy})
    for i,comparison in enumerate(proposal.get('comparisons',[])):
        for field in ('incremental_contribution','tradeoff'):
            if not comparison.get(field):add(f'comparisons/{i}/{field}','','Explain the specific incremental contribution and tradeoff.',{'selected':register.get(comparison.get('selected_id')),'reserve':register.get(comparison.get('alternative_id'))})
    for path in submission_voice_paths(proposal):
        parts=path.split('/')
        if parts[0]=='matters':
            item=proposal['matters'][int(parts[1])]
            evidence=register.get(item.get('matter_id'),{})
            value=item.get(parts[-1], '')
        elif parts[0]=='candidates':
            if '/'.join(parts[:2]) in targets:continue
            item=proposal['candidates'][int(parts[1])]
            evidence={'person':roster.get(_norm(item.get('name')),{}),'matters':[register.get(s.get('matter_id'),{}) for s in item.get('supporting_matters',[])]}
            value=item['submission_bio']
        else:
            evidence={'package':package,'strategy':strategy};value=proposal[path]
        add(path,value,'Remove auditor commentary about sources from this Submission field. Present supported work directly; preserve numbers, outcomes, attribution and uncertainty. Do not invent a completed outcome or delete substantive legal evidence/audit work.',evidence)
    return targets

def apply_corrections(proposal, targets, repair):
    result=copy.deepcopy(proposal);seen=set()
    for fix in repair.get('corrections',[]):
        path=fix.get('path')
        if path not in targets or path in seen or not fix.get('reason'):
            raise ValueError('Repair attempted an invalid or repeated generated field')
        value=fix.get('value')
        if isinstance(targets[path]['current_value'],dict):
            if not isinstance(value,dict) or len(path.split('/'))!=2 or not path.startswith('candidates/'):
                raise ValueError('Invalid candidate correction')
            value=Candidate.model_validate(value).model_dump()
            if value['name']!=targets[path]['current_value']['name']:
                raise ValueError('Repair cannot change candidate identity')
        elif not isinstance(value,str):
            raise ValueError('Invalid text correction')
        if value == targets[path]['current_value']:
            raise ValueError('Repair returned unchanged target')
        seen.add(path);parts=path.split('/');parent=result
        for part in parts[:-1]:parent=parent[int(part)] if isinstance(parent,list) else parent[part]
        key=int(parts[-1]) if isinstance(parent,list) else parts[-1]
        parent[key]=value
    if set(targets) - seen and not repair.get('unresolved'):
        raise ValueError('Repair left targets unchanged')
    return result

def repair_development(state, proposal, targets):
    from core.review_graph import invoke_role
    from core.editorial_development import bind_development, development_errors
    correction=create_model('AllowedEditorialCorrection',__base__=Correction,path=(Literal[tuple(targets)],...))
    schema=create_model('TargetedEditorialRepair',__base__=Repair,corrections=(list[correction],...))
    repair,trace=invoke_role(state,'repair',schema,TASK,{'repair_targets':targets,'feedback':state.get('repair_feedback',[]),'ranking_verification':state.get('ranking_verification') or state.get('package',{}).get('ranking_verification')})
    try:
        fixed=apply_corrections(proposal,targets,repair)
    except ValueError as error:
        return {'development':proposal,'development_validated':False,'errors':[str(error)],'trace':trace}
    fixed=bind_development(state['package'],fixed)
    errors=development_errors(state['package'],state['strategy'],fixed)
    if repair.get('unresolved'):errors.extend('Reparación pendiente: '+str(e) for e in repair['unresolved'])
    return {'development':fixed,'development_validated':not errors,'errors':errors,'trace':trace,
            'repair_report':{'corrected_paths':[c['path'] for c in repair.get('corrections',[])],'unresolved':repair.get('unresolved',[])}}

class RepairLocation(BaseModel):
    path: str
    defect_index: int
    reason: str

class RepairPlan(BaseModel):
    locations: list[RepairLocation]
    unresolved: list[str]


def repair_rejected_development(state, proposal, defects):
    """Locate semantic defects before editing; no full-proposal regeneration."""
    from core.review_graph import invoke_role, role_payload
    source_package=role_payload({'package':state['package']},'development')['package']
    allowed={key:value for key,value in proposal.items() if isinstance(value,str) and key!='version'}
    for i,item in enumerate(proposal.get('matters',[])):
        allowed[f'matters/{i}/text']=item.get('text','')
        allowed[f'matters/{i}/completion_status']=item.get('completion_status','')
    for i,item in enumerate(proposal.get('candidates',[])):allowed[f'candidates/{i}']=item
    for i,item in enumerate(proposal.get('comparisons',[])):
        for field in ('incremental_contribution','tradeoff'):allowed[f'comparisons/{i}/{field}']=item.get(field,'')
    location=create_model('AllowedRepairLocation',__base__=RepairLocation,path=(Literal[tuple(allowed)],...))
    schema=create_model('BoundedRepairPlan',__base__=RepairPlan,locations=(list[location],...),unresolved=(list[str],...))
    plan,trace=invoke_role(state,'repair',schema,
        'Locate the smallest set of generated fields that must change to resolve each supplied defect. Do not rewrite anything. Map each location to its zero-based defect_index. Source facts and validated selection are immutable. Do not use an Audit-only defect to rewrite the Submission. For a missing outcome, locate its one matter narrative; include a candidate only if their attributed case is also affected. A missing acceptance check alone is not evidence that every field is defective. Report unlocatable defects in unresolved. Never select unaffected fields for general improvement.',
        {'defects':defects,'generated_fields':allowed,'package':source_package,'strategy':state['strategy']})
    targets={};covered=set()
    for item in plan.get('locations',[]):
        path=item.get('path');index=item.get('defect_index')
        if path not in allowed or not isinstance(index,int) or not 0<=index<len(defects) or not item.get('reason'):
            return {'development':proposal,'development_validated':False,'errors':['Invalid bounded repair location.'],'trace':trace}
        covered.add(index)
        targets[path]={'current_value':allowed[path],'problem':item['reason'],'source_evidence':{'package':source_package,'strategy':state['strategy']}}
    if plan.get('unresolved') or len(covered)!=len(defects) or not targets:
        return {'development':proposal,'development_validated':False,'errors':['RankPilot debe localizar la corrección editorial sin regenerar contenido no afectado.'],'trace':trace}
    return repair_development({**state,'trace':trace},proposal,targets)


def repair_letter(state):
    """Patch rejected Audit fields; condense globally only for a length violation."""
    from core.review_graph import invoke_role, Letter, NextAction, reconcile_next_actions, audit_word_count, AUDIT_WORD_LIMIT, condense_audit_letter
    fields=('executive_assessment','portfolio','leadership','evidence_gaps','next_actions')
    feedback=state.get('repair_feedback',[])
    located=[d.get('field_path') for d in feedback]
    if located and all(key in fields for key in located):
        fields=tuple(dict.fromkeys(located))
    classification_only=bool(feedback) and all(d.get('code')=='SELECTION_MISMATCH' and d.get('scope')=='letter' for d in feedback)
    source_package=state['package']
    if classification_only:
        source_package={'matters':[{k:m.get(k) for k in ('id','client','name')} for m in state['package'].get('matters',[])]}
    change=create_model('AuditFieldCorrection',path=(Literal[fields],...),value=(Union[str,list[NextAction]],...),reason=(str,...))
    schema=create_model('AuditDelta',corrections=(list[change],...),unresolved=(list[str],...))
    result,trace=invoke_role(state,'writer',schema,
        'Repair the existing executive Audit after the supplied defects or targeted Submission correction. Return ONLY fields requiring change; all others are preserved exactly. Reconcile the letter with CURRENT development and original sources. Remove warnings about generated defects already corrected. A source-backed institutional B10 figure is not contradicted merely because another matter has the same number for a different population. Never claim a rendered document is approved or blocked: report strategic recommendations and genuine evidence gaps. Do not repeat system diagnostics or ask users to fix generated wording. Preserve portfolio, hero, candidates, supported comparisons and confirmed answers. Keep the whole five-section letter within 1800 words. next_steps is generated from next_actions; change next_actions only for genuine changed recommendations, preserving useful unanswered actions. If a field cannot be corrected faithfully, report unresolved. This patch must still pass the independent exact-Word review.',
        {'previous_letter':state['letter'],'defects':feedback,'package':source_package,'strategy':state['strategy'],'development':None if classification_only else state.get('development')})
    fixed=copy.deepcopy(state['letter']);seen=set()
    for correction in result['corrections']:
        key=correction['path'];value=correction['value']
        if key not in fields or key in seen or not correction['reason'] or (not isinstance(value,list) if key=='next_actions' else not isinstance(value,str)):
            return {'letter':state['letter'],'writer_validated':False,'errors':['Invalid bounded Audit correction.'],'trace':trace}
        if value == fixed.get(key):
            continue
        seen.add(key);fixed[key]=value
    fixed=reconcile_next_actions(Letter.model_validate(fixed).model_dump(),state['package'])
    # Repair additions are subject to the same executive-length contract as
    # initial writing. Condense once before validation instead of replaying
    # the expensive source-grounded repair with identical feedback.
    needs_condensation=audit_word_count(fixed)>AUDIT_WORD_LIMIT
    before_condensation=copy.deepcopy(fixed)
    fixed,trace=condense_audit_letter(state,fixed,trace)
    condensed_fields=[key for key in fixed if fixed[key]!=before_condensation.get(key)]
    from core.portfolio_consistency import verify_portfolio_consistency
    conflicts,trace=verify_portfolio_consistency({**state,'trace':trace},fixed)
    errors=[d['message'] for d in conflicts]
    requires_change=any(d.get('scope')=='letter' and d.get('severity')=='critical' for d in state.get('repair_feedback',[]))
    if result.get('unresolved') or (requires_change and not seen):errors.append('RankPilot debe completar la corrección del Audit; no se acepta una reparación sin cambios.')
    if audit_word_count(fixed)>AUDIT_WORD_LIMIT:errors.append('El Audit excede la extensión ejecutiva acordada.')
    return {'letter':fixed,'writer_validated':not errors,'errors':errors,'trace':trace,
            'repair_feedback':conflicts or state.get('repair_feedback',[]),
            'letter_repair_requested':bool(errors),'writer_attempts':state.get('writer_attempts',0)+1,
            'letter_repair_report':{'corrected_fields':sorted(seen | set(condensed_fields)),
                                    'condensation_requested':needs_condensation,'condensed_fields':condensed_fields,
                                    'unresolved':result.get('unresolved',[])}}
