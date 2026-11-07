"""Bounded, source-grounded repair of rejected editorial fields.

A repair may touch only validator-identified generated fields. It cannot edit
sources, selection, permissions, user answers, or approval state. Its result is
still a proposal and must pass the original validators and final document judge.
"""
import copy
import re
from typing import Literal, Union
from pydantic import BaseModel, create_model
from core.editorial_development import Candidate, Comparison
from core.editorial_case import EditorialCase, support_ids as eligible_support_ids, case_errors
from core.editorial_execution import EXECUTION_CONTRACT, InstitutionalLink, personal_case_errors, institutional_errors, missing_head_bios

class Correction(BaseModel):
    path: str
    value: Union[str, Candidate]
    reason: str

class Repair(BaseModel):
    corrections: list[Correction]
    unresolved: list[str]


def unknown_repair_usage(trace):
    return any(bool((call.get('usage') or {}).get('unknown_calls'))
               or call.get('usage_status') in ('unknown','partial_unknown')
               or unknown_repair_usage(call.get('calls',[])) for call in trace or [])

TASK='''Repair only the rejected generated fields identified in repair_targets. This is a targeted correction, not a new submission or strategy. Use the supplied original sources and preserve all unaffected content. For a quotation, copy a contiguous exact passage from the SAME named matter; do not paraphrase, stitch separate passages, borrow from another matter or create evidence. Select the passage that actually supports the claimed fact/role; never replace it with an unrelated matching quote just to satisfy validation. If no supporting passage exists, leave the correction unresolved. For prose, retain documented outcomes, numbers, attribution, uncertainty and confidentiality. Correct incompatible ranking categories using the confirmed seniority; do not invent a current rank. Shorten B10 only when requested, preserving decisive evidence. Never change sources, confirmed user answers, the portfolio, identities, publication permissions or approval status. Return only allowed paths, with a concise internal reason for each correction. Do not ask the user to repair generated wording. If evidence is genuinely missing or contradictory, report that in unresolved rather than guessing. A subsequent independent source and final-document review will assess every repair.'''
TASK+=''' When an entire candidates/N object is an allowed target, reassess that candidate's generated attribution against the supplied person and eligible source matters (core or pertinent reserve, never excluded work). If a claimed supporting matter names someone else and does not support this candidate, REMOVE that supporting entry; do not seek or invent a quote for an unsupported role. Revise the same candidate's recommendation, ranking rationale, internal strategy and public bio to match the remaining actual evidence. Preserve the exact candidate name, confirmed seniority and all supported work. If no personally attributed matter remains, use develop or do_not_present and accurately describe the gap. Do not leave an avoidable false generated attribution unresolved merely because no evidence exists for it: withdraw that claim. Genuine source contradictions remain unresolved. Return the complete corrected candidate object as value for this path, not JSON encoded inside a string.'''
TASK+=''' repair_targets and their problem labels describe defects in GENERATED text, never source evidence. A wrong quote or duplicate entry does not invalidate the underlying matter or another source-backed attribution to it. Retain a valid attribution once and remove only the unsupported/duplicate claims. Do not report a source conflict merely because the generated proposal disagrees with its source.'''
TASK+=''' Write natural public prose, including confidential-section narratives: never explain that a source, record or supplied field states or omits something. Express an actual pending state as ongoing without inventing a final judicial decision. Keep material uncertainty but put source-completeness assessments in internal fields. The form label Lead Partner(s) alone is not evidence of partner seniority: use lead lawyer unless the person's actual partner status is supported by the roster or explicit substantive source text. Fix capitalization after legal suffixes without turning a true new sentence into a lowercase fragment. Do not leave joined sentences or malformed English.'''
TASK+=''' For a defect explicitly marked conflict_resolution=omit_nonessential_descriptor and source_field_path (or unbound field_path)=client_sector, withdraw ONLY the disputed optional industry descriptor from generated prose, choosing neither source version. Keep all supported mandate facts, scale, outcomes, roles and the canonical selection. This editorial containment is resolvable without confirming or changing the source sector. Retain the original source discrepancy; never extend this exception to material identity, amount, date, outcome, attribution or permission conflicts.'''

TASK+=''' When a confidentiality defect identifies a revealing combination in public B9/B10/C2, generalize ONLY that combination in the permitted public fields. Keep the legal work, personal attribution and supported scale in non-identifying terms. Preserve every exact source fact and metric in confidential section E; never weaken the confidential matter narrative merely to anonymize a public profile. This is an allowed privacy transformation, not invented evidence or a source edit.'''

TASK += " A same-party spelling variant is an editorial alias, not a genuine unanswered identity question. Preserve original source fields and add both attested variants once in the internal Audit when relevant; do not invent a corporate identity or ask the user to select spelling. For public privacy repairs, remove the identifying combination across ALL flagged B9/B10/C2 fields while retaining meaningful legal work and attribution. Retain exact private figures in E only."

TASK += " Voice repairs: B9 states attested credentials and contributions directly, without 'supplied biography/profile/materials'. C2 requests coverage directly, without 'respectfully seeks' or 'the submission identifies'. D8/E8 states the documented procedural position, not what a status field says or what the document omits. If no actual status is documented, N/A is permitted without further commentary; never invent ongoing proceedings or a final outcome. Preserve genuine uncertainty and integrate explicit dated updates without assuming later activity."

TASK += " rejected_quotes is a bound postcondition for this generated field: remove or faithfully correct those exact false assertions, including actionable warnings alongside critical defects in the same field. Editing another sentence is insufficient. Preserve supported legal facts. Explain decisions to omit an optional descriptor only in reason or the internal Audit; never add a Submission sentence about source inconsistency, sector classification omitted, or why an editorial choice was made."

TASK += " Remove an unsupported supporting_matter from a candidate when that original mandate names other lawyers and never this candidate. Reconcile the candidate's rationale and bio; keep the mandate itself and all other candidates intact. A D5/E5 Lead partner template heading does not promote its named matter leader to partner. For a non-nominated leader, correct an added partner title with neutral leadership wording while preserving both original passages; do not turn this software wording correction into a user-confirmation request. A mismatch in the Audit core count must be corrected to the unchanged canonical selection, never by adding matters."

