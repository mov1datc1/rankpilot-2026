"""Bounded, source-grounded repair of rejected editorial fields.

A repair may touch only validator-identified generated fields. It cannot edit
sources, selection, permissions, user answers, or approval state. Its result is
still a proposal and must pass the original validators and final document judge.
"""
import copy
import re
from typing import Literal, Union, Optional
from pydantic import BaseModel, create_model, ConfigDict, Field
from core.editorial_development import Candidate, Comparison
from core.editorial_case import EditorialCase, support_ids as eligible_support_ids, case_errors, vague_scale_comparison
from core.editorial_execution import EXECUTION_CONTRACT, InstitutionalLink, personal_case_errors, institutional_errors, missing_head_bios, primary_lead_anchor

class Correction(BaseModel):
    path: str
    value: Union[str, Candidate]
    reason: str

class Repair(BaseModel):
    corrections: list[Correction]
    unresolved: list[str]

def biography_delta_contract(target):
    """A BIO repair cannot emit source links, identities or ranking decisions."""
    current=target['current_value'];fields={}
    if 'submission_bio' in target['mutable_fields']:fields['submission_bio']=(str,...)
    if 'profile_coverage' in target['mutable_fields']:
        unit=create_model('ProfileOutputOnly',__config__=ConfigDict(extra='forbid'),
            decision=(Literal['retain','generalize','omit'],...),public_quote=(str,...),reason=(str,...))
        profiles=create_model('ExistingProfileOutputReferences',__config__=ConfigDict(extra='forbid'),
            **{p['reference']:(unit,...) for p in current.get('profile_coverage',[])})
        fields['profile_coverage']=(Optional[profiles],Field(description='Null preserves every existing profile output proof. Otherwise return every existing reference, updating only its output decision/quote/reason. Original source units cannot be emitted or changed.'))
    if 'submission_case_coverage' in target['mutable_fields']:
        cases=create_model('ExistingPersonalOutputReferences',__config__=ConfigDict(extra='forbid'),
            **{f'S{i+1:02d}':(str,Field(description='Actual BIO quote for matter_id '+str(link.get('matter_id'))+'; source is current_value.submission_case_coverage/'+str(i)+'. Keep this exact source association, not sentence order. Never reuse another mandate quotation.')) for i,link in enumerate(current.get('submission_case_coverage',[]))})
        fields['submission_case_coverage']=(Optional[cases],Field(description='Null preserves every existing personal output quote. Otherwise use S01, S02 etc in original binding order. Never substitute another mandate.'))
    if target.get('append_personal_anchor'):
        contribution=create_model('RequiredPrimaryContribution',__config__=ConfigDict(extra='forbid'),
            source_quote=(str,Field(description='One exact contiguous passage from the required primary mandate supporting this person and contribution.')),
            public_quote=(str,Field(description='The new actual BIO passage developing this primary contribution, preserving confidentiality.')),
            personal_role=(str,Field(description='Only the personal role supported by that primary mandate.')))
        fields['primary_contribution']=(contribution,Field(description='Append exactly one contribution for required_primary_lead_matter_id. Existing source links, identities, categories and supporting mandates are read-only.'))
    return create_model('BiographyOutputDelta',__config__=ConfigDict(extra='forbid'),**fields)

def expand_biography_delta(target,value):
    delta=biography_delta_contract(target).model_validate(value).model_dump()
    result=copy.deepcopy(target['current_value'])
    if 'submission_bio' in delta:result['submission_bio']=delta['submission_bio']
    profiles=delta.get('profile_coverage')
    if profiles is not None:
        for unit in result.get('profile_coverage',[]):unit.update(profiles[unit['reference']])
    cases=delta.get('submission_case_coverage')
    if cases is not None:
        for i,unit in enumerate(result.get('submission_case_coverage',[])):unit['public_quote']=cases[f'S{i+1:02d}']
    if target.get('append_personal_anchor'):
        anchor=target['append_personal_anchor'];new=delta['primary_contribution']
        result.setdefault('submission_case_coverage',[]).append({
            'matter_id':anchor,'source_quote':new['source_quote'],'public_quote':new['public_quote']})
        if anchor not in {s.get('matter_id') for s in result.get('supporting_matters',[])}:
            result.setdefault('supporting_matters',[]).append({
                'matter_id':anchor,'source_quote':new['source_quote'],'personal_role':new['personal_role']})
    return result

def repair_result_contract(targets):
    """One exclusive outcome for each authorized field; notes are not tasks."""
    outcomes={}
    for i,(path,target) in enumerate(targets.items()):
        current=target['current_value']
        kind=(str if isinstance(current,str) else bool if isinstance(current,bool) else
              EditorialCase if path=='case_plan' else Candidate if isinstance(current,dict) else
              list[Comparison] if path=='comparisons' else list[InstitutionalLink] if path=='institutional_execution' else None)
        if biography_output_targets_only({path:target}):kind=biography_delta_contract(target)
        if kind is None:raise ValueError('Unsupported repair target shape')
        applied=create_model('AppliedField'+str(i),__config__=ConfigDict(extra='forbid'),
            path=(Literal[path],...),status=(Literal['corrected'],...),value=(kind,...),reason=(str,...))
        blocked=create_model('BlockedField'+str(i),__config__=ConfigDict(extra='forbid'),
            path=(Literal[path],...),status=(Literal['unresolved'],...),reason=(str,...))
        outcomes[f'T{i+1:02d}']=(Union[applied,blocked],...)
    result=create_model('EveryAuthorizedRepairField',__config__=ConfigDict(extra='forbid'),**outcomes)
    return create_model('TargetedEditorialRepairResults',__config__=ConfigDict(extra='forbid'),
        results=(result,...),source_notes=(list[str],...))

