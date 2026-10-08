"""Bounded, source-grounded repair of rejected editorial fields.

A repair may touch only validator-identified generated fields. It cannot edit
sources, selection, permissions, user answers, or approval state. Its result is
still a proposal and must pass the original validators and final document judge.
"""
import copy
from typing import Literal
from pydantic import BaseModel, create_model

class Correction(BaseModel):
    path: str
    value: str
    reason: str

class Repair(BaseModel):
    corrections: list[Correction]
    unresolved: list[str]

TASK='''Repair only the rejected generated fields identified in repair_targets. This is a targeted correction, not a new submission or strategy. Use the supplied original sources and preserve all unaffected content. For a quotation, copy a contiguous exact passage from the SAME named matter; do not paraphrase, stitch separate passages, borrow from another matter or create evidence. Select the passage that actually supports the claimed fact/role; never replace it with an unrelated matching quote just to satisfy validation. If no supporting passage exists, leave the correction unresolved. For prose, retain documented outcomes, numbers, attribution, uncertainty and confidentiality. Correct incompatible ranking categories using the confirmed seniority; do not invent a current rank. Shorten B10 only when requested, preserving decisive evidence. Never change sources, confirmed user answers, the portfolio, identities, publication permissions or approval status. Return only allowed paths, with a concise internal reason for each correction. Do not ask the user to repair generated wording. If evidence is genuinely missing or contradictory, report that in unresolved rather than guessing. A subsequent independent source and final-document review will assess every repair.'''

def repair_targets(package, strategy, proposal):
    from core.editorial_development import SOURCE_FIELDS, _norm, literal_quote, development_errors
    errors=development_errors(package,strategy,proposal)
    register={m['id']:m for m in package.get('matters',[])}
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
        for j,support in enumerate(candidate.get('supporting_matters',[])):
            matter=register.get(support.get('matter_id'),{})
            quote=literal_quote(support.get('source_quote'))
            if support.get('matter_id') in core and (not _norm(quote) or not any(_norm(quote) in _norm(matter.get(f)) for f in SOURCE_FIELDS)):
                add(f'candidates/{i}/supporting_matters/{j}/source_quote',quote,'Quote must substantiate this person’s stated role in this matter.',{'person':person,'claimed_role':support.get('personal_role'),'matter':matter})
            if not str(support.get('personal_role','')).strip():add(f'candidates/{i}/supporting_matters/{j}/personal_role','','Missing personal role; do not upgrade membership to leadership.',{'person':person,'matter':matter})
        for field in ('current_ranking','suggested_ranking','why_candidate','external_evidence','evidence_gaps','recommended_action','submission_bio'):
            if not str(candidate.get(field,'')).strip() or field=='suggested_ranking' and any(e==f"Categoría incompatible con cargo confirmado: {candidate.get('name')}" for e in errors):
                add(f'candidates/{i}/{field}',candidate.get(field,''),'Missing individual field or category incompatible with confirmed role.',{'person':person,'support':candidate.get('supporting_matters',[]),'matters':[register.get(s.get('matter_id'),{}) for s in candidate.get('supporting_matters',[])]})
    for field in ('filing_recommendation','positioning','target','principal_strength','principal_vulnerability','hero_rationale','b10','c2'):
        if not str(proposal.get(field,'')).strip() or field=='b10' and len(proposal.get(field,'').split())>500:
            add(field,proposal.get(field,''),'Missing editorial field; B10 must not exceed 500 words.',{'package':package,'strategy':strategy})
    for i,comparison in enumerate(proposal.get('comparisons',[])):
        for field in ('incremental_contribution','tradeoff'):
            if not comparison.get(field):add(f'comparisons/{i}/{field}','','Explain the specific incremental contribution and tradeoff.',{'selected':register.get(comparison.get('selected_id')),'reserve':register.get(comparison.get('alternative_id'))})
    return targets

def apply_corrections(proposal, targets, repair):
    result=copy.deepcopy(proposal);seen=set()
    for fix in repair.get('corrections',[]):
        path=fix.get('path')
        if path not in targets or path in seen or not isinstance(fix.get('value'),str) or not fix.get('reason'):
            raise ValueError('Repair attempted an invalid or repeated generated field')
        seen.add(path);parts=path.split('/');parent=result
        for part in parts[:-1]:parent=parent[int(part)] if isinstance(parent,list) else parent[part]
        key=int(parts[-1]) if isinstance(parent,list) else parts[-1]
        parent[key]=fix['value']
    return result

def repair_development(state, proposal, targets):
    from core.review_graph import invoke_role
    from core.editorial_development import bind_development, development_errors
    correction=create_model('AllowedEditorialCorrection',__base__=Correction,path=(Literal[tuple(targets)],...))
    schema=create_model('TargetedEditorialRepair',__base__=Repair,corrections=(list[correction],...))
    repair,trace=invoke_role(state,'repair',schema,TASK,{'repair_targets':targets,'feedback':state.get('repair_feedback',[])})
    try:
        fixed=apply_corrections(proposal,targets,repair)
    except ValueError as error:
        return {'development':proposal,'development_validated':False,'errors':[str(error)],'trace':trace}
    fixed=bind_development(state['package'],fixed)
    errors=development_errors(state['package'],state['strategy'],fixed)
    if repair.get('unresolved'):errors.extend('Reparación pendiente: '+str(e) for e in repair['unresolved'])
    return {'development':fixed,'development_validated':not errors,'errors':errors,'trace':trace,
            'repair_report':{'corrected_paths':[c['path'] for c in repair.get('corrections',[])],'unresolved':repair.get('unresolved',[])}}