TASK += " For a validated qualify_disputed_outcome correction, do not resolve the source conflict. Replace unqualified final-victory or final-defeat claims ONLY in permitted generated fields with the separately evidenced interim/procedural achievement in outcome_qualification. Preserve decisive uncontested facts and personal attribution. Do not infer ongoing proceedings or a completion date from the disputed result. Keep both original alternatives and explicit final-outcome uncertainty in the Audit; confirmation is optional if the client later wants to add a final result, not a prerequisite for the limited accurate version. The corrected exact Word pair must still pass independent review. Never extend this exception to identity, amounts, roles, permission or a case whose selection depends on the disputed final result."
TASK += " When a text-only biography target supplies preserve_profile_quotes, retain each unaffected credential span verbatim and correct only the separate identified wording. This target cannot edit the candidate's profile-coverage metadata or other fields. If the defect overlaps one of those spans, report that conflict unresolved rather than silently breaking its binding."
TASK += " A candidate object target with mutable_fields authorizes only those fields. When correcting a rejected promotional claim overlapping a profile unit, preserve the original source unit and material career role, update its actual public_quote/retain-or-generalize decision, and withdraw only the rejected assertion. Do not preserve the rejected wording merely because its old public_quote included a valid credential. Keep all personally attributed source bindings. For linked-editorial-execution-v1, refresh affected submission_case_coverage and institutional_execution output quotations together with their prose. Retain all original source links, roles and shared argument indices. These are internal bindings; never print them in the documents."

def public_privacy_paths(defect, proposal):
    """Respect every public overview field explicitly flagged by the reviewer."""
    message=str(defect.get('message',''))
    if defect.get('scope')!='submission' or not re.search(r'confidencial|confidential',message,re.I):
        return []
    return [p for p in ('b10','c2') if isinstance(proposal.get(p),str)
            and re.search(r'\b'+p+r'\b',message,re.I)]