def repair_references(targets):
    return {f'T{i+1:02d}':path for i,path in enumerate(targets)}

def project_repair_result(result,targets):
    # Existing saved diagnostics and offline fixtures retain their old shape.
    if 'results' not in result:return result
    refs=repair_references(targets)
    if set(result['results'])!=set(refs):raise ValueError('Every authorized field needs exactly one outcome')
    projected={'corrections':[],'unresolved':[],'source_notes':result.get('source_notes',[])}
    for ref,path in refs.items():
        item=result['results'][ref]
        if item.get('path')!=path or not item.get('reason'):raise ValueError('Repair outcome does not match its authorized field')
        if item['status']=='corrected':
            value=item['value']
            if biography_output_targets_only({path:targets[path]}) and isinstance(value,dict) and 'name' not in value:
                value=expand_biography_delta(targets[path],value)
            projected['corrections'].append({'path':path,'value':value,'reason':item['reason']})
        elif item['status']=='unresolved':projected['unresolved'].append(path+': '+item['reason'])
        else:raise ValueError('Invalid field outcome')
    return projected


def unknown_repair_usage(trace):
    return any(bool((call.get('usage') or {}).get('unknown_calls'))
               or call.get('usage_status') in ('unknown','partial_unknown')
               or unknown_repair_usage(call.get('calls',[])) for call in trace or [])

