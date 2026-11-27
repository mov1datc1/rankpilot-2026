"""Persisted source-to-field review before paying to assemble the Audit/Word.

Uses the final review's obligations, not a second editorial policy. Receipts bind
source, instructions and actual output; an edit invalidates only its own unit.
The final byte-bound document review remains independent and mandatory.
"""
import copy
import json
import hmac
import os
from collections import OrderedDict
from hashlib import sha256
from typing import Literal
from pydantic import ConfigDict, Field, create_model

VERSION = 'source-field-review-v1'
INSTITUTIONAL_CONTEXT = 'complete-institutional-sources-v2'
# Paid repair CALLS in one development review, not per-field attempts: a grouped
# call may correct several fields. Review of every unit completes first, so the
# budget is spent by editorial priority rather than by review order.
MAX_GLOBAL_FIELD_REPAIRS = max(1, int(os.environ.get('RANKPILOT_MAX_FIELD_REPAIRS', '5')))
REPAIR_GROUP_SIZE = 4
TASK = '''Review only these source-bound editorial units before document assembly.
For EACH obligation judge whether the actual output executes its supplied rule
against the complete original sources. A matching quote is not semantic proof.
Check legal mechanism, result/status, attribution, credentials and decisive scale
where required. Confidential E narratives retain private source evidence; public
BIO/B10/C2 must generalise restricted identities and identifying metrics. Team
membership is not leadership or personal achievement. Missing source information
does not require invented detail or padding: an accurate limited profile is valid.
Mark failed only for a concrete material violation of this obligation; optional
wording preferences are met, not blocking defects. Identify an allowed output
passage and original source passage, and explain the exact omission or error and
what the authorised field must preserve. For a failed check set failure_kind:
omission means supported material is missing; unsupported_claim means existing
prose asserts a wrong or unsupported fact, role, outcome or disclosure;
style means a concrete violation of the supplied field's writing contract.
For met checks use null. Optional wording preferences remain met. source_ref
own_passage means the obligation's single supplied source passage. A false
attribution is unsupported_claim, not an omission merely because the correct
actor is absent: the false assertion must be withdrawn, not preserved verbatim.
Institutional B10/C2 contain several
arguments: each obligation's source_ids identify the evidence it must execute,
not an exhaustive list of evidence for the whole section. Check additional
claims against that field's contextual_source_ids before alleging absence of
support, and against institutional_context for confirmed department heads,
original team profiles, objectives and original department/coverage narratives.
Confirmed filing heads establish departmental leadership independently of a
matter's lead-partner heading; neither by itself establishes partner seniority.
Do not remove a valid contribution merely because a different argument
supplies its evidence. Context from another mandate cannot establish a result
or personal role in the mandate being checked. Keep each check reason concise
(one or two sentences, at most 350 characters) without repeating full passages.
B10 has a 500-word maximum and presents the practice; an omission in B10 is material
only when a shared argument, a confirmed head or a role the original b10_source
gives a lawyer is missing. A secondary detail of one mandate belongs in that
matter's narrative or in C2 and never justifies lengthening B10.
Do not rewrite text, change sources,
nominate anyone, or certify the complete Submission/Audit. Every check is required.'''


def digest(value):
    return sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def method_count(attempts,path):
    # A whole-candidate repair includes its BIO/category. A later descendant
    # address cannot buy a fresh allowance; unrelated sibling fields stay apart.
    return max([int(count) for key,count in attempts.items()
        if key==path or path.startswith(key+'/') or key.startswith(path+'/')]+[0])