def repair_targets(package, strategy, proposal):
    from core.editorial_development import SOURCE_FIELDS, _norm, literal_quote, development_errors, submission_voice_paths
    errors=development_errors(package,strategy,proposal)
    source_keys=set(SOURCE_FIELDS) | {'id','client','name','title','source_label','source_heading','publish_status','resolved_publication_status','publication_route','confidentialityConfirmed','isConfidential','confidentialityEvidence','valueResolution','valueConflict'}
    register={m['id']:{k:v for k,v in m.items() if k in source_keys} for m in package.get('matters',[])}
    roster={_norm(l.get('name') or l.get('fullName')):l for l in package.get('lawyers',[])}
    core={d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='core'}
    eligible_support = eligible_support_ids(package,strategy)
    targets={}
    def add(path,value,problem,evidence):
        targets[path]={'current_value':value,'problem':problem,'source_evidence':evidence}
    def candidate_evidence(candidate,person):
        from core.role_evidence import matter_names_person,identity
        related=[m for mid,m in register.items() if mid in eligible_support and matter_names_person(candidate.get('name'),m)]
        claims={m.get('matter_id') for m in candidate.get('supporting_matters',[])}
        return {'person':person,'eligible_source_matters':related,
            'invalid_claimed_sources':[m for mid,m in register.items() if mid in claims and m not in related],
            'public_entity_restrictions':[{k:m.get(k) for k in ('client','name','publication_route','resolved_publication_status')} for m in register.values()],
            'confirmed_heads':[{'name':h['name']} for h in package.get('filing_details',{}).get('heads',[]) if isinstance(h,dict) and identity(h.get('name'))==identity(candidate.get('name'))]}
    for i,draft in enumerate(proposal.get('matters',[])):
        matter=register.get(draft.get('matter_id'),{})
        from core.editorial_development import DEVELOPMENT_VERSION
        if proposal.get('version') == DEVELOPMENT_VERSION or 'legal_issue_source_quote' in draft:
            issue=literal_quote(draft.get('legal_issue_source_quote',''))
            if not _norm(issue) or not any(_norm(issue) in _norm(matter.get(f)) for f in SOURCE_FIELDS):
                add(f'matters/{i}/legal_issue_source_quote',draft.get('legal_issue_source_quote',''),
                    'Copy the exact passage identifying this matter’s legal problem or purpose from its own original source. Never invent or borrow an issue.',matter)
        for j,quote in enumerate(draft.get('decisive_source_quotes',[])):
            if not _norm(literal_quote(quote)) or not any(_norm(literal_quote(quote)) in _norm(matter.get(f)) for f in SOURCE_FIELDS):
                add(f'matters/{i}/decisive_source_quotes/{j}',quote,'Quotation is not literal in this matter.',matter)
        if not str(draft.get('text','')).strip():add(f'matters/{i}/text',draft.get('text',''),'Missing source-backed matter prose.',matter)
    for i,candidate in enumerate(proposal.get('candidates',[])):
        person=roster.get(_norm(candidate.get('name')), {})
        from core.candidate_evidence import profile_units, profile_errors, category_error
        linked_fault=proposal.get('execution_contract')==EXECUTION_CONTRACT and personal_case_errors(package,candidate)
        if proposal.get('version')=='editorial-development-v4' and (profile_errors(person,candidate) or category_error(candidate) or linked_fault):
            add(f'candidates/{i}',candidate,'Account for every original profile credential alongside mandate evidence; retain material career/office facts or justify a genuine omission. Develop distinct personally attributed contributions in B9 and bind submission_case_coverage to its own sources and actual bio passages. Specify a concrete category or Category pending with the exact missing criterion and action. Preserve source, identity, permissions and supported attribution.',{**candidate_evidence(candidate,person),'profile_units':profile_units(person)})
            continue
        invalid_support=[]
        for support in candidate.get('supporting_matters',[]):
            from core.role_evidence import matter_names_person
            matter=register.get(support.get('matter_id'),{})
            quote=literal_quote(support.get('source_quote'))
            if support.get('matter_id') not in eligible_support or not _norm(quote) or not any(_norm(quote) in _norm(matter.get(f)) for f in SOURCE_FIELDS) or not matter_names_person(candidate.get('name'), matter):
                invalid_support.append(support.get('matter_id'))
        support_ids=[s.get('matter_id') for s in candidate.get('supporting_matters',[])]
        if invalid_support or len(support_ids)!=len(set(support_ids)) or (candidate.get('recommendation')=='present' and not support_ids):
            add(f'candidates/{i}',candidate,'Correct this generated candidacy; remove unsupported personal attributions and duplicates, then reconcile the bio, category and recommendation with actual evidence. This flags generated claims, not invalid source matters.',{**candidate_evidence(candidate,person),'dispositions':strategy.get('matters',[])})
            continue
        for j,support in enumerate(candidate.get('supporting_matters',[])):
            matter=register.get(support.get('matter_id'),{})
            quote=literal_quote(support.get('source_quote'))
            if support.get('matter_id') in eligible_support and (not _norm(quote) or not any(_norm(quote) in _norm(matter.get(f)) for f in SOURCE_FIELDS)):
                add(f'candidates/{i}/supporting_matters/{j}/source_quote',quote,'Quote must substantiate this person’s stated role in this matter.',{'person':person,'claimed_role':support.get('personal_role'),'matter':matter})
            if not str(support.get('personal_role','')).strip():add(f'candidates/{i}/supporting_matters/{j}/personal_role','','Missing personal role; do not upgrade membership to leadership.',{'person':person,'matter':matter})
        for field in ('current_ranking','suggested_ranking','category_rationale','why_candidate','external_evidence','evidence_gaps','recommended_action','submission_bio'):
            if not str(candidate.get(field,'')).strip() or field=='suggested_ranking' and any(e in (f"Categoría incompatible con cargo confirmado: {candidate.get('name')}", f"Falta una categoría razonada o una brecha explícita: {candidate.get('name')}") for e in errors):
                add(f'candidates/{i}/{field}',candidate.get(field,''),'Specify a reasoned directory category, or Category pending with the precise missing criterion; explain changes to input objectives. Never invent eligibility or ranking.',{'person':person,'support':candidate.get('supporting_matters',[]),'matters':[register.get(s.get('matter_id'),{}) for s in candidate.get('supporting_matters',[])]})
    for field in ('filing_recommendation','positioning','target','target_rationale','principal_strength','principal_vulnerability','hero_rationale','b10','c2'):
        if not str(proposal.get(field,'')).strip() or field=='b10' and len(proposal.get(field,'').split())>1000:
            add(field,proposal.get(field,''),'Missing editorial field; B10 must not exceed 1,000 words.',{'package':package,'strategy':strategy})
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
        from core.editorial_voice import voice_matches
        targets[path]['rejected_quotes']=voice_matches(value)
        if parts[0]=='candidates':
            targets[path]['preserve_profile_quotes']=[c.get('public_quote') for c in item.get('profile_coverage',[])
                if c.get('decision') in ('retain','generalize') and c.get('public_quote')]
    from core.public_privacy import public_privacy_findings
    for finding in public_privacy_findings(package,strategy,proposal):
        path=finding['path'];parts=path.split('/')
        value=proposal[path] if len(parts)==1 else proposal['candidates'][int(parts[1])]['submission_bio']
        existing=targets.get(path)
        evidence=(existing or {}).get('source_evidence',{'affected_confidential_matters':[]})
        evidence.setdefault('affected_confidential_matters',[])
        matter=register[finding['matter_id']]
        if matter not in evidence['affected_confidential_matters']:evidence['affected_confidential_matters'].append(matter)
        problem=((existing or {}).get('problem','')+' Generalize the case-specific combination of confidential metrics in this PUBLIC field. '
                 'Keep the legal work and personal attribution; retain exact metrics and all decisive facts in E. '
                 'Preserve unrelated public text and confirmed department-wide facts. Never edit the confidential narrative or ask the user for an editorial correction.')
        add(path,value,problem,evidence)
        targets[path].setdefault('privacy_matter_ids',[])
        if finding['matter_id'] not in targets[path]['privacy_matter_ids']:targets[path]['privacy_matter_ids'].append(finding['matter_id'])
    case_faults=case_errors(package,strategy,proposal) if proposal.get('version') in ('editorial-development-v3','editorial-development-v4') else []
    if any('comparaciones de reservas' in e for e in case_faults):
        add('comparisons',proposal.get('comparisons',[]),'Append missing reserve comparisons; preserve existing pairs and text.',{'package':package,'strategy':strategy})
    if any('comparación visible' in e for e in case_faults) and proposal.get('comparisons'):
        add('comparisons/0/audit_required',False,'Expose the closest borderline comparison in the Audit; retain its source-backed tradeoff.',{'package':package,'strategy':strategy})
    if any('comparaciones de reservas' not in e and 'comparación visible' not in e for e in case_faults):
        add('case_plan',proposal.get('case_plan',{}),'Repair the shared source-bound case plan and all documented additional-leader assessments; preserve sources, selection and public prose.',{'package':package,'strategy':strategy})
    for i in missing_head_bios(package,proposal):
        if f'candidates/{i}' not in targets:
            candidate=proposal['candidates'][i]
            add(f'candidates/{i}/submission_bio',candidate['submission_bio'],
                'State this separately confirmed department-head function in natural B9 prose. A partner title or leading a matter alone does not state that function. Preserve existing career credentials and personally attributed work; do not invent partner seniority.',
                {'candidate':candidate,'confirmed_heads':package.get('filing_details',{}).get('heads',[])})
    if proposal.get('execution_contract')==EXECUTION_CONTRACT and institutional_errors(proposal):
        add('institutional_execution',proposal.get('institutional_execution',[]),
            'Bind every shared case argument to its actual distinct B10 and C2 passage. This internal mapping cannot invent text or substitute another field.',{'case_plan':proposal.get('case_plan'),'b10':proposal.get('b10'),'c2':proposal.get('c2')})
        if ' '.join(proposal.get('b10','').split())==' '.join(proposal.get('c2','').split()):
            add('c2',proposal.get('c2',''),'Develop the source-grounded coverage request from the shared arguments instead of copying B10. Preserve the objective, sources and factual limits.',{'package':package,'strategy':strategy})
    return targets