TASK='''Repair only the rejected generated fields identified in repair_targets. This is a targeted correction, not a new submission or strategy. Use the supplied original sources and preserve all unaffected content. For a quotation, copy a contiguous exact passage from the SAME named matter; do not paraphrase, stitch separate passages, borrow from another matter or create evidence. Select the passage that actually supports the claimed fact/role; never replace it with an unrelated matching quote just to satisfy validation. If no supporting passage exists, leave the correction unresolved. For prose, retain documented outcomes, numbers, attribution, uncertainty and confidentiality. Correct an incompatible ranking category only when that candidate/category field is explicitly mutable, using confirmed seniority; never invent a current rank. A biography-only target cannot establish a category or change an already non-nominated Category pending decision. Shorten B10 only when requested, preserving decisive evidence. Never change sources, confirmed user answers, the portfolio, identities, publication permissions or approval status. Return only allowed paths, with a concise internal reason for each correction. Do not ask the user to repair generated wording. If evidence is genuinely missing or contradictory, report that in unresolved rather than guessing. A subsequent independent source and final-document review will assess every repair.'''
TASK+=''' Only when an entire candidates/N object is an allowed target WITHOUT mutable_fields and its native value schema is Candidate, reassess that candidate's generated attribution against the supplied person and eligible source matters (core or pertinent reserve, never excluded work). If a claimed supporting matter names someone else and does not support this candidate, REMOVE that supporting entry; do not seek or invent a quote for an unsupported role. Revise the same candidate's recommendation, ranking rationale, internal strategy and public bio to match the remaining actual evidence. Preserve the exact candidate name, confirmed seniority and all supported work. If no personally attributed matter remains, use develop or do_not_present and accurately describe the gap. Do not leave an avoidable false generated attribution unresolved merely because no evidence exists for it: withdraw that claim. Genuine source contradictions remain unresolved. For that unrestricted Candidate schema return the complete corrected candidate object, not JSON encoded inside a string. When mutable_fields instead selects BiographyOutputDelta, return only its typed delta; the whole-candidate instructions do not authorize changing identity, category or source bindings.'''
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
TASK += " Return exactly one results outcome for each supplied target_references entry. A field is either corrected with its typed value or unresolved because THAT authorized generated change cannot be applied; never both. Record useful source questions outside the permitted change in source_notes. In particular, missing seniority or personal evidence for an already non-nominated Category pending lawyer does not prevent a factual team-member BIO and is not an unresolved BIO correction. Do not invent those facts. source_notes do not grant approval or replace a genuinely blocked requested correction."
TASK += " preserve_generated_quotes contains source-bound passages actually present in the current BIO. Keep them verbatim, adding or correcting only the affected material and its output bindings. Other public_quote values may be invalid references: synchronize them to the actual corrected BIO rather than treating them as immutable prose. An expanded B9 may use up to 1,000 words when its personally attributed work requires them. Every submission_case_coverage entry must have a matching supporting_matters entry with its own valid attribution; keep all required_personal_matter_ids. For an included but non-nominated team member, preserve factual participation and credentials; remove unsupported individual-result links without deleting that person's supported participation BIO. Do not put nomination decisions or missing-evidence commentary in public prose."
TASK += " personal_binding_obligations locates each BIO defect by S reference and immutable matter_id. Resolve every listed duplicate_with pair using each mandate's own legal issue, action and supported outcome, never by adding its confidential metrics. Follow public_biography_policy even if only an output-reference defect is listed. A rejected candidate delta was NOT committed: current_value remains authoritative; application failures describe the rejected proposal. Do not assume its extra sentences exist. Keep every S reference mapped to its named matter, independent of sentence order."

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
        anchor=primary_lead_anchor(package,strategy,candidate)
        profile_faults=profile_errors(person,candidate)
        from core.personal_quality import personal_quality_errors
        quality_faults=[e for e in personal_quality_errors(package,strategy,proposal) if e.startswith(f'Calidad personal candidates/{i}:')]
        linked_fault=personal_case_errors(package,candidate,strategy) if proposal.get('execution_contract')==EXECUTION_CONTRACT else []
        if proposal.get('version')=='editorial-development-v4' and (profile_faults or category_error(candidate) or linked_fault or quality_faults):
            add(f'candidates/{i}',candidate,'Account for every original profile credential alongside mandate evidence; retain material career/office facts or justify a genuine omission. Develop distinct personally attributed contributions in B9 and bind submission_case_coverage to its own sources and actual bio passages. Specify a concrete category or Category pending with the exact missing criterion and action. Preserve source, identity, permissions and supported attribution.',{**candidate_evidence(candidate,person),'profile_units':profile_units(person)})
            from core.personal_quality import required_personal_matters
            targets[f'candidates/{i}']['validation_errors']=profile_faults+linked_fault+quality_faults
            targets[f'candidates/{i}']['required_personal_matter_ids']=required_personal_matters(package,strategy,candidate)
            if quality_faults:
                targets[f'candidates/{i}']['problem']+=' Complete all missing material personally attributed work in a developed B9 (up to 1,000 words, without padding), preserve existing evidenced contributions and credentials, and return an individually grounded category_assessment. Do not shrink the BIO to two matters. '+ ' '.join(quality_faults)
            elif anchor and anchor not in {link.get('matter_id') for link in candidate.get('submission_case_coverage',[])} and not profile_faults and not category_error(candidate) and not personal_case_errors(package,candidate):
                target=targets[f'candidates/{i}']
                target.update(mutable_fields=['submission_bio','submission_case_coverage'],append_personal_anchor=anchor)
                if anchor not in {s.get('matter_id') for s in candidate.get('supporting_matters',[])}:target['mutable_fields'].append('supporting_matters')
                target['source_evidence'].update(required_primary_lead_matter_id=anchor)
                target['problem']='Add a source-bound contribution, legal issue, action and evidenced result or actual pending position from the required primary lead mandate to B9, using safe public generalisation. Bind one appended submission_case_coverage entry to its own original source and new actual BIO passage. Retain the complete existing BIO block verbatim; place the new primary contribution before it if natural. Preserve every existing personal source link, career credential, category and unrelated candidacy field. Add supporting_matters only if this required source is absent. Do not disclose restricted names or identifying metrics in public prose.'
            elif candidate_output_repair_only(package,strategy,candidate,person,profile_faults,linked_fault):
                target=targets[f'candidates/{i}']
                target['mutable_fields']=['submission_bio','profile_coverage','submission_case_coverage']
                target['problem']='Repair only this BIO and its keyed output quotations. Every original profile unit, personal source binding, supporting mandate, identity, recommendation and category is already valid and read-only. Restore material credentials and legal contributions faithfully where the BIO omits them, and copy actual BIO passages into the corresponding output references. Never substitute an unrelated matching quote to hide missing substance.'
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
            if not comparison.get(field) or vague_scale_comparison(comparison.get(field,'')):add(f'comparisons/{i}/{field}',comparison.get(field,''),'Explain the specific supported legal contribution or supplied comparable quantities. Remove generic relative-scale labels; do not invent measurements or turn a pending risk into an achieved result.',{'selected':register.get(comparison.get('selected_id')),'reserve':register.get(comparison.get('alternative_id'))})
    for path in submission_voice_paths(proposal):
        parts=path.split('/')
        if parts[0]=='matters':
            item=proposal['matters'][int(parts[1])]
            evidence=register.get(item.get('matter_id'),{})
            value=item.get(parts[-1], '')
        elif parts[0]=='candidates':
            item=proposal['candidates'][int(parts[1])]
            evidence={'person':roster.get(_norm(item.get('name')),{}),'matters':[register.get(s.get('matter_id'),{}) for s in item.get('supporting_matters',[])]}
            if '/'.join(parts[:2]) in targets:evidence={}  # Parent already carries these own sources.
            value=item['submission_bio']
        else:
            evidence={'package':package,'strategy':strategy};value=proposal[path]
        add(path,value,'Remove auditor commentary about sources from this Submission field. Present supported work directly; preserve numbers, outcomes, attribution and uncertainty. Do not invent a completed outcome or delete substantive legal evidence/audit work.',evidence)
        from core.editorial_voice import voice_matches
        targets[path]['rejected_quotes']=voice_matches(value)
        if parts[0]=='candidates':
            targets[path]['preserve_profile_quotes']=[c.get('public_quote') for c in item.get('profile_coverage',[])
                if c.get('decision') in ('retain','generalize') and c.get('public_quote')
                and _norm(c['public_quote']) in _norm(item.get('submission_bio',''))]
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
        candidate=proposal['candidates'][i]
        parent=f'candidates/{i}';path=parent if parent in targets else parent+'/submission_bio'
        # Headship is an independent obligation, even when a different fault
        # already owns the whole candidate or this BIO. Never overwrite voice,
        # privacy, source-binding or preservation requirements on that target.
        target=targets.setdefault(path,{'current_value':candidate['submission_bio'],'source_evidence':{}})
        target['problem']=target.get('problem','')+' State this separately confirmed department-head function in natural B9 prose. A partner title or leading a matter alone does not state that function. Preserve existing career credentials and personally attributed work; do not invent partner seniority.'
        target['confirmed_head_function']={'name':candidate['name'],'source_path':'filing_details.heads'}
        target.setdefault('validation_errors',[]).append('Función departamental B9 ausente: '+candidate['name'])
    if proposal.get('execution_contract')==EXECUTION_CONTRACT and institutional_errors(proposal):
        add('institutional_execution',proposal.get('institutional_execution',[]),
            'Bind every shared case argument to its actual distinct B10 and C2 passage. This internal mapping cannot invent text or substitute another field.',{'case_plan':proposal.get('case_plan'),'b10':proposal.get('b10'),'c2':proposal.get('c2')})
        if ' '.join(proposal.get('b10','').split())==' '.join(proposal.get('c2','').split()):
            add('c2',proposal.get('c2',''),'Develop the source-grounded coverage request from the shared arguments instead of copying B10. Preserve the objective, sources and factual limits.',{'package':package,'strategy':strategy})
    if proposal.get('execution_contract')==EXECUTION_CONTRACT:
        from core.contextual_financial_evidence import missing_contextual_amounts
        for i,draft in enumerate(proposal.get('matters',[])):
            matter=register.get(draft.get('matter_id'),{})
            if missing_contextual_amounts(matter,draft.get('text','')):
                path=f'matters/{i}/text';old_problem=targets.get(path,{}).get('problem','')
                add(path,draft.get('text',''),old_problem+' Preserve the explicitly reported financial evidence in this confidential narrative, with each original currency and concept. Distinguish project cost, exposure and legal matter value; never recast one as another. Keep the supported work, result and attribution. This does not authorize any public metric.',matter)
    return targets