def receipt_matches(unit,receipt,require_signature=False):
    if receipt.get('version')!=VERSION or receipt.get('hash')!=unit['hash'] or receipt.get('field')!=unit['field']:
        return False
    wanted={o['id'] for o in unit['obligations']};checks=receipt.get('checks',[])
    if len(checks)!=len(wanted) or {c.get('obligation_id') for c in checks}!=wanted or any(c.get('status')!='met' for c in checks):return False
    secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if require_signature or secret:
        if not secret or not isinstance(receipt.get('signature'),str):return False
        unsigned={k:v for k,v in receipt.items() if k!='signature'}
        expected=hmac.new(secret.encode(),json.dumps(unsigned,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode(),sha256).hexdigest()
        if not hmac.compare_digest(expected,receipt['signature']):return False
    return True


def units_for(state):
    from core.editorial_case import obligations, execution_source_catalog, execution_output
    from core.editorial_development import SOURCE_FIELDS
    source_fields=set(SOURCE_FIELDS) | {'id','name','fullName','title','client','clientDescription','source_label',
        'bio','comments','key_focus','standout_work','standoutWork','credentials','professional_roles',
        'role','isPartner','is_partner','roleResolution','confirmed_department_head',
        'currentRank','current_ranking','isRanked','is_ranked','otherFirms','crossBorder',
        'valueResolution','valueConflict','confidential','isConfidential','confidentialityStatus',
        'confidentialityConfirmed','confidentialityEvidence','publish_status','publishStatus',
        'publication_route','resolved_publication_status'}
    package,strategy,proposal=state['package'],state['strategy'],state['development']
    sources=execution_source_catalog(package,strategy,proposal)
    groups=OrderedDict()
    for obligation in obligations(package,strategy,proposal):
        # Cross-document argument consistency needs the finished Audit. It stays
        # in the independent final review, not a fictitious early approval.
        if obligation['output_scope']=='audit' or obligation['id'].endswith('b9_audit_consistency'):
            continue
        path=obligation['field']
        text,_=execution_output(package,proposal,{},path)
        if not text.strip():
            raise ValueError('Field review cannot certify an absent output: '+path)
        unit=groups.setdefault(path,{'field':path,'output':text,'obligations':[], 'sources':{}})
        refs={}
        for source in obligation['sources']:
            original={k:v for k,v in source.items() if k in source_fields}
            key=digest(original);unit['sources'][key]=original;refs[key]=True
        unit['obligations'].append({'id':obligation['id'],'instruction':obligation['instruction'],
            'source_ids':list(refs),'source_passages':sources[obligation['id']]})
    result=[]
    from utils.review_policy import EDITORIAL_RULES
    for unit in groups.values():
        if unit['field'] in ('b10','c2'):
            from core.review_graph import role_payload
            # Reuse the source view supplied to development/repair. In
            # particular, a practice-level claim is not limited to mandates.
            institution=role_payload({'package':package},'development')['package']
            unit['institutional_context']={k:v for k,v in institution.items() if k!='matters'}
            core={m['matter_id'] for m in strategy.get('matters',[]) if m.get('disposition')=='core'}
            context=[]
            for matter in package.get('matters',[]):
                if matter.get('id') not in core:continue
                original={k:v for k,v in matter.items() if k in source_fields}
                key=digest(original);unit['sources'][key]=original;context.append(key)
            unit['contextual_source_ids']=context
            unit['context_version']=INSTITUTIONAL_CONTEXT
        unit['output_passages']={'P_'+digest(q)[:16]:q for q in
            dict.fromkeys(' '.join(line.split()) for line in unit['output'].splitlines() if line.strip())}
        unit['hash']=digest({'version':VERSION,'policy':EDITORIAL_RULES,**unit})
        result.append(unit)
    return result


def batches(units):
    # Review a person's BIO/category together, and B10/C2 together. Their own
    # original evidence is sent once; unrelated records retain distinct rules.
    families=OrderedDict()
    for unit in units:
        path=unit['field'];family='/'.join(path.split('/')[:2]) if path.startswith('candidates/') else 'institution' if path in ('b10','c2') else path
        families.setdefault(family,[]).append(unit)
    result=[];batch=[]
    for family in families.values():
        combined=batch+family
        size=len(json.dumps(review_payload(combined),ensure_ascii=False).encode())
        checks=sum(len(u['obligations']) for u in combined)
        if batch and (len(combined)>6 or size>120000 or checks>24):
            result.append([u['field'] for u in batch]);batch=[]
        batch.extend(family)
    if batch:result.append([u['field'] for u in batch])
    return result


OWN_PASSAGE = 'own_passage'


def contract(units):
    """Required proof per obligation; identical proof shapes are declared once.

    Every obligation of a field cites the same output passages, and an
    obligation about ONE decisive passage has nothing to choose: its citation is
    fixed by the application (own_passage). Sharing those types keeps each
    binding while the provider schema stops repeating a full proof definition
    and catalog for every obligation. Field guidance lives once in TASK.
    """
    from core.editorial_case import OutputQuote
    fields={};choices={};proofs={}
    def choice(prefix,keys):
        keys=tuple(keys);name=prefix+digest(list(keys))[:16]
        if name not in choices:choices[name]=OutputQuote(name,{f'R{i}':key for i,key in enumerate(keys)})
        return choices[name]
    for unit in units:
        output=choice('OutputPassage_',unit['output_passages'])
        for item in unit['obligations']:
            source=choice('SourcePassage_',[OWN_PASSAGE] if len(item['source_passages'])==1 else item['source_passages'])
            key=(output.__name__,source.__name__)
            if key not in proofs:
                proofs[key]=create_model('FieldProof_'+digest(list(key))[:12],__config__=ConfigDict(extra='forbid'),
                    status=(Literal['met','failed'],...),
                    failure_kind=(Literal['omission','unsupported_claim','style'] | None,None),
                    artifact_ref=(output,...),source_ref=(source,...),
                    reason=(str,Field(min_length=1,max_length=500)))
            fields[item['id']]=(proofs[key],...)
    checks=create_model('FieldChecks',__config__=ConfigDict(extra='forbid'),**fields)
    return create_model('SourceFieldVerdict',__config__=ConfigDict(extra='forbid'),checks=(checks,...))


def _without_contained_narratives(record):
    """Drop rawNotes/summary whose every paragraph occurs, in order and word for
    word, inside the same record's source_excerpt (form cells carry a label on
    the same line, e.g. "Matter's Context: ..."). Nothing is lost: the complete
    text stays in source_excerpt. A changed word or reordered account survives."""
    import re
    if not isinstance(record,dict) or not isinstance(record.get('source_excerpt'),str):
        return record
    excerpt=' '.join(record['source_excerpt'].split())
    result=dict(record)
    for key in ('rawNotes','summary'):
        narrative=result.get(key)
        if not isinstance(narrative,str) or not narrative.strip():continue
        cursor=0
        for paragraph in [' '.join(p.split()) for p in re.split(r'\n\s*\n',narrative) if p.strip()]:
            found=excerpt.find(paragraph,cursor)
            if found<0:break
            cursor=found+len(paragraph)
        else:
            del result[key]
    for duplicate,canonical in (('lead_partner','leadPartner'),('team_members','teamMembers')):
        if duplicate in result and result.get(duplicate)==result.get(canonical):del result[duplicate]
    return result


def review_payload(units):
    """One copy per original record/passage, irrespective of obligation count."""
    records={};passages={};items=[]
    for unit in units:
        records.update(unit['sources']);checks=[]
        for obligation in unit['obligations']:
            passages.update(obligation['source_passages'])
            # The schema binds each proof to this obligation's own passages;
            # repeating every allowed ID here only re-sends the catalog.
            checks.append({k:v for k,v in obligation.items() if k!='source_passages'})
        items.append({'field':unit['field'],'output_passages':unit['output_passages'],'obligations':checks,
            **({'contextual_source_ids':unit['contextual_source_ids'],
                'institutional_context_ref':'institutional_context'} if 'contextual_source_ids' in unit else {})})
    # v1.0.106: the register carries the same matter narrative three times
    # (source_excerpt, rawNotes, summary): 49% of the records sent to this
    # reviewer on DeForest. Remove literal copies only, as the final judge
    # already does; proofs still bind to the complete original records.
    from core.review_graph import compact_review_payload
    # v1.0.107: each rule repeated across this call's obligations is sent once.
    from core.shared_rules import share_repeated_rules, USAGE
    flat,rules=share_repeated_rules([check for item in items for check in item['obligations']])
    position=0
    for item in items:
        item['obligations']=flat[position:position+len(item['obligations'])];position+=len(item['obligations'])
    result={'units':items,'original_sources':{key:_without_contained_narratives(value) for key,value in compact_review_payload(records).items()},'original_passages':passages,
            **({'shared_rules':rules,'shared_rules_usage':USAGE} if rules else {})}
    contexts=[u['institutional_context'] for u in units if 'institutional_context' in u]
    if contexts:
        if any(c!=contexts[0] for c in contexts):raise ValueError('Institutional source views differ')
        result['institutional_context']=contexts[0]
    return result


def project_checks(units,result):
    parsed=contract(units).model_validate(result).model_dump(mode='json')
    receipts=[];defects=[]
    for unit in units:
        checks=[]
        for item in unit['obligations']:
            check=parsed['checks'][item['id']]
            if check['status']=='met' and check.get('failure_kind') is not None:
                raise ValueError('A met check cannot carry a failure kind')
            # A single-passage obligation's citation is application-owned.
            cited=next(iter(item['source_passages'])) if check['source_ref']==OWN_PASSAGE else check['source_ref']
            proof={'obligation_id':item['id'],'status':check['status'],
                'source_quote':item['source_passages'][cited],
                'artifact_quote':unit['output_passages'][check['artifact_ref']],'reason':check['reason']}
            checks.append(proof)
            if check['status']=='failed':
                # Legacy receipts without the new type retain their former
                # omission semantics; never infer a destructive edit from prose.
                code={'unsupported_claim':'UNSUPPORTED_CLAIM','style':'EDITORIAL_STYLE'}.get(check.get('failure_kind'),'EDITORIAL_OMISSION')
                defects.append({'code':code,'severity':'critical','owner':'rankpilot','scope':'submission',
                    'field_path':unit['field'],'matter_id':None,'source_quote':proof['source_quote'],
                    'artifact_quote':proof['artifact_quote'],'message':proof['reason'],'obligation_id':item['id']})
        if all(c['status']=='met' for c in checks):
            receipt={'version':VERSION,'field':unit['field'],'hash':unit['hash'],'checks':checks}
            secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
            if secret:receipt['signature']=hmac.new(secret.encode(),json.dumps(receipt,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode(),sha256).hexdigest()
            receipts.append(receipt)
    return receipts,defects


def scoped_final_review():
    return os.environ.get('RANKPILOT_SCOPED_FINAL_REVIEW','on').strip().casefold() not in ('off','0','false')


TRANSPORT_KEYS=('rendered_artifact','rendered_audit','rendered_candidate_bios','_verified_field_obligations',
                '_scoped_final_review','field_review_receipts','judge_receipts','_judge_receipts_reused')


def rendered_exactly(rendered,text):
    """The complete reviewed prose, not a fragment, is present in the exact file."""
    import re
    clean=' '.join(re.sub(r'\*\*([^*]+)\*\*',r'\1',str(text or '')).split())
    return len(clean)>=80 and ' '.join(str(rendered or '').split()).count(clean)==1


def verified_obligations(package,strategy,proposal):
    """Reuse signed proofs only where the actual exported text is identifiable.

    BIO uses the actual Word-table extraction. Internal category/comparison
    fields bind to the exact retained proposal. Matter narratives, B10 and C2
    are reused when the complete reviewed prose occurs exactly once in the
    exact Submission; section placement and identity leaks remain a task of
    the final review of both files. Audit units carry their own line-bound proof.
    """
    from core.editorial_case import execution_output
    import re
    secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if not secret or not package.get('rendered_artifact') or not package.get('field_review_receipts') or proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):
        return []
    original={k:v for k,v in package.items() if k not in TRANSPORT_KEYS}
    units={u['field']:u for u in units_for({'package':original,'strategy':strategy,'development':proposal})}
    valid=[]
    for signed in package.get('field_review_receipts',[]):
        path=signed.get('field','');unit=units.get(path)
        if not unit or not receipt_matches(unit,signed,require_signature=True):continue
        if path.startswith(('candidates/','comparisons/')):
            if path.endswith('/submission_bio'):
                actual,_=execution_output(package,proposal,{},path)
                if ' '.join(actual.split())!=' '.join(unit['output'].split()):continue
        elif scoped_final_review() and (path in ('b10','c2') or re.fullmatch(r'matters/\d+/text',path)):
            if not rendered_exactly(package['rendered_artifact'],unit['output']):continue
        else:continue
        valid.extend(o['id'] for o in unit['obligations'])
    if scoped_final_review():
        from core.audit_construction import verified_obligations as verified_audit
        valid.extend(verified_audit(package))
    return sorted(set(valid))


MATTER_FACTS=('id','name','title','client','clientDescription','value','valueResolution','valueConflict','leadPartner',
    'lead_partner','teamMembers','team_members','completionDate','isConfidential','confidential','publish_status',
    'publishStatus','confidentialityStatus','confidentialityConfirmed','publication_route','resolved_publication_status',
    'crossBorder','otherFirms','source_label')


def scoped_final_package(package,strategy,proposal):
    """Second half of the final review: no source narrative for proven records.

    A record keeps its complete source whenever any remaining obligation, the
    client-register comparison or an unproven field still depends on it. Proven
    records keep identity, permissions, value and team facts so the reviewer can
    still catch a restricted identity in a public section of the exact files.
    """
    verified=set(package.get('_verified_field_obligations') or [])
    if not scoped_final_review() or not verified:
        return package,[]
    from core.editorial_case import obligations
    from core.register_review import register_rows
    needed={s.get('id') for o in obligations(package,strategy,proposal) for s in o['sources']
            if isinstance(s,dict) and s.get('id') and not s.get('anchor_only')}
    needed |= set(register_rows(package))
    dispositions={d['matter_id']:d.get('disposition') for d in strategy.get('matters',[])}
    proven=[]
    matters=[]
    for matter in package.get('matters',[]):
        mid=matter.get('id')
        core_proven=dispositions.get(mid)=='core' and f'matter:{mid}:evidence' in verified
        if mid in needed or (dispositions.get(mid)=='core' and not core_proven):
            matters.append(matter);continue
        proven.append(mid)
        matters.append({**{k:matter[k] for k in MATTER_FACTS if k in matter},
            'source_review':'proven_in_signed_field_review' if core_proven else 'not_in_submission_no_open_obligation'})
    scoped={k:v for k,v in package.items() if k!='_verified_field_obligations'}
    scoped['matters']=matters
    scoped['_proven_obligation_count']=len(verified)
    return scoped,proven


def current_failures(failures,units):
    """A finding stays open only while it is bound to the exact reviewed unit."""
    hashes={u['field']:u['hash'] for u in units}
    return [d for d in failures or [] if d.get('unit_hash') and hashes.get(d.get('field_path'))==d['unit_hash']]


def repair_groups(failures):
    """Disjoint owner groups, public prose first. One paid call per group.

    A person's BIO and category share evidence; matter narratives and reserve
    comparisons carry only their own records, so several fit in one call.
    """
    families=OrderedDict()
    for path in dict.fromkeys(d['field_path'] for d in failures):
        if path in ('b10','c2'):key=(0,'institution')
        elif path.startswith('candidates/'):key=(1,'/'.join(path.split('/')[:2]))
        elif path.startswith('matters/'):key=(2,'matters')
        else:key=(3,'internal')
        families.setdefault(key,[]).append(path)
    groups=[]
    for key in sorted(families):
        paths=families[key];size=REPAIR_GROUP_SIZE if key[0]>=2 else len(paths)
        groups += [paths[i:i+size] for i in range(0,len(paths),size)]
    return groups


def observed(units,observations,failures):
    """Close reviewed findings as observations bound to the current text."""
    hashes={u['field']:u['hash'] for u in units}
    fields=sorted({d['field_path'] for d in failures if d['field_path'] in hashes})
    return [o for o in observations if o.get('field') not in fields]+[{'field':field,'hash':hashes[field],
        'defects':[d for d in failures if d['field_path']==field],
        'reason':'bounded_repair_finished_with_observations'} for field in fields]


def schedule(state,result=None):
    """Review every pending unit first; only then spend the bounded repair calls."""
    result=dict(result or {});merged={**state,**result}
    if merged.get('development_observations'):
        from core.editorial_development import development_errors
        current_errors=development_errors(merged['package'],merged['strategy'],merged['development'])
        result['development_observations']=[e for e in merged['development_observations'] if e in current_errors]
        merged.update(result)
    units=units_for(merged)
    receipts=merged.get('field_review_receipts',[])
    observations=[o for o in merged.get('field_review_observations',[]) if any(
        u['field']==o.get('field') and u['hash']==o.get('hash') for u in units)]
    failures=current_failures(merged.get('field_review_failures'),units)
    # v1.0.107: an identical unit already reviewed and failed keeps that verdict
    # (DeForest 19-11: the same 37K-token unit was sent to review four times).
    # Its finding returns to the bounded repair/observation route at no cost.
    known={(v['field'],v['hash']):v['defects'] for v in merged.get('field_review_failed_verdicts',[]) or []}
    listed={d['field_path'] for d in failures}
    for u in units:
        if (u['field'] not in listed and (u['field'],u['hash']) in known and not any(receipt_matches(u,r) for r in receipts)
                and not any(o['field']==u['field'] and o['hash']==u['hash'] for o in observations)):
            failures+=known[(u['field'],u['hash'])];listed.add(u['field'])
    failed={d['field_path'] for d in failures}
    pending=[u for u in units if u['field'] not in failed and not any(receipt_matches(u,r) for r in receipts)
        and not any(o['field']==u['field'] and o['hash']==u['hash'] for o in observations)]
    result.update(field_review_observations=observations,field_review_failures=failures,field_review_active_repair=[])
    waiting={'development_validated':False,'development_delivery_ready':False,'development_repair_unlocatable':False}
    if pending:
        return {**result,**waiting,
            'errors':['Redacción guardada; comprobando los campos contra sus fuentes antes de preparar los documentos.'],
            'repair_continuation':{'version':VERSION,'phase':'review','proposal_hash':digest(merged['development']),
                'pending_groups':batches(pending)}}
    if failures:
        attempts=merged.get('field_review_attempts',{})
        budget=max(0,MAX_GLOBAL_FIELD_REPAIRS-int(merged.get('field_review_repair_calls') or 0))
        groups=repair_groups([d for d in failures if method_count(attempts,d['field_path'])<2])[:budget]
        owned={path for group in groups for path in group}
        closed=[d for d in failures if d['field_path'] not in owned]
        if closed:
            observations=observed(units,observations,closed)
            failures=[d for d in failures if d['field_path'] in owned]
            result.update(field_review_observations=observations,field_review_failures=failures)
        if groups:
            return {**result,**waiting,
                'errors':['Hallazgos localizados; RankPilot corregirá esos campos antes de preparar los documentos.'],
                'repair_continuation':{'version':VERSION,'phase':'repair','proposal_hash':digest(merged['development']),
                    'pending_groups':groups}}
    return {**result,'repair_continuation':None,'development_validated':not observations and not merged.get('development_observations'),'development_delivery_ready':True,'errors':[],
        'field_review_failures':[],
        # History is retained separately. Only findings bound to CURRENT
        # output remain tasks; resolved verdicts must not become new Audit
        # warnings. Parent feedback still reconciles the companion document.
        'repair_feedback':merged.get('field_review_parent_feedback',[]) +
            [d for observation in observations for d in observation.get('defects',[])]}


def after_repair(state,result):
    """A residual continuation belongs to the same field recovery method."""
    paths=set(state.get('field_review_active_repair') or []) or {d['field_path'] for d in state.get('field_review_failures',[])}
    attempts=state.get('field_review_attempts',{})
    calls=int(state.get('field_review_repair_calls') or 0)
    result={**result,'field_review_attempts':attempts,'field_review_repair_calls':calls,
            'field_review_active_repair':sorted(paths),'repair_strategy':state.get('repair_strategy','targeted_correction')}
    if result.get('development_validated'):
        return schedule(state,result)
    if result.get('repair_continuation'):
        return result
    # A global validation flag may remain false solely because a different
    # field carries an exhausted internal-binding observation. It cannot decide
    # whether this repair worked. Review changed output before buying another
    # method or attaching the old verdict to the repaired text's new hash.
    if repaired_output_needs_review(state,result,paths):
        return schedule(state,result)
    if (paths and not unknown_usage(result.get('trace',[])) and calls<MAX_GLOBAL_FIELD_REPAIRS
            and all(method_count(attempts,path)<2 for path in paths)):
        return {**result,'development_repair_unlocatable':False,
            'repair_continuation':{'version':VERSION,'phase':'repair',
                'proposal_hash':digest(result.get('development',state['development'])),
                'pending_groups':[sorted(paths)]}}
    return retain_observations(state,{**result,'repair_continuation':None,'development_repair_unlocatable':True},only=paths)


def repaired_output_needs_review(state,result,paths):
    from core.development_delivery import complete_proposal_findings
    from core.editorial_repair import repair_value_at
    merged={**state,**result}
    if unknown_usage(merged.get('trace',[])) or not paths:return False
    try:
        changed=any(repair_value_at(state['development'],p)!=repair_value_at(merged['development'],p)
                    for p in paths)
        if not changed:return False
        local=complete_proposal_findings(merged)
        # New local faults still need the normal bounded repair. Existing
        # observations neither grant approval nor invalidate unrelated work.
        return local is not None and all(e in merged.get('development_observations',[]) for e in local)
    except (KeyError,IndexError,TypeError,ValueError):
        return False


def unknown_usage(trace):
    from core.editorial_repair import unknown_repair_usage
    return unknown_repair_usage(trace)


def recheck_context(state):
    """Reconsider an old incomplete-source diagnosis, never replenish repairs."""
    from core.editorial_development import development_errors
    failures=state.get('field_review_failures',[])
    eligible=(state.get('field_review_context_version')!=INSTITUTIONAL_CONTEXT
        and state.get('development_reusable') and not unknown_usage(state.get('trace',[]))
        and failures and all(d.get('field_path') in ('b10','c2')
            and str(d.get('obligation_id','')).startswith('argument:') for d in failures))
    errors=development_errors(state['package'],state['strategy'],state['development'])
    if not eligible or errors:
        return {'development_validated':False,'development_repair_unlocatable':True,
            'field_context_recheck':False,'repair_continuation':None,
            'errors':errors or ['La comprobación del contexto no es aplicable a este intento.']}
    # The earlier diagnosis remains in history. A new source-bound verdict must
    # actually pass; even a corrected context cannot buy a third repair method.
    return schedule(state,{'field_context_recheck':False,'repair_continuation':None,'field_review_failures':[]})


def advance(state):
    from core.editorial_repair import unknown_repair_usage, repair_rejected_development
    pending=state.get('repair_continuation') or {}
    if pending.get('proposal_hash')!=digest(state['development']) or unknown_repair_usage(state.get('trace',[])):
        return {'development_validated':False,'development_repair_unlocatable':True,'repair_continuation':None,
            'errors':['La revisión por campos perdió vigencia o conserva una operación sin resultado confirmado.']}
    if pending.get('phase')=='repair':
        # One owner group per paid call. Other groups keep their own findings.
        group=list((pending.get('pending_groups') or [[]])[0])
        defects=[d for d in state.get('field_review_failures',[]) if d['field_path'] in group]
        paths={d['field_path'] for d in defects};attempts=dict(state.get('field_review_attempts',{}))
        calls=int(state.get('field_review_repair_calls') or 0)
        if not paths:
            return schedule(state,{'repair_continuation':None})
        if calls>=MAX_GLOBAL_FIELD_REPAIRS or any(method_count(attempts,path)>=2 for path in paths):
            return retain_observations(state,{'development_validated':False,'development_repair_unlocatable':True,'repair_continuation':None,
                'errors':['La recuperación localizada alcanzó el límite de rondas; se conserva el avance y las observaciones pendientes.']},only=paths)
        strategy='source_reconstruction' if any(method_count(attempts,path) for path in paths) else 'targeted_correction'
        previous_counts={path:method_count(attempts,path) for path in paths}
        for path in paths:attempts[path]=previous_counts[path]+1
        current={**state,'repair_continuation':None,'repair_strategy':strategy,'repair_feedback':defects,
                 'field_review_attempts':attempts,'field_review_repair_calls':calls+1,
                 'field_review_active_repair':sorted(paths)}
        result=repair_rejected_development(current,state['development'],defects)
        return after_repair(current,result)
    from core.review_graph import invoke_role
    available={u['field']:u for u in units_for(state)}
    groups=[g for g in (pending.get('pending_groups') or [[]])]
    paths=groups[0] if groups else []
    if not paths or len(paths)!=len(set(paths)) or any(p not in available for p in paths):
        raise ValueError('Invalid persisted field review group')
    # Independent groups are reviewed together (each one is its own proof).
    isolated=state.get('field_review_isolated') or []
    if digest(paths) in isolated:
        # This group already failed inside a parallel batch: review it alone,
        # so a failure surfaces with its normal bounded recovery, never a loop.
        selected=[paths]
    else:
        selected=[paths]+[g for g in groups[1:] if g and len(g)==len(set(g)) and all(p in available for p in g)
                          and digest(g) not in isolated][:max(0,review_parallel()-1)]
    outcomes=run_reviews(state,invoke_role,[[available[p] for p in g] for g in selected])
    trace=list(state.get('trace',[]))
    receipts_all=[r for r in state.get('field_review_receipts',[])]
    report=state.get('development_build_report',{})
    failures=list(state.get('field_review_failures',[]))
    verdicts=list(state.get('field_review_failed_verdicts',[]))
    reconciled=list(state.get('field_review_reconciled_feedback',[]))
    institutional=False
    for units,outcome in outcomes:
        group=[u['field'] for u in units]
        if isinstance(outcome,BaseException):
            # Recorded (an unknown outcome is never bought again blindly) and
            # isolated: the group is retried at most once more, on its own.
            if isinstance(getattr(outcome,'trace',None),dict):trace.append(outcome.trace)
            isolated=list(dict.fromkeys(isolated+[digest(group)]))
            continue
        result,entry=outcome
        trace.append(entry)
        receipts,defects=project_checks(units,result)
        receipts_all=[r for r in receipts_all if r.get('field') not in group]+receipts
        if report.get('first_pass_quality'):
            from core.construction_quality import record_first_review
            report=record_first_review(report,units,result)
        institutional=institutional or any(u['field'] in ('b10','c2') for u in units)
        hashes={u['field']:u['hash'] for u in units}
        failures=[d for d in failures if d.get('field_path') not in group]+[{**d,'unit_hash':hashes[d['field_path']]} for d in defects]
        reconciled+=defects
        for field in {d['field_path'] for d in defects}:
            verdicts=[v for v in verdicts if not (v['field']==field and v['hash']==hashes[field])]
            verdicts.append({'field':field,'hash':hashes[field],'defects':[{**d,'unit_hash':hashes[field]} for d in defects if d['field_path']==field]})
    update={'trace':trace,'field_review_receipts':receipts_all,'field_review_failures':failures,
            'field_review_failed_verdicts':verdicts[-200:],
            'field_review_reconciled_feedback':reconciled,'field_review_isolated':isolated}
    if report.get('first_pass_quality'):update['development_build_report']=report
    if institutional:update['field_review_context_version']=INSTITUTIONAL_CONTEXT
    # Keep reviewing the remaining units before any repair: the complete list
    # lets one grouped call correct related fields, and gives a real first-pass
    # measurement instead of one interleaved with corrections.
    return schedule(state,update)


def review_parallel():
    try:return max(1,min(6,int(os.environ.get('RANKPILOT_PARALLEL_REVIEWS','4'))))
    except ValueError:return 1


def reviewed(units):
    """v1.0.109: which fields a review call checked (path, unit hash, digest of what
    the model saw). No content. Lets a repeated review be explained from the trace."""
    return {'reviewed_fields':[{'field':u['field'],'hash':u['hash'][:12],
        'seen':digest({'output':u.get('output'),'obligations':[o.get('id') for o in u['obligations']]})[:12]} for u in units]}


def run_reviews(state,invoke_role,groups):
    """[(units, (result, trace_entry) | exception)] for independent review groups."""
    def call(units):
        try:
            result,trace=invoke_role({**state,'trace':[]},'field_reviewer',contract(units),TASK,review_payload(units))
            entry=trace[-1] if trace else {'role':'field_reviewer','usage':{'unknown_calls':1},'usage_status':'unknown'}
            return result,{**entry,**reviewed(units),**({'parallel_batch':len(groups)} if len(groups)>1 else {})}
        except Exception as error:
            return error
    if len(groups)==1:
        # A single review keeps its original semantics: errors propagate.
        result,trace=invoke_role({**state,'trace':list(state.get('trace',[]))},'field_reviewer',contract(groups[0]),TASK,review_payload(groups[0]))
        return [(groups[0],(result,{**(trace[-1] if trace else {'role':'field_reviewer','usage':{'unknown_calls':1},'usage_status':'unknown'}),**reviewed(groups[0])}))]
    import contextvars
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=len(groups)) as pool:
        futures=[pool.submit(contextvars.copy_context().run,call,units) for units in groups]
        return [(units,future.result()) for units,future in zip(groups,futures)]