def apply_corrections(proposal, targets, repair, allow_unchanged=False):
    result=copy.deepcopy(proposal);seen=set()
    for fix in repair.get('corrections',[]):
        path=fix.get('path')
        if path not in targets or path in seen or not fix.get('reason'):
            raise ValueError('Repair attempted an invalid or repeated generated field')
        value=fix.get('value')
        if isinstance(targets[path]['current_value'],dict):
            if not isinstance(value,dict) or (path!='case_plan' and (len(path.split('/'))!=2 or not path.startswith('candidates/'))):
                raise ValueError('Invalid candidate correction')
            value=(EditorialCase if path=='case_plan' else Candidate).model_validate(value).model_dump(exclude_unset=True)
            if path!='case_plan' and value['name']!=targets[path]['current_value']['name']:
                raise ValueError('Repair cannot change candidate identity')
            mutable=targets[path].get('mutable_fields')
            if mutable:
                before=Candidate.model_validate(targets[path]['current_value']).model_dump()
                after=Candidate.model_validate(value).model_dump()
                if any(after[k]!=before[k] for k in before if k not in mutable):
                    raise ValueError('Biography repair cannot change unrelated candidacy fields')
                bindings=lambda c:[(item['matter_id'],item['source_quote']) for item in c.get('submission_case_coverage',[])]
                if bindings(after)!=bindings(before):raise ValueError('Biography repair cannot change personally attributed source bindings')
        elif path=='institutional_execution' and isinstance(value,list):
            value=[InstitutionalLink.model_validate(item).model_dump() for item in value]
        elif path=='comparisons' and isinstance(value,list):
            value=[Comparison.model_validate(item).model_dump() for item in value]
            original=[Comparison.model_validate(item).model_dump() for item in targets[path]['current_value']]
            if value[:len(original)]!=original:raise ValueError('Repair cannot rewrite existing comparisons while appending missing pairs')
        elif isinstance(value,bool) and isinstance(targets[path]['current_value'],bool):
            pass
        elif not isinstance(value,str):
            raise ValueError('Invalid text correction')
        if not allow_unchanged and value == targets[path]['current_value']:
            raise ValueError('Repair returned unchanged target')
        seen.add(path);parts=path.split('/');parent=result
        for part in parts[:-1]:parent=parent[int(part)] if isinstance(parent,list) else parent[part]
        key=int(parts[-1]) if isinstance(parent,list) else parts[-1]
        if targets[path].get('mutable_fields'):
            value={**parent[key],**{field:value[field] for field in targets[path]['mutable_fields'] if field in value}}
        parent[key]=value
    if set(targets) - seen and not repair.get('unresolved'):
        raise ValueError('Repair left targets unchanged')
    return result