def candidate_output_repair_only(package,strategy,candidate,person,profile_faults,personal_faults):
    """Narrow initial repairs too, but never freeze invalid source/category data."""
    from core.candidate_evidence import category_error
    from core.editorial_development import bind_quote
    from core.role_evidence import matter_names_person
    if not person or not (profile_faults or personal_faults) or category_error(candidate):return False
    if any(e!='Credencial retenida ausente del B9 de esta persona.' for e in profile_faults):return False
    if any(e!='La contribución personal debe ejecutarse literalmente en el B9 de esta persona.' for e in personal_faults):return False
    if person.get('isPartner') is True and re.search(r'associate|asociado',candidate.get('suggested_ranking',''),re.I):return False
    if any(not str(candidate.get(f,'')).strip() for f in ('current_ranking','suggested_ranking','category_rationale','why_candidate','external_evidence','evidence_gaps','recommended_action','submission_bio')):return False
    support=candidate.get('supporting_matters',[]);ids=[s.get('matter_id') for s in support]
    if len(ids)!=len(set(ids)) or (candidate.get('recommendation')=='present' and not ids):return False
    register={m['id']:m for m in package.get('matters',[])};eligible=eligible_support_ids(package,strategy)
    return all(s.get('matter_id') in eligible and str(s.get('personal_role','')).strip()
        and matter_names_person(candidate.get('name'),register.get(s.get('matter_id'),{}))
        and bind_quote(s.get('source_quote'),register.get(s.get('matter_id'),{})) for s in support)

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
                anchor=targets[path].get('append_personal_anchor')
                if anchor:
                    old=bindings(before);new=bindings(after)
                    if new[:len(old)]!=old or len(new)!=len(old)+1 or new[-1][0]!=anchor:
                        raise ValueError('Primary-mandate repair must append only its required source binding')
                    if before['submission_bio'] not in after['submission_bio']:
                        raise ValueError('Primary-mandate repair cannot rewrite the existing BIO')
                    if after['supporting_matters']!=before['supporting_matters']:
                        old_support=before['supporting_matters'];new_support=after['supporting_matters']
                        if new_support[:len(old_support)]!=old_support or len(new_support)!=len(old_support)+1 or new_support[-1]['matter_id']!=anchor:
                            raise ValueError('Primary-mandate repair cannot replace supporting evidence')
                elif bindings(after)!=bindings(before):raise ValueError('Biography repair cannot change personally attributed source bindings')
                profile_sources=lambda c:[(item.get('reference'),item.get('source_quote')) for item in c.get('profile_coverage',[])]
                if profile_sources(after)!=profile_sources(before):raise ValueError('Biography repair cannot change original profile source units')
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
        protected=targets[path].get('preserve_generated_quotes',[])
        bio=value.get('submission_bio','') if isinstance(value,dict) else value
        normalize=lambda text:' '.join(str(text or '').split())
        if any(normalize(quote) not in normalize(bio) for quote in protected):
            raise ValueError('Biography repair cannot remove an unaffected evidenced contribution or credential')
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