def retain_observations(state,result=None,only=None):
    """Finish usable, source-bound prose without pretending a failed check passed.

    Only a structurally valid saved proposal can proceed. Each remaining unit
    is still reviewed; changed text/source invalidates these dispositions too.
    """
    from core.editorial_development import development_errors
    merged={**state,**(result or {})}
    every=merged.get('field_review_failures') or []
    failures=[d for d in every if only is None or d.get('field_path') in only]
    rest=[d for d in every if d not in failures]
    local_errors=development_errors(merged['package'],merged['strategy'],merged['development'])
    if local_errors and all(e in merged.get('development_observations',[]) for e in local_errors):
        from core.development_delivery import complete_proposal_findings
        # Previously exhausted internal bindings remain observations. Check
        # completeness and privacy again after any semantic correction.
        if complete_proposal_findings(merged) is not None:local_errors=[]
    if (unknown_usage(merged.get('trace',[])) or not failures
        or local_errors
        or any(d.get('owner')!='rankpilot' or not d.get('artifact_quote')
            or not d.get('source_quote') or not d.get('field_path') for d in failures)):
        return result or {'development_validated':False,'development_repair_unlocatable':True,
            'repair_continuation':None,'errors':['No se pudo completar la redacción; el avance está guardado.']}
    units={u['field']:u for u in units_for(merged)}
    if any(d['field_path'] not in units for d in failures):return result or {}
    fields={d['field_path'] for d in failures}
    kept=[o for o in merged.get('field_review_observations',[]) if o.get('field') not in fields]
    kept += [{'field':field,'hash':units[field]['hash'],
        'defects':[d for d in failures if d['field_path']==field],
        'reason':'bounded_repair_finished_with_observations'} for field in sorted(fields)]
    return schedule(merged,{**(result or {}),'field_review_observations':kept,
        'development_repair_unlocatable':False,'field_review_failures':rest,
        'repair_continuation':None,'errors':[]})