def repair_development(state, proposal, targets):
    from core.review_graph import invoke_role, role_payload
    from core.editorial_development import bind_development, development_errors
    if unknown_repair_usage(state.get('trace',[])):
        return {'development':proposal,'development_validated':False,
                'errors':['No se inicia otra reparación con consumo del proveedor desconocido.'],
                'trace':state.get('trace',[])}
    targets=coherent_repair_targets(proposal,targets)
    # Bind shape to path, so a prose target cannot receive a Candidate object.
    shapes=[]
    for kind,paths in (
        (str,[p for p,t in targets.items() if isinstance(t['current_value'],str)]),
        (bool,[p for p,t in targets.items() if isinstance(t['current_value'],bool)]),
        (Candidate,[p for p,t in targets.items() if isinstance(t['current_value'],dict) and p!='case_plan']),
        (EditorialCase,[p for p in targets if p=='case_plan']),
        (list[Comparison],[p for p in targets if p=='comparisons']),
        (list[InstitutionalLink],[p for p in targets if p=='institutional_execution'])):
        if paths:
            shapes.append(create_model('EditorialCorrection'+str(len(shapes)),
                path=(Literal[tuple(paths)],...),value=(kind,...),reason=(str,...)))
    correction=Union[tuple(shapes)] if len(shapes)>1 else shapes[0]
    schema=create_model('TargetedEditorialRepair',__base__=Repair,corrections=(list[correction],...))
    # Semantic targets share the same complete evidence. Send it once, not once
    # per generated path; distinct target-specific evidence remains untouched.
    shared=None;payload_targets=copy.deepcopy(targets)
    for target_path,target in payload_targets.items():
        evidence=target.get('source_evidence')
        if isinstance(evidence,dict) and set(evidence)=={'package','strategy'} and isinstance(evidence['package'].get('matters'),list):
            # Public prose is grounded in the selected portfolio. Reserve
            # sources and old generated proposals are not evidence for it.
            selected=eligible_support_ids(evidence['package'],state['strategy']) if target_path=='comparisons' else {d['matter_id'] for d in state['strategy'].get('matters',[]) if d.get('disposition')=='core'}
            package=role_payload({'package':evidence['package']},'development')['package']
            package['matters']=[m for m in package.get('matters',[]) if m.get('id') in selected]
            strategy={**evidence['strategy'],'matters':[d for d in evidence['strategy'].get('matters',[]) if d.get('matter_id') in selected]}
            evidence={'package':package,'strategy':strategy}
            target['source_evidence']=evidence
        if isinstance(evidence,dict) and set(evidence)=={'package','strategy'}:
            if shared is None:shared=evidence
            if evidence==shared:target['source_evidence']={'reference':'shared_source_evidence'}
    feedback=list(state.get('repair_feedback',[]))
    repair,trace=invoke_role(state,'repair',schema,TASK,{'repair_targets':payload_targets,'shared_source_evidence':shared,'feedback':feedback,'ranking_verification':state.get('ranking_verification') or state.get('package',{}).get('ranking_verification')})
    try:
        fixed=apply_corrections(proposal,targets,repair,allow_unchanged=True)
    except ValueError as error:
        return {'development':proposal,'development_validated':False,'errors':[str(error)],'trace':trace}
    def at(document,path):
        value=document
        for part in path.split('/'):value=value[int(part)] if isinstance(value,list) else value[part]
        return value
    norm=lambda value:' '.join(str(value or '').split()).casefold()
    def failures(document):
        from core.public_privacy import public_privacy_findings
        privacy_paths={f['path'] for f in public_privacy_findings(state['package'],state['strategy'],document)}
        return [path for path,target in targets.items()
                if path in privacy_paths or (not target.get('binding_only') and at(document,path)==target['current_value']) or any(
                    norm(quote) in norm(at(document,target.get('rejected_quote_path',path))) for quote in target.get('rejected_quotes',[]) if norm(quote))]
    failed=failures(fixed)
    # A whole-candidate correction can introduce a local voice fault in its
    # biography. Validate descendants as well as the original edited object;
    # completing a correction is not merely changing the parent's value.
    from core.editorial_development import submission_voice_paths
    owned=lambda path:any(path==parent or path.startswith(parent+'/') for parent in targets)
    local_targets=repair_targets(state['package'],state['strategy'],fixed)
    voice_residuals={path:local_targets[path] for path in submission_voice_paths(fixed)
                     if owned(path) and path in local_targets
                     and isinstance(local_targets[path].get('current_value'),str)}
    retry_targets={path:copy.deepcopy(payload_targets[path]) for path in failed
                   if isinstance(targets[path]['current_value'],str)
                   and (targets[path].get('rejected_quotes') or targets[path].get('privacy_matter_ids'))}
    for path,target in voice_residuals.items():
        if path in retry_targets:
            retry_targets[path]['problem']=retry_targets[path].get('problem','')+' '+target.get('problem','')
            retry_targets[path]['rejected_quotes']=list(dict.fromkeys(
                retry_targets[path].get('rejected_quotes',[])+target.get('rejected_quotes',[])))
        else:retry_targets[path]=copy.deepcopy(target)
    for path,target in retry_targets.items():
        target['current_value']=at(fixed,path)
        if path.startswith('candidates/') and path.endswith('/submission_bio'):
            candidate=fixed['candidates'][int(path.split('/')[1])]
            target['preserve_profile_quotes']=[c.get('public_quote') for c in candidate.get('profile_coverage',[])
                if c.get('decision') in ('retain','generalize') and c.get('public_quote')]
    retry_count=0
    retry_error=None
    # Retry a known completed but ineffective textual correction once, before
    # buying another full Audit/render/judge cycle. Already corrected fields and
    # unrelated sources are excluded. Unknown provider outcomes never enter here.
    if retry_targets and not repair.get('unresolved') and all(path in retry_targets for path in failed):
        known=bool(trace) and not unknown_repair_usage(trace) and all(
            isinstance((call.get('usage') or {}).get('total_tokens'),(int,float))
            and (call.get('usage') or {})['total_tokens']>=0 for call in trace)
        if known:
            retry_count=1
            # Materialize only shared evidence needed by this remaining target.
            uses_shared=any(t.get('source_evidence')=={'reference':'shared_source_evidence'} for t in retry_targets.values())
            retry_correction=create_model('ResidualTextCorrection',path=(Literal[tuple(retry_targets)],...),value=(str,...),reason=(str,...))
            retry_schema=create_model('ResidualTextRepair',__base__=Repair,corrections=(list[retry_correction],...))
            try:
                retry,trace=invoke_role({**state,'trace':trace},'repair',retry_schema,TASK+' The previous correction left or introduced a localized wording defect. Correct ONLY repair_targets. Every rejected_quotes entry must be corrected. Preserve every supplied preserve_profile_quotes span verbatim; correct the separate affected wording without rewriting those credentials. Put editorial reasons in reason, never in Submission prose. Do not remove supported legal work or substitute a paraphrase of a rejected false assertion.',
                    {'repair_targets':retry_targets,'shared_source_evidence':shared if uses_shared else None,'feedback':[],
                     'previous_failure':'A rejected claim, private footprint or auditor voice remains in these exact generated fields. Preserve other corrected fields, all confidential E facts and the unchanged profile credentials.'})
                fixed=apply_corrections(fixed,retry_targets,retry,allow_unchanged=True)
                repair={**retry,'unresolved':retry.get('unresolved',[])}
            except Exception as error:
                # A pre-call deadline or failed second request must not erase
                # the first paid response or its known/unknown usage history.
                if getattr(error,'trace_history',None):trace=error.trace_history
                elif getattr(error,'trace',None):trace=list(trace)+[error.trace]
                retry_error='La corrección localizada no pudo completarse; se conserva el avance y el consumo.'
            failed=failures(fixed)
    remaining_voice=[path for path in submission_voice_paths(fixed) if owned(path)]
    failed=list(dict.fromkeys(failed+remaining_voice))
    fixed=bind_development(state['package'],fixed)
    errors=development_errors(state['package'],state['strategy'],fixed)
    if retry_error:errors.append(retry_error)
    errors.extend('La reparación no completó la corrección requerida: '+path for path in failed)
    if repair.get('unresolved'):errors.extend('Reparación pendiente: '+str(e) for e in repair['unresolved'])
    return {'development':fixed,'development_validated':not errors,'errors':errors,'trace':trace,
            'repair_report':{'corrected_paths':[path for path in targets if path not in failed],
                             'unresolved':repair.get('unresolved',[]),'failed_paths':failed,'surgical_retries':retry_count}}

class RepairLocation(BaseModel):
    path: str
    defect_index: int
    reason: str

class RepairPlan(BaseModel):
    locations: list[RepairLocation]
    unresolved: list[str]