def apply_valid_corrections(proposal,targets,repair,package=None,strategy=None):
    from core.repair_acceptance import accept_repair_deltas
    return accept_repair_deltas(proposal,targets,repair,apply_corrections,package,strategy)


def biography_output_targets_only(targets):
    allowed={'submission_bio','profile_coverage','submission_case_coverage'}
    return bool(targets) and all(
        bool(re.fullmatch(r'candidates/\d+',path)) and bool(target.get('mutable_fields'))
        and set(target['mutable_fields'])<=(allowed | ({'supporting_matters'} if target.get('append_personal_anchor') else set()))
        for path,target in targets.items())

def repair_development(state, proposal, targets):
    from core.review_graph import invoke_role, role_payload
    from core.editorial_development import bind_development, development_errors
    if unknown_repair_usage(state.get('trace',[])):
        return {'development':proposal,'development_validated':False,
                'errors':['No se inicia otra reparación con consumo del proveedor desconocido.'],
                'trace':state.get('trace',[])}
    targets=coherent_repair_targets(proposal,targets,package=state.get('package'))
    bio_only=biography_output_targets_only(targets)
    ranking_context=None if bio_only else (state.get('ranking_verification') or state.get('package',{}).get('ranking_verification'))
    schema=repair_result_contract(targets)
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
    repair,trace=invoke_role({**state,'source_only_repair':bio_only},'repair',schema,TASK,{'repair_targets':payload_targets,'target_references':repair_references(targets),'shared_source_evidence':shared,'feedback':feedback,'ranking_verification':ranking_context})
    try:
        repair=project_repair_result(repair,targets)
        fixed,application_errors=apply_valid_corrections(proposal,targets,repair,state['package'],state['strategy'])
    except ValueError as error:
        return {'development':proposal,'development_validated':False,'errors':[str(error)],'trace':trace}
    fixed=bind_development(state['package'],fixed)
    def at(document,path):
        value=document
        for part in path.split('/'):value=value[int(part)] if isinstance(value,list) else value[part]
        return value
    norm=lambda value:' '.join(str(value or '').split()).casefold()
    def failures(document):
        from core.public_privacy import public_privacy_findings
        privacy_paths={f['path'] for f in public_privacy_findings(state['package'],state['strategy'],document)}
        residual=repair_targets(state['package'],state['strategy'],document)
        return [path for path,target in targets.items()
                if path in application_errors or path in privacy_paths or (not target.get('binding_only') and at(document,path)==target['current_value']) or any(
                    norm(quote) in norm(at(document,target.get('rejected_quote_path',path))) for quote in target.get('rejected_quotes',[]) if norm(quote))
                or any(p==path or p.startswith(path+'/') for p in residual)]
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
    # Compose every owned BIO residual (voice, privacy or headship), not a
    # whitelist of symptom types. Never broaden the original mutable fields.
    for path,target in local_targets.items():
        if path.startswith('candidates/') and path.endswith('/submission_bio') and owned(path):
            parent='/'.join(path.split('/')[:2]);original=targets.get(parent,{})
            if not original.get('mutable_fields') or 'submission_bio' in original['mutable_fields']:
                voice_residuals[path]=target
    retry_targets={path:copy.deepcopy(payload_targets[path]) for path in failed
                   if (isinstance(targets[path]['current_value'],str) or (isinstance(targets[path]['current_value'],dict)
                       and (targets[path].get('mutable_fields') or re.fullmatch(r'candidates/\d+',path))))
                   and (path in application_errors or targets[path].get('rejected_quotes') or targets[path].get('privacy_matter_ids')
                        or (re.fullmatch(r'candidates/\d+',path) and path in local_targets))}
    for path,target in voice_residuals.items():
        if path in retry_targets:
            retry_targets[path]['problem']=retry_targets[path].get('problem','')+' '+target.get('problem','')
            retry_targets[path]['rejected_quotes']=list(dict.fromkeys(
                retry_targets[path].get('rejected_quotes',[])+target.get('rejected_quotes',[])))
        else:retry_targets[path]=copy.deepcopy(target)
    # A repaired candidate can still have a mismatched output proof. Give only
    # that owned BIO/proof group the same one bounded cleanup, not the portfolio
    # or every original repair target. Never broaden a BIO-only authorization.
    from core.candidate_evidence import profile_errors,category_error
    people={str(p.get('name') or p.get('fullName')):p for p in state['package'].get('lawyers',[])}
    for i,candidate in enumerate(fixed.get('candidates',[])):
        path=f'candidates/{i}'
        profile=profile_errors(people.get(candidate.get('name'),{}),candidate)
        personal=personal_case_errors(state['package'],candidate,state['strategy']) if fixed.get('execution_contract')==EXECUTION_CONTRACT else []
        only_binding=(bool(profile or personal)
            and all(e=='Credencial retenida ausente del B9 de esta persona.' for e in profile)
            and all(e=='La contribución personal debe ejecutarse literalmente en el B9 de esta persona.' for e in personal))
        if not owned(path) or not only_binding or category_error(candidate) or path not in local_targets:continue
        target=copy.deepcopy(local_targets[path]);target['mutable_fields']=['submission_bio','profile_coverage','submission_case_coverage']
        target['problem']=target.get('problem','')+' Synchronize only this BIO and its exact output proofs against its own original profile and personally attributed mandates. Retain every material career role and existing legal contribution, category, source unit and personal source binding. Copy each public_quote from the actual current BIO. If the BIO omits supplied material evidence, restore it faithfully; never pick an unrelated matching passage to excuse an omission. Report only an actually blocked authorized field as unresolved.'
        child=path+'/submission_bio'
        if child in retry_targets:
            prior=retry_targets.pop(child);target['problem']+=' '+prior.get('problem','')
            if prior.get('rejected_quotes'):target.update(rejected_quotes=prior['rejected_quotes'],rejected_quote_path=child)
        # Never broaden the original authorization, even if recomputing the
        # residual would now suggest a whole-candidate change.
        original=targets.get(path)
        if original and original.get('mutable_fields'):
            target['mutable_fields']=[f for f in target['mutable_fields'] if f in original['mutable_fields']]
        retry_targets[path]=target
    # A genuinely unresolved source-dependent field does not prevent an
    # independent known correction. Legacy unlocated failures remain a stop.
    unresolved_before=list(repair.get('unresolved',[]))
    blocked_paths={path for path in targets if any(str(item).startswith(path+': ') for item in unresolved_before)}
    unlocated_unresolved=any(not any(str(item).startswith(path+': ') for path in targets) for item in unresolved_before)
    retry_targets={path:target for path,target in retry_targets.items()
                   if not any(path==blocked or path.startswith(blocked+'/') for blocked in blocked_paths)}
    # Coalesce a parent and its BIO residual before constructing the retry
    # schema. Refresh preservation against the current, independently retained
    # state; stale children must never overwrite a newly repaired candidate.
    retry_targets=coherent_repair_targets(fixed,retry_targets,package=state.get('package'))
    for path,target in retry_targets.items():
        target['current_value']=at(fixed,path)
        if re.fullmatch(r'candidates/\d+',path):
            target['problem']=target.get('problem','')+' The preceding correction failed these postconditions: '+str(application_errors.get(path,'The candidate still fails its own validation.'))
            if path in local_targets:
                for key in ('validation_errors','required_personal_matter_ids'):
                    if key in local_targets[path]:target[key]=local_targets[path][key]
        if path.startswith('candidates/') and path.endswith('/submission_bio'):
            candidate=fixed['candidates'][int(path.split('/')[1])]
            target['preserve_profile_quotes']=[c.get('public_quote') for c in candidate.get('profile_coverage',[])
                if c.get('decision') in ('retain','generalize') and c.get('public_quote')
                and norm(c['public_quote']) in norm(candidate.get('submission_bio',''))]
    retry_count=0
    retry_error=None
    # Retry a known completed but ineffective textual correction once, before
    # buying another full Audit/render/judge cycle. Already corrected fields and
    # unrelated sources are excluded. Unknown provider outcomes never enter here.
    if retry_targets and not unlocated_unresolved:
        known=bool(trace) and not unknown_repair_usage(trace) and all(
            isinstance((call.get('usage') or {}).get('total_tokens'),(int,float))
            and (call.get('usage') or {})['total_tokens']>=0 for call in trace)
        if known:
            retry_count=1
            # Materialize only shared evidence needed by this remaining target.
            uses_shared=any(t.get('source_evidence')=={'reference':'shared_source_evidence'} for t in retry_targets.values())
            retry_schema=repair_result_contract(retry_targets)
            try:
                retry,trace=invoke_role({**state,'trace':trace,'source_only_repair':biography_output_targets_only(retry_targets)},'repair',retry_schema,TASK+' The previous correction left or introduced a localized wording defect. Correct ONLY repair_targets. Every rejected_quotes entry must be corrected. Preserve every supplied preserve_profile_quotes span verbatim; correct the separate affected wording without rewriting those credentials. Put editorial reasons in reason, never in Submission prose. Do not remove supported legal work or substitute a paraphrase of a rejected false assertion.',
                    {'repair_targets':retry_targets,'target_references':repair_references(retry_targets),'shared_source_evidence':shared if uses_shared else None,'feedback':[],
                     'previous_failure':'These authorized fields failed their listed postconditions. Correct the BIO and its own permitted proof or attribution fields together. Preserve supplied preserve_generated_quotes verbatim, add missing required work instead of shrinking the profile, and retain other corrected fields. This is the single bounded residual repair, not another portfolio review.'})
                retry=project_repair_result(retry,retry_targets)
                fixed,retry_application_errors=apply_valid_corrections(fixed,retry_targets,retry,state['package'],state['strategy'])
                application_errors={**{p:e for p,e in application_errors.items() if p not in retry_targets},**retry_application_errors}
                repair={**retry,'unresolved':list(dict.fromkeys(unresolved_before+retry.get('unresolved',[]))),
                        'source_notes':list(dict.fromkeys(repair.get('source_notes',[])+retry.get('source_notes',[])))}
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
                             'unresolved':repair.get('unresolved',[]),'source_notes':repair.get('source_notes',[]),
                             'failed_paths':failed,'surgical_retries':retry_count,
                             'application_errors':application_errors,'retry_paths':list(retry_targets) if retry_count else []}}

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