def unique_defects(defects):
    """One concrete correction per identical claim; retain the strongest severity."""
    result=[];positions={}
    for defect in defects:
        quote=' '.join(str(defect.get('artifact_quote') or '').split())
        key=tuple(defect.get(k) for k in ('code','scope','matter_id','field_path','conflict_basis','conflict_resolution','conflicting_artifact_term'))+(quote,)
        if quote and key in positions:
            at=positions[key]
            if defect.get('severity')=='critical':result[at]=defect
        else:
            if quote:positions[key]=len(result)
            result.append(defect)
    return result

def repair_rejected_development(state, proposal, defects):
    """Locate semantic defects before editing; no full-proposal regeneration."""
    from core.review_graph import invoke_role, role_payload, calibrate_verdict
    defects=unique_defects(defects)
    # Reclassify historical cached source questions before purchasing a locator.
    defects=[calibrate_verdict({'defects':[d]},state['package'],state['strategy'])['defects'][0]
             if d.get('code')=='REVIEW_REQUIRED' and d.get('scope')=='facts' and d.get('field_path')=='value' else d
             for d in defects]
    dev_defects=[d for d in defects if d.get('scope')!='letter' and d.get('owner')!='user']
    if not dev_defects:
        return {'development':proposal,'development_validated':True,'errors':[],'trace':state.get('trace',[])}
    defects=dev_defects
    source_package=role_payload({'package':state['package']},'development')['package']
    allowed={key:value for key,value in proposal.items() if isinstance(value,str) and key!='version'}
    if isinstance(proposal.get('case_plan'),dict):allowed['case_plan']=proposal['case_plan']
    for i,item in enumerate(proposal.get('matters',[])):
        allowed[f'matters/{i}/text']=item.get('text','')
        allowed[f'matters/{i}/completion_status']=item.get('completion_status','')
    for i,item in enumerate(proposal.get('candidates',[])):
        allowed[f'candidates/{i}/submission_bio']=item.get('submission_bio','')
        allowed[f'candidates/{i}/category_rationale']=item.get('category_rationale','')
        allowed[f'candidates/{i}']=item
    for i,item in enumerate(proposal.get('comparisons',[])):
        for field in ('incremental_contribution','tradeoff'):allowed[f'comparisons/{i}/{field}']=item.get(field,'')
    # A literal claim already bound to a generated field needs no model to
    # rediscover its address. Only genuinely semantic locations buy a locator.
    norm=lambda value:' '.join(str(value or '').split())
    def source_for(path):
        if path.startswith('matters/'):
            matter_id=proposal['matters'][int(path.split('/')[1])]['matter_id']
            matter=next((m for m in source_package.get('matters',[]) if m['id']==matter_id),None)
            if matter is not None:
                return {'scope':{k:source_package.get(k) for k in ('directory','practice_area','jurisdiction')},
                        'matter':matter,
                        'selection':next((d for d in state['strategy'].get('matters',[]) if d['matter_id']==matter_id),None)}
        elif path.startswith('candidates/'):
            cand_idx=int(path.split('/')[1])
            cand=proposal.get('candidates',[])[cand_idx] if cand_idx<len(proposal.get('candidates',[])) else {}
            person_name=cand.get('name','')
            lawyers=source_package.get('lawyers',[])
            person=next((l for l in lawyers if str(l.get('name','')).strip().casefold()==str(person_name).strip().casefold()),{})
            from core.role_evidence import matter_names_person, identity
            eligible=eligible_support_ids(state['package'],state['strategy'])
            related=[m for m in source_package.get('matters',[]) if m['id'] in eligible and matter_names_person(person_name,m)]
            return {'scope':{k:source_package.get(k) for k in ('directory','practice_area','jurisdiction')},
                    'candidacy_context':{k:cand.get(k) for k in ('name','recommendation','suggested_ranking','category_rationale','why_candidate')},
                    'source_person':person,'personally_attributed_matters':related,
                    'confirmed_heads':[{'name':h['name']} for h in source_package.get('filing_details',{}).get('heads',[])
                        if isinstance(h,dict) and identity(h.get('name'))==identity(person_name)],
                    'public_entity_restrictions':[{k:m.get(k) for k in ('client','name','publication_route','resolved_publication_status')}
                        for m in source_package.get('matters',[])]}
        return {'package':source_package,'strategy':state['strategy']}
    # Include all deterministic faults already visible in this proposal in the
    # same paid repair, rather than discovering another field after each call.
    from core.editorial_development import submission_voice_paths
    from core.public_privacy import public_privacy_findings
    local_paths=set(submission_voice_paths(proposal)) | {f['path'] for f in public_privacy_findings(state['package'],state['strategy'],proposal)}
    targets={p:t for p,t in repair_targets(state['package'],state['strategy'],proposal).items() if p in local_paths};remaining=[]
    for defect in defects:
        quote=norm(defect.get('artifact_quote'))
        candidates=list(allowed)
        if defect.get('matter_id'):
            indices=[i for i,m in enumerate(proposal.get('matters',[])) if m.get('matter_id')==defect['matter_id']]
            matter_candidates=[path for path in candidates if any(path.startswith(f'matters/{i}/') for i in indices)]
            exact=[path for path in matter_candidates if quote and isinstance(allowed[path],str) and quote in norm(allowed[path])]
            if not exact and quote:
                exact=[path for path in candidates if isinstance(allowed[path],str) and quote in norm(allowed[path])]
        else:
            exact=[path for path in candidates if quote and isinstance(allowed[path],str) and quote in norm(allowed[path])]
        if not exact and defect.get('scope') == 'submission':
            # A matter-specific finding may quote the firm overview or coverage
            # argument. A unique literal match needs no paid location inference.
            shared=[path for path in ('b10','c2') if path in allowed and quote and quote in norm(allowed[path])]
            if len(shared)==1:exact=shared
        if not exact and str(defect.get('field_path','')).lower() in allowed:
            exact=[str(defect['field_path']).lower()]
        privacy_paths=public_privacy_paths(defect,proposal)
        public_path=str(defect.get('field_path',''))
        public_privacy=bool(privacy_paths) or (defect.get('scope')=='submission' and
            re.search(r'confidencial|confidential',str(defect.get('message','')),re.I) and
            (public_path in ('b10','c2') or (public_path.startswith('candidates/') and public_path.endswith('/submission_bio'))))
        if public_privacy:
            # A public bio can quote the confidential E narrative verbatim.
            # Privacy repair must never target E just because it matches first.
            exact=[p for p in allowed if isinstance(allowed[p],str) and quote and quote in norm(allowed[p])
                   and (p in ('b10','c2') or (p.startswith('candidates/') and p.endswith('/submission_bio')))]
            if public_path in allowed and public_path not in exact:
                exact.append(public_path)
        exact=list(dict.fromkeys(exact+privacy_paths))
        exact=[p for p in exact if p not in state.get('residual_repaired_public_paths',[])]
        if not exact:
            if defect.get('field_path') in ('research_period', 'period', 'metadata', 'dates') or defect.get('temporal_basis') or defect.get('severity') == 'warning':
                continue
            remaining.append(defect);continue
        if defect.get('conflict_resolution')=='omit_nonessential_descriptor' and defect.get('matter_id'):
            term=norm(defect.get('conflicting_artifact_term')).casefold()
            if term:exact=list(dict.fromkeys(exact+[path for path in candidates if isinstance(allowed[path],str) and term in norm(allowed[path]).casefold()]))
        for path in exact:
            evidence=source_for(path)
            if public_privacy and defect.get('matter_id'):
                matter=next((m for m in source_package.get('matters',[]) if m['id']==defect['matter_id']),None)
                if matter is not None:
                    evidence={'matter':matter,'privacy_only':True,'instruction':'Generalize this matter’s identifying combination only; preserve every other claim verbatim.'}
            if path in targets:
                targets[path]['problem']+=' '+defect.get('message','Repair the rejected generated claim.')
            else:
                targets[path]={'current_value':allowed[path],'problem':defect.get('message','Repair the rejected generated claim.'),'source_evidence':evidence}
            # Bind a correction postcondition to this exact generated field.
            # An omission may be fixed by addition, so its existing quote is not
            # forbidden. Source questions and unbound claims are never deleted.
            if (defect.get('owner')=='rankpilot' and defect.get('code') in ('UNSUPPORTED_CLAIM','EDITORIAL_STYLE')
                    and quote and isinstance(allowed[path],str) and quote in norm(allowed[path])):
                quotes=targets[path].setdefault('rejected_quotes',[])
                quotes[:]=[existing for existing in quotes if norm(existing) not in quote]
                if not any(quote in norm(existing) for existing in quotes):quotes.append(defect['artifact_quote'])
    if not remaining:
        return repair_development({**state,'repair_feedback':defects},proposal,targets)
    all_feedback=defects;defects=remaining
    location=create_model('AllowedRepairLocation',__base__=RepairLocation,path=(Literal[tuple(allowed)],...))
    schema=create_model('BoundedRepairPlan',__base__=RepairPlan,locations=(list[location],...),unresolved=(list[str],...))
    plan,trace=invoke_role(state,'repair',schema,
        'Locate the smallest set of generated fields that must change to resolve each supplied defect. Do not rewrite anything. Map each location to its zero-based defect_index. Source facts and validated selection are immutable. Do not use an Audit-only defect to rewrite the Submission. For a missing outcome, locate its one matter narrative; include a candidate only if their attributed case is also affected. A missing acceptance check alone is not evidence that every field is defective. Report unlocatable defects in unresolved. Never select unaffected fields for general improvement.',
        {'defects':defects,'generated_fields':allowed,'package':source_package,'strategy':state['strategy']})
    covered=set()
    for item in plan.get('locations',[]):
        path=item.get('path');index=item.get('defect_index')
        if path not in allowed or not isinstance(index,int) or not 0<=index<len(defects) or not item.get('reason'):
            return {'development':proposal,'development_validated':False,'errors':['Invalid bounded repair location.'],'trace':trace}
        covered.add(index)
        targets[path]={'current_value':allowed[path],'problem':item['reason'],'source_evidence':source_for(path)}
    if plan.get('unresolved') or len(covered)!=len(defects) or not targets:
        return {'development':proposal,'development_validated':False,'errors':['RankPilot debe localizar la corrección editorial sin regenerar contenido no afectado.'],'trace':trace,'development_repair_unlocatable':True}
    return repair_development({**state,'trace':trace,'repair_feedback':all_feedback},proposal,targets)


def coherent_repair_targets(proposal,targets):
    """A biography and its evidence links change together, within one candidate.

    Source units stay immutable. This permits removing a rejected marketing
    claim while retaining the same unit's material career credential.
    """
    targets=copy.deepcopy(targets)
    norm=lambda value:' '.join(str(value or '').split()).casefold()
    for path,target in list(targets.items()):
        if not re.fullmatch(r'candidates/\d+/submission_bio',path):continue
        parent='/'.join(path.split('/')[:2]);candidate=proposal['candidates'][int(path.split('/')[1])]
        if parent in targets:continue
        spans=[c.get('public_quote','') for c in candidate.get('profile_coverage',[]) if c.get('decision') in ('retain','generalize')]
        spans.extend(c.get('public_quote','') for c in candidate.get('submission_case_coverage',[]))
        if not any(norm(q) and norm(span) and (norm(q) in norm(span) or norm(span) in norm(q))
                   for q in target.get('rejected_quotes',[]) for span in spans):continue
        targets[parent]={**target,'current_value':candidate,
            'mutable_fields':['submission_bio','profile_coverage','submission_case_coverage'],
            'rejected_quote_path':path,
            'problem':target.get('problem','')+' Update only the bio and its exact output bindings. Remove the rejected assertion while preserving the original material credential, source units, personal source bindings, ranking decision and all other candidacy fields. Generalize a material unit to its supported role without its rejected promotional clause; never erase the career role.'}
        targets[parent]['preserve_profile_quotes']=[span for span in spans if span and not any(
            norm(q) and (norm(q) in norm(span) or norm(span) in norm(q)) for q in target.get('rejected_quotes',[]))]
        del targets[path]
    if proposal.get('execution_contract')==EXECUTION_CONTRACT and any(p in targets for p in ('b10','c2')):
        targets.setdefault('institutional_execution',{'current_value':proposal.get('institutional_execution',[]),
            'binding_only':True,'problem':'Refresh only exact B10/C2 output quotations after their targeted correction, retaining every argument index. Unaffected quotations may stay unchanged.',
            'source_evidence':{'case_plan':proposal.get('case_plan'),'b10':proposal.get('b10'),'c2':proposal.get('c2')}})
    return targets