def coherent_repair_targets(proposal,targets,package=None):
    """A biography and its evidence links change together, within one candidate.

    Source units stay immutable. This permits removing a rejected marketing
    claim while retaining the same unit's material career credential.
    """
    targets=copy.deepcopy(targets)
    norm=lambda value:' '.join(str(value or '').split()).casefold()
    for path,target in list(targets.items()):
        if not re.fullmatch(r'candidates/\d+/submission_bio',path):continue
        parent='/'.join(path.split('/')[:2]);candidate=proposal['candidates'][int(path.split('/')[1])]
        if parent in targets:
            # One candidate is one atomic repair target. A second BIO child
            # must not overwrite the newly repaired parent from an old value.
            merged=targets[parent]
            merged['problem']=merged.get('problem','')+' '+target.get('problem','')
            for key in ('rejected_quotes','privacy_matter_ids','preserve_profile_quotes','validation_errors'):
                if target.get(key):merged[key]=list(dict.fromkeys(merged.get(key,[])+target[key]))
            if target.get('confirmed_head_function'):merged['confirmed_head_function']=target['confirmed_head_function']
            merged['rejected_quote_path']=path
            if target.get('source_evidence'):
                merged['source_evidence']={'candidate_evidence':merged.get('source_evidence'),'biography_correction_evidence':target['source_evidence']}
            del targets[path]
            continue
        spans=[c.get('public_quote','') for c in candidate.get('profile_coverage',[]) if c.get('decision') in ('retain','generalize')]
        spans.extend(c.get('public_quote','') for c in candidate.get('submission_case_coverage',[]))
        if not spans:continue
        targets[parent]={**target,'current_value':candidate,
            'mutable_fields':['submission_bio','profile_coverage','submission_case_coverage'],
            'rejected_quote_path':path,
            'problem':target.get('problem','')+' Update only the bio and its exact output bindings. Remove the rejected assertion while preserving the original material credential, source units, personal source bindings, ranking decision and all other candidacy fields. Generalize a material unit to its supported role without its rejected promotional clause; never erase the career role.'}
        targets[parent]['preserve_profile_quotes']=[span for span in spans if target.get('rejected_quotes') and span and norm(span) in norm(candidate.get('submission_bio','')) and not any(
            norm(q) and (norm(q) in norm(span) or norm(span) in norm(q)) for q in target.get('rejected_quotes',[]))]
        del targets[path]
    if proposal.get('execution_contract')==EXECUTION_CONTRACT and any(p in targets for p in ('b10','c2')):
        targets.setdefault('institutional_execution',{'current_value':proposal.get('institutional_execution',[]),
            'binding_only':True,'problem':'Refresh only exact B10/C2 output quotations after their targeted correction, retaining every argument index. Unaffected quotations may stay unchanged.',
            'source_evidence':{'case_plan':proposal.get('case_plan'),'b10':proposal.get('b10'),'c2':proposal.get('c2')}})
    if proposal.get('personal_quality_contract')=='complete-personal-case-v1':
        for path,target in targets.items():
            if not re.fullmatch(r'candidates/\d+(?:/submission_bio)?',path):continue
            candidate=proposal['candidates'][int(path.split('/')[1])]
            rejected=target.get('rejected_quotes',[])
            from core.editorial_development import bind_quote
            from core.role_evidence import matter_names_person,identity
            source_person=next((p for p in (package or {}).get('lawyers',[]) if identity(p.get('name') or p.get('fullName'))==identity(candidate.get('name'))),{})
            from core.candidate_evidence import profile_units,norm as source_norm
            source_units={source_norm(u['source_quote']) for u in profile_units(source_person)}
            register={m['id']:m for m in (package or {}).get('matters',[])}
            privacy=set(target.get('privacy_matter_ids',[]))
            from core.public_privacy import metric_facts
            affected=[register[mid] for mid in privacy if mid in register]
            def affected_span(span):
                return any((metric_facts(span) & metric_facts(' '.join(str(m.get(k) or '') for k in ('source_excerpt','rawNotes','summary','value'))))
                    or (str(m.get('client') or m.get('clientName') or '').strip() and str(m.get('client') or m.get('clientName')).casefold() in span.casefold()) for m in affected)
            spans=[x.get('public_quote','') for x in candidate.get('profile_coverage',[]) if x.get('decision') in ('retain','generalize')
                and (package is None or source_norm(x.get('source_quote')) in source_units) and not affected_span(x.get('public_quote',''))]
            spans.extend(x.get('public_quote','') for x in candidate.get('submission_case_coverage',[])
                if x.get('matter_id') not in privacy and (package is None or (x.get('matter_id') in register and matter_names_person(candidate.get('name'),register[x['matter_id']]) and bind_quote(x.get('source_quote'),register[x['matter_id']]))))
            # A generated output reference is not evidence that the words were
            # ever written. Protect only real, source-bound BIO spans. Missing
            # contributions remain obligations of the original validators.
            target['preserve_generated_quotes']=list(dict.fromkeys(span for span in spans if span
                and norm(span) in norm(candidate.get('submission_bio','')) and not any(
                norm(q) and (norm(q) in norm(span) or norm(span) in norm(q)) for q in rejected)))
    from core.biography_obligations import enrich_biography_targets
    return enrich_biography_targets(package,proposal,targets)


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
    candidate_indices={int(match.group(1)) for d in concrete
        if (match:=re.match(r'^candidates/(\d+)(?:/|$)',str(d.get('field_path') or '')))}
    personal_delta=bool(concrete) and len(candidate_indices)>0 and all(re.match(r'^candidates/\d+(?:/|$)',str(d.get('field_path') or '')) for d in concrete) and not feedback and not source_questions
    if personal_delta:
        fields=('leadership','executive_assessment','next_actions')
        candidates=[c for i,c in enumerate((development or {}).get('candidates',[])) if i in candidate_indices]
        names={c.get('name') for c in candidates}
        ids={s['matter_id'] for c in candidates for s in c.get('supporting_matters',[])}
        source_package={**source_package,'lawyers':[p for p in source_package.get('lawyers',[]) if (p.get('name') or p.get('fullName')) in names],
            'matters':[m for m in source_package.get('matters',[]) if m['id'] in ids]}
        development={'candidates':candidates,'target':(development or {}).get('target')}
    if classification_only:
        source_package={'matters':[{k:m.get(k) for k in ('id','client','name')} for m in state['package'].get('matters',[])]}
    variants=tuple(create_model('AuditCorrection_'+field,path=(Literal[field],...),value=(list[NextAction] if field=='next_actions' else str,...),reason=(str,...)) for field in fields)
    change=Union[variants] if len(variants)>1 else variants[0]
    schema=create_model('AuditDelta',corrections=(list[change],...),unresolved=(list[str],...))
    result,trace=invoke_role(state,'writer',schema,
        'Repair the existing executive Audit after the supplied defects or targeted Submission correction. Return ONLY fields requiring change; all others are preserved exactly. For preserve_source_aliases on an internal reserve label, explicitly retain BOTH original name variants in the comparison; do not choose a canonical identity or ask the user to correct spelling. Reconcile the letter with CURRENT development and original sources. Remove warnings about generated defects already corrected. submission_review_context describes a separate Submission review: reconcile the Audit with CURRENT development, but never try to edit Submission fields or report those separate defects as unresolved Audit tasks. source_questions are context, NOT editing tasks: retain genuine unanswered factual questions without inventing answers and never put them in unresolved merely because the user has not answered. unresolved is only for a requested GENERATED correction that cannot be applied. A source-backed institutional B10 figure is not contradicted merely because another matter has the same number for a different population. Never claim a rendered document is approved or blocked: report strategic recommendations and genuine evidence gaps. Do not repeat system diagnostics or ask users to fix generated wording. Preserve portfolio, hero, candidates, supported comparisons and confirmed answers. Keep the whole five-section letter within 1800 words. next_steps is generated from next_actions; change next_actions only for genuine changed recommendations, preserving useful unanswered actions. If a generated field cannot be corrected faithfully, report unresolved. This patch must still pass the independent exact-Word review.',
        {'previous_letter':state['letter'],'defects':feedback,'source_questions':source_questions,'submission_review_context':submission_context,'package':source_package,'strategy':state['strategy'],'development':None if classification_only else development,
         'scope_instruction':'Only reconcile these changed personal arguments/categories. Preserve all other individual recommendations and text.' if personal_delta else 'Only reconcile mentions of the supplied changed matters. Preserve unrelated text and recommendations; the full independent source review still follows.' if scoped_delta else None})
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
    from core.portfolio_counts import enumeration_defects
    conflicts=enumeration_defects(state['strategy'],fixed,
        require_numbered=bool(re.search(r'(?m)^\s*\d{1,2}[.)]\s+',str(state['letter'].get('portfolio','')))))+conflicts
    from core.editorial_case import comparison_style_defects
    conflicts=comparison_style_defects(fixed)+conflicts
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

TASK += " For a BiographyOutputDelta return only the permitted BIO and keyed output references. Null preserves the existing reference map. Profile keys are their original P references; personal keys S01, S02 etc refer to original binding order. Existing source quotations, matter IDs, identity, category and supporting mandates are read-only and cannot be returned as replacement lists. Only a required primary_contribution may quote new original evidence for its fixed mandate, as defined by its own typed schema. Keep every original source link even when the new BIO explains another already supplied mandate. Never replace an existing binding to make room for another; edit prose and its actual public quotes only."
TASK += " When primary_contribution is required, supply only that new contribution's literal original source_quote, actual BIO public_quote and source-supported personal_role. The application appends the required mandate without accepting a replacement list or model-selected matter ID. Preserve the complete existing BIO verbatim and add the missing contribution. Existing bindings and supporting evidence remain read-only. This one new source quote is the sole exception to the output-only delta; it must pass the original source and personal-attribution validators."