def repair_letter(state):
    """Patch rejected Audit fields; condense globally only for a length violation."""
    from core.review_graph import invoke_role, Letter, NextAction, reconcile_next_actions, audit_word_count, AUDIT_WORD_LIMIT, condense_audit_letter
    fields=('executive_assessment','portfolio','leadership','evidence_gaps','next_actions')
    source_questions=[d for d in state.get('repair_feedback',[]) if d.get('owner')=='user']
    feedback=[d for d in state.get('repair_feedback',[]) if d.get('owner')!='user' and d.get('scope')=='letter']
    submission_context=[d for d in state.get('repair_feedback',[]) if d.get('owner')!='user' and d.get('scope')!='letter']
    located=[d.get('field_path') for d in feedback]
    if located and all(key in fields for key in located):
        fields=tuple(dict.fromkeys(located))
    classification_only=bool(feedback) and all(d.get('code')=='SELECTION_MISMATCH' and d.get('scope')=='letter' for d in feedback)
    source_package=state['package']
    development=state.get('development')
    # A matter-only correction does not require repurchasing every other source.
    # The full original dossier still goes to the independent final reviewer.
    concrete=[d for d in submission_context if d.get('severity')=='critical'
              and not str(d.get('message','')).startswith('La aceptación editorial no está completa:')
              and d.get('code')!='TEMPORAL_FINDING_UNRESOLVED']
    changed_ids={d.get('matter_id') for d in concrete}
    scoped_delta=bool(concrete) and None not in changed_ids and not feedback and not source_questions
    if scoped_delta:
        source_package={**source_package,'matters':[m for m in source_package.get('matters',[]) if m['id'] in changed_ids]}
        development={'matters':[m for m in (development or {}).get('matters',[]) if m['matter_id'] in changed_ids]}
    if classification_only:
        source_package={'matters':[{k:m.get(k) for k in ('id','client','name')} for m in state['package'].get('matters',[])]}
    variants=tuple(create_model('AuditCorrection_'+field,path=(Literal[field],...),value=(list[NextAction] if field=='next_actions' else str,...),reason=(str,...)) for field in fields)
    change=Union[variants] if len(variants)>1 else variants[0]
    schema=create_model('AuditDelta',corrections=(list[change],...),unresolved=(list[str],...))
    result,trace=invoke_role(state,'writer',schema,
        'Repair the existing executive Audit after the supplied defects or targeted Submission correction. Return ONLY fields requiring change; all others are preserved exactly. For preserve_source_aliases on an internal reserve label, explicitly retain BOTH original name variants in the comparison; do not choose a canonical identity or ask the user to correct spelling. Reconcile the letter with CURRENT development and original sources. Remove warnings about generated defects already corrected. submission_review_context describes a separate Submission review: reconcile the Audit with CURRENT development, but never try to edit Submission fields or report those separate defects as unresolved Audit tasks. source_questions are context, NOT editing tasks: retain genuine unanswered factual questions without inventing answers and never put them in unresolved merely because the user has not answered. unresolved is only for a requested GENERATED correction that cannot be applied. A source-backed institutional B10 figure is not contradicted merely because another matter has the same number for a different population. Never claim a rendered document is approved or blocked: report strategic recommendations and genuine evidence gaps. Do not repeat system diagnostics or ask users to fix generated wording. Preserve portfolio, hero, candidates, supported comparisons and confirmed answers. Keep the whole five-section letter within 1800 words. next_steps is generated from next_actions; change next_actions only for genuine changed recommendations, preserving useful unanswered actions. If a generated field cannot be corrected faithfully, report unresolved. This patch must still pass the independent exact-Word review.',
        {'previous_letter':state['letter'],'defects':feedback,'source_questions':source_questions,'submission_review_context':submission_context,'package':source_package,'strategy':state['strategy'],'development':None if classification_only else development,
         'scope_instruction':'Only reconcile mentions of the supplied changed matters. Preserve unrelated text and recommendations; the full independent source review still follows.' if scoped_delta else None})
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
    requires_change=any(d.get('scope')=='letter' and d.get('severity')=='critical' for d in feedback)
    if result.get('unresolved') or (requires_change and not seen):errors.append('RankPilot debe completar la corrección del Audit; no se acepta una reparación sin cambios.')
    if audit_word_count(fixed)>AUDIT_WORD_LIMIT:errors.append('El Audit excede la extensión ejecutiva acordada.')
    return {'letter':fixed,'writer_validated':not errors,'errors':errors,'trace':trace,
            'repair_feedback':conflicts or state.get('repair_feedback',[]),
            'letter_repair_requested':bool(errors),'writer_attempts':state.get('writer_attempts',0)+1,
            'letter_repair_report':{'corrected_fields':sorted(seen | set(condensed_fields)),
                                    'condensation_requested':needs_condensation,'condensed_fields':condensed_fields,
                                    'unresolved':result.get('unresolved',[])}}

TASK += " The shared case_plan is internal, source-bound and common to both documents. Preserve its decisions through prose repairs. Reserve disposition does not erase a personally attributed mandate. Never demote a candidate merely because a supporting source is reserved. Do not change roster or add a public biography for an additional internal leader. Preserve every validated comparison and explain only genuinely missing evidence."
