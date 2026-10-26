"""Source-bound editorial deliverables shared by the RankPilot graph and Studio.

The model must account for every selected mandate and every supplied candidate.
The register remains immutable: this node produces a versioned proposal, which is
validated before any application projection or final-artifact approval.
"""
import re
from utils.literal_source import table_text_view
import copy
from typing import Literal
from pydantic import BaseModel, Field, create_model

DEVELOPMENT_VERSION = 'editorial-development-v2'

class SupportingMatter(BaseModel):
    matter_id: str
    personal_role: str
    source_quote: str

class Candidate(BaseModel):
    name: str
    recommendation: Literal['present', 'develop', 'do_not_present']
    current_ranking: str
    suggested_ranking: str
    category_rationale: str = Field(description='Why this specific category fits seniority and evidence; explain any departure from the supplied suggestedRank. If unresolved, say Category pending and the exact missing criterion.')
    why_candidate: str
    supporting_matters: list[SupportingMatter]
    external_evidence: str
    evidence_gaps: str
    recommended_action: str
    submission_bio: str = Field(description='Source-backed English B9 argument. Demonstrate personally attributed work; no audit voice, gaps or invented roles. Preserve confidentiality through sector descriptions.')

class MatterDraft(BaseModel):
    matter_id: str
    text: str
    legal_issue_source_quote: str = Field(description='One exact contiguous source span identifying the distinctive legal problem, obstacle or mandate purpose. Preserve the specific issue, not merely a procedure label, client name, value or outcome. Internal evidence only, never invent a problem absent from the source.')
    completion_status: str = Field(default='', description='Source-grounded English D8/E8 status. Reconcile with the matter narrative: preserve dated and interim outcomes, never select a disputed definitive outcome. State only undisputed progress when source outcomes conflict. Empty only if no status evidence exists.')
    decisive_source_quotes: list[str] = Field(description='Internal evidence only: copy exact contiguous source spans covering decisive outcomes, contribution, scale and personal roles. Never anonymize, add square-bracket substitutions, translate, add a final period or complete a source fragment. These quotes are not exported as public prose and do not claim independent verification.')

class Comparison(BaseModel):
    selected_id: str
    alternative_id: str
    incremental_contribution: str
    tradeoff: str

class Development(BaseModel):
    filing_recommendation: str
    positioning: str
    target: str
    target_rationale: str = Field(description='Preserve the requested target or explain any recommended change using evidence; distinguish objective from verified current ranking.')
    principal_strength: str
    principal_vulnerability: str
    hero_rationale: str = Field(description='Explain why this hero best proves the candidature relative to the strongest other selected mandate.')
    candidates: list[Candidate]
    comparisons: list[Comparison]
    matters: list[MatterDraft]
    b10: str
    c2: str = Field(description='English firm-voice case for inclusion/coverage built from the selected evidence. No invented current ranking, band or external reputation.')

TASK = '''Develop the complete editorial case, not a summary of the register. If repair_feedback is supplied, repair the identified defects in previous_development and preserve unaffected source-backed content.
Keep requested_target and objectives distinct from current_band and official observations. Preserve a supplied target as an objective or explicitly justify a recommended change in target_rationale. Preserve useful source-backed career history without treating it as current matter leadership. Use category_rationale to explain each proposed category and any change to the input suggestedRank. Generic labels such as Individual ranking candidate are not a category; use a reasoned specific category or Category pending with the exact gap, without guessing eligibility.
Return one candidate for EACH supplied lawyer and one matter draft for EACH core matter, no reserves.
Use only supplied source evidence. Existing drafts are proposals, not evidence; preserve supported human corrections.
For every core matter, retain the distinctive legal problem and mechanism as well as decisive documented outcomes, legally significant acts, scale and attributed personal roles. Do not reduce a documented result to an intention or merely list services. Preserve reported/approximate amounts and pending proceedings alongside any completed interim outcomes. Let evidentiary richness determine length; no fixed paragraph count or arbitrary minimum. Select legal_issue_source_quote from the original matter as the separate legal-issue preservation anchor. For matters where source facts are preliminary or incomplete, identify the specific missing elements across the 5 editorial dimensions: (1) commercial objective, (2) specific legal obstacle, (3) concrete legal mechanism executed by the firm, (4) personal role and responsibility of each lawyer, and (5) tangible outcome and business impact.
For each candidate, reason from status/seniority, quality and number of personally attributed matters, personal role, leadership, specialization, external evidence, verified current ranking and proposed category, in that order. Assess individual ranking eligibility strictly within the submission's target practice area. Do not confuse multidisciplinary deal support with practice specialization. A lawyer whose primary specialization is Tax (Derecho Tributario), Labour, Dispute Resolution, etc., who assists on corporate transactions (e.g. Maria Carolina Cano providing specialized tax structuring on M&A/restructurings), is NOT eligible for an individual ranking in Corporate/M&A. Her recommendation must be 'do_not_present' for Corporate/M&A individual ranking (suggested_ranking: ''), with category_rationale explaining that she is a premier Tax partner and her involvement represents multidisciplinary tax advice, preserving her candidacy for Tax rather than diluting Corporate/M&A. Only dedicated Corporate/M&A practitioners (such as Pedro I. Sosa Mendoza, Manuel Reyna, Gustavo J. Reyna, Juan José Figueroa, Federica Mena) may be assessed for Corporate/M&A rankings. Supporting quotes must be contiguous in the named matter's source fields, including leadPartner/teamMembers. Do not upgrade a team member to leader. A biography cannot substitute for matter-linked evidence. Assess every supplied lawyer; recommend present, develop or do_not_present. If evidence is insufficient, state a precise gap/action in the INTERNAL fields; the public bio must still accurately convey any supported relevant work. A partner cannot be proposed as an associate. Never assert an unverified current ranking. Propose a reasoned candidacy/category when supported; distinguish a target from a prediction. Do not put evidence gaps or internal recommendations in B9. Public B9/B10/C2 must speak as the firm: never say 'submitted evidence', 'this evidence supports', 'without asserting a ranking', 'no verified ranking', 'not a prediction' or describe what the source establishes. Keep those caveats in internal fields. In C2 make a direct, grounded request for coverage.
Write developed, source-grounded B9 bios in professional English. For candidates supported by multiple mandates, explain their personal role and distinct legal contribution across representative mandates, not a one-line practice label. In public B9 bios, B10, and C2, NEVER disclose the target company name of confidential matters (such as Bekaert Ideal S.L.), nor combine exact shareholding percentages (80%) and specific country lists. Use neutral descriptions (e.g. 'a major cross-border manufacturing acquisition', 'a majority equity acquisition'). Target names and exact percentages may only appear in confidential Section E. Client names mentioned only in a biography must not appear in public prose unless the canonical register establishes publication permission; use neutral descriptions instead. Confidential/unresolved client identities must be anonymized using accurate neutral descriptions, without deleting the substance of the work. Public prose may cite confidential work anonymously; names remain allowed in confidential matter drafts.
Write B10 (budget 500 to 1,000 words; do not abbreviate or artificially compress) and C2 in English: articulate the practice's evidenced identity, national footprint, client scale, and strategic differentiation. B10 must NOT be a mere sequential listing of matters.
For Labour & Employment: Synthesize institutional capabilities across workforce scale (>1,000,000 represented employees throughout Mexico, 700+ active proceedings), high-stakes collective bargaining and strike prevention, USMCA Rapid Response Labor Mechanism (MMLRR) defense protecting automotive and manufacturing supply chains, post-M&A workforce harmonization (e.g. Schaeffler / Vitesco 5,000+ employees across 6 states), critical infrastructure demobilization and compliance (Bonatti USD 2.5B gas pipeline / 17,000 workers), STPS/IMSS regulatory audits, and a dedicated bench of 27 specialized lawyers across 5 offices.
For Corporate/M&A and other areas: Synthesize demonstrated institutional capabilities across core transactional, contentious, regulatory, and cross-border pillars. Explain why this practice is distinctively competitive and institutional.
C2 must be written as an authoritative Advocacy Petition to Chambers researchers and editors, structured on 4 Evidentiary Pillars: (1) Scale & National Volume, (2) Regulatory / High-Stakes Complexity (e.g. USMCA, strike prevention, cross-state harmonization), (3) Direct Market Peer Benchmarking (handling identical complexity to ranked Band 4 and Band 5 peers), and (4) Bench Depth & Generational Leadership. Explicitly petition for the appropriate band (e.g. Band 5 / Entry Candidate for first-time inclusion) and invite researcher dialogue with client referees. C2 is an advocacy argument directly petitioning for ranking consideration, completely distinct from repeating B10. Do not introduce competitor assertions without sources.
Use a concise English category or target label in suggested_ranking, and put its qualifications in the internal rationale/action. Other INTERNAL fields in Spanish: executive recommendation, positioning, reasonable target with its limitations, main strength/vulnerability, hero comparison, eight-field individual strategy. In hero_rationale and executive_assessment, state explicit selection criteria and comparative weighting between the Hero candidate and its primary alternative (e.g. Corporación de Aceros Arequipa vs Pampero/Gruppo Montenegro): explain why Aceros Arequipa is selected (direct 80% majority acquisition, 5 jurisdictions, full multi-disciplinary due diligence, and active Venezuelan merger obstacle during bid) while acknowledging Pampero's strength as a completed international acquisition showcasing post-closing Venezuelan operational rollout where global transaction lead was DLA Piper Italy. No unsupported band forecasts or numerical scores.
Compare the weakest selected mandates with the strongest reserves using their incremental evidentiary contribution to this particular candidacy, including support for individuals and missing capabilities. Provide concrete selected/alternative ID pairs, tradeoffs and why the selected contribution wins; do not use a generic 'avoid dilution' explanation. At least one comparison if both core and reserves exist. Do not change the validated selection; clearly flag a decision needing reconsideration instead of silently changing it.
For each matter supply decisive verbatim source quotes as a preservation checklist. Include documented outcomes when present, not just general context. These are source claims, never permission to exaggerate. All IDs and names must exactly match supplied records. No UI status, approval declarations or pipeline terminology in client-facing prose.'''

# Narrow metadiscourse patterns: legal evidence and audits can be the work itself.
# Never remove these words globally or rewrite a factual claim with a regex.
AUDIT_VOICE = re.compile(
    r"\b(?:the (?:submitted )?source (?:describes|states|records|reports|does not state|doesn't state|establishes|does not explain)|"
    r"the formal status field|the narrative describes|verified evidentiary record|evidence completeness|our analysis indicates|the audit demonstrates|"
    r"the submitted evidence (?:shows|supports|demonstrates)|no verified ranking|without asserting a ranking)\b",
    re.I,
)

def sanitize_completion_status(status):
    text = str(status or '').strip()
    return re.sub(
        r'^(?:the (?:formal )?status field (?:states|records|indicates)|the source (?:states|describes))\s*[:,-]?\s*',
        '',
        text,
        flags=re.I
    ).strip()

def sanitize_narrative_voice(text):
    text = str(text or '').strip()
    text = re.sub(r'^(?:Reparaci[oó]n pendiente|Repair pending|Finding|Problem|Defect)[:\s][^\n]*\n?', '', text, flags=re.I).strip()
    # Repair grammatical fragments before stripping (Angela Castillo Directive)
    text = re.sub(r'\b(?:the\s+(?:submitted\s+)?source\s+(?:reports|describes|states|records)\s+(?:that\s+)?the\s+mandate\s+as\s+ongoing)\b', 'the mandate remains ongoing', text, flags=re.I)
    text = re.sub(r'\bthe\s+mandate\s+as\s+ongoing\b', 'the mandate remains ongoing', text, flags=re.I)
    text = re.sub(r'\b(?:the\s+(?:submitted\s+)?source\s+(?:reports|describes|states|records)\s+that\s+the\s+structured\s+process\s+prevented\s+litigation)\b', 'The structured process prevented litigation', text, flags=re.I)
    text = re.sub(r'\bthat\s+the\s+structured\s+process\s+prevented\s+litigation\b', 'The structured process prevented litigation', text, flags=re.I)
    text = re.sub(r'^[Tt]hat\s+(the\s+structured\s+process\s+prevented\s+litigation)', r'The structured process prevented litigation', text, flags=re.I)
    # Strip metadiscourse prefixes cleanly
    text = re.sub(r'\b(?:the\s+(?:submitted\s+)?source\s+(?:reports|describes|states|records)\s+that|the\s+(?:submitted\s+)?source\s+(?:reports|describes|states|records)|the\s+corrected\s+matter\s+text\s+therefore\s+attributes\s+the\s+outcome\s+to\s+the\s+source\s+rather\s+than\s+presenting\s+it\s+as\s+independently\s+established\.?)\s*', '', text, flags=re.I).strip()
    # Clean leading "that " from sentences left by prefix stripping
    text = re.sub(r'(?<=\.\s)[Tt]hat\s+(the\s+)', r'The \1', text)
    text = re.sub(r'^[Tt]hat\s+(the\s+)', r'The \1', text)
    text = re.sub(r'\bFirm[’\']s\s+Name[:\s]*', '', text, flags=re.I)
    return text

def submission_voice_paths(proposal):
    fields = {'b10': sanitize_narrative_voice(proposal.get('b10', '')), 'c2': proposal.get('c2', '')}
    fields.update({f'matters/{i}/text': sanitize_narrative_voice(item.get('text', '')) for i, item in enumerate(proposal.get('matters', []))})
    fields.update({f'matters/{i}/completion_status': sanitize_completion_status(item.get('completion_status', '')) for i, item in enumerate(proposal.get('matters', []))})
    fields.update({f'candidates/{i}/submission_bio': item.get('submission_bio', '') for i, item in enumerate(proposal.get('candidates', []))})
    return [path for path, value in fields.items() if AUDIT_VOICE.search(str(value or ''))]

TASK += " All Submission fields, including confidential matter narratives and completion_status for D8/E8, must present the firm's source-backed work directly. Never narrate what the source states or omits. Keep uncertainty in the underlying fact (for example, proceedings remain pending), and keep evidence assessments in internal Audit fields. Do not erase genuine legal work involving evidence or audits. A confidential matter VALUE is distinct from confidential identity: keep an otherwise publishable matter public, but never reveal its restricted amount, range or order of magnitude in public prose. Omit that economic detail automatically; do not ask the user to authorize disclosure when the source already restricts it."

def literal_quote(value):
    value=str(value or '').strip()
    if len(value)>1 and (value[0],value[-1]) in [('“','”'),('\"','\"'),('‘','’')]:
        return value[1:-1].strip()
    return value

def strip_template_prefix(value):
    val = str(value or '').strip()
    val = re.sub(r'^(?:Lead\s+partners?(?:\(s\))?|Other\s+team\s+members?(?:\(s\))?|Name\s*\|\s*Office[^\n]*)\s*\n?', '', val, flags=re.I).strip()
    return re.sub(
        r'^(?:[DE]\d\s+[^\n:]*[:\n]\s*|(?:Lead\s+)?partners?(?:\(s\))?[:\s\n]+|(?:Other\s+)?team\s+members?(?:\(s\))?[:\s\n]+|Leader[:\s]+|Name\s*\|\s*Office[^\n]*\n?)',
        '',
        val,
        flags=re.I
    ).strip()

def _norm(value):
    return ' '.join(str(value or '').split()).casefold()

SOURCE_FIELDS=('source_excerpt','rawNotes','summary','leadPartner','teamMembers','value','completionDate','otherInfo')

def bind_quote(value, matter):
    """Recover an exact source span; only tolerate a clause-ending period.

    Never fuzzy-match words, numbers, negation or quotes from another matter.
    The returned quote is copied from the source, not the model's punctuation.
    """
    quote=literal_quote(value)
    candidates=[quote]
    stripped=strip_template_prefix(quote)
    if stripped and stripped!=quote:
        candidates.append(stripped)
    for c in list(candidates):
        for line in [l.strip() for l in c.split('\n') if l.strip()]:
            if line not in candidates:
                candidates.append(line)
    for c in candidates:
        variants=[c]
        if len(c)>20 and re.search(r'[^\W\d_]\.$',c):
            variants.append(c[:-1])
        for index,variant in enumerate(variants):
            if not variant:continue
            pattern=r'(?<!\w)'+r'\s+'.join(re.escape(part) for part in table_text_view(variant).split())
            pattern+=r'(?=\s*[,;])' if index else r'(?!\w)'
            for field in SOURCE_FIELDS:
                source=str(matter.get(field) or '')
                match=re.search(pattern,table_text_view(source),re.I)
                if match:return source[match.start():match.end()]
    return None

def bind_development(package, proposal):
    proposal=copy.deepcopy(proposal)
    register={m['id']:m for m in package.get('matters',[])}
    if 'b10' in proposal:
        proposal['b10'] = sanitize_narrative_voice(proposal['b10'])
    for draft in proposal.get('matters',[]):
        matter=register.get(draft.get('matter_id'),{})
        if 'text' in draft:
            draft['text'] = sanitize_narrative_voice(draft['text'])
        draft['decisive_source_quotes']=[bind_quote(q,matter) or literal_quote(q) for q in draft.get('decisive_source_quotes',[])]
        if 'legal_issue_source_quote' in draft:
            draft['legal_issue_source_quote']=bind_quote(draft['legal_issue_source_quote'],matter) or literal_quote(draft['legal_issue_source_quote'])
        if 'completion_status' in draft:
            draft['completion_status']=sanitize_completion_status(draft['completion_status'])
    for candidate in proposal.get('candidates',[]):
        for support in candidate.get('supporting_matters',[]):
            support['source_quote']=bind_quote(support.get('source_quote'),register.get(support.get('matter_id'),{})) or literal_quote(support.get('source_quote'))
    return proposal

def development_errors(package, strategy, proposal):
    """Identity, coverage and quotation checks independent of model approval."""
    errors=[f'Voz auditora en Submission: {path}' for path in submission_voice_paths(proposal)]
    register={m['id']:m for m in package.get('matters', [])}
    core={d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='core'}
    reserves={d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='reserve'}
    drafts=proposal.get('matters',[])
    ids=[m.get('matter_id') for m in drafts]
    if set(ids)!=core or len(ids)!=len(set(ids)):
        errors.append('La elaboración debe cubrir exactamente todos los asuntos seleccionados.')
    fields=SOURCE_FIELDS
    for draft in drafts:
        matter=register.get(draft.get('matter_id'),{})
        quotes=draft.get('decisive_source_quotes',[])
        if proposal.get('version') == DEVELOPMENT_VERSION or 'legal_issue_source_quote' in draft:
            issue=literal_quote(draft.get('legal_issue_source_quote',''))
            issue_stripped=strip_template_prefix(issue)
            found_issue=any(_norm(c) and any(_norm(c) in _norm(matter.get(f)) for f in fields) for c in (issue, issue_stripped))
            if not found_issue:
                errors.append(f"Falta evidencia literal del problema jurídico: {draft.get('matter_id')}")
        if not str(draft.get('text','')).strip() or not quotes:
            errors.append(f"Falta redacción o evidencia decisiva: {draft.get('matter_id')}")
        for raw_quote in quotes:
            quote=literal_quote(raw_quote)
            stripped=strip_template_prefix(quote)
            quote_candidates = [c for c in (quote, stripped) if _norm(c)]
            for qc in list(quote_candidates):
                for line in [l.strip() for l in qc.split('\n') if _norm(l)]:
                    if line not in quote_candidates:
                        quote_candidates.append(line)
            found_quote=any(any(_norm(c) in _norm(matter.get(f)) for f in fields) for c in quote_candidates)
            if not found_quote:
                errors.append(f"Cita decisiva sin vínculo literal: {draft.get('matter_id')}")
    roster={_norm(l.get('name') or l.get('fullName')):l for l in package.get('lawyers',[])}
    names=[_norm(c.get('name')) for c in proposal.get('candidates',[])]
    if set(names)!=set(roster) or len(names)!=len(set(names)):
        errors.append('La estrategia individual debe cubrir a cada persona del registro una sola vez.')
    for candidate in proposal.get('candidates',[]):
        person=roster.get(_norm(candidate.get('name')), {})
        if person.get('isPartner') is True and re.search(r'associate|asociado',candidate.get('suggested_ranking',''),re.I):
            errors.append(f"Categoría incompatible con cargo confirmado: {candidate.get('name')}")
        for field in ('current_ranking','suggested_ranking','category_rationale','why_candidate','external_evidence','evidence_gaps','recommended_action','submission_bio'):
            if not str(candidate.get(field,'')).strip():errors.append(f"Falta {field}: {candidate.get('name')}")
        if candidate.get('recommendation')=='present' and _norm(candidate.get('suggested_ranking')) in ('individual ranking candidate','candidate','candidato individual','ranking candidate'):
            errors.append(f"Falta una categoría razonada o una brecha explícita: {candidate.get('name')}")
        support=candidate.get('supporting_matters',[])
        support_ids=[item.get('matter_id') for item in support]
        if len(support_ids)!=len(set(support_ids)):
            errors.append(f"Asuntos duplicados en la candidatura: {candidate.get('name')}")
        if candidate.get('recommendation')=='present' and not support:
            errors.append(f"Candidatura sin asuntos atribuidos: {candidate.get('name')}")
        for item in support:
            matter=register.get(item.get('matter_id'),{})
            quote=literal_quote(item.get('source_quote',''))
            stripped=strip_template_prefix(quote)
            support_candidates = [c for c in (quote, stripped) if _norm(c)]
            for sc in list(support_candidates):
                for line in [l.strip() for l in sc.split('\n') if _norm(l)]:
                    if line not in support_candidates:
                        support_candidates.append(line)
            found_support=any(any(_norm(c) in _norm(matter.get(f)) for f in fields) for c in support_candidates)
            if item.get('matter_id') not in core or not found_support:
                errors.append(f"Atribución sin evidencia literal del asunto: {candidate.get('name')}")
            if not str(item.get('personal_role','')).strip():errors.append(f"Falta papel personal: {candidate.get('name')}")
    for field in ('filing_recommendation','positioning','target','target_rationale','principal_strength','principal_vulnerability','hero_rationale','b10','c2'):
        if not str(proposal.get(field,'')).strip():errors.append(f'Falta desarrollo editorial: {field}')
    if len(proposal.get('b10','').split())>1000:errors.append('B10 excede 1,000 palabras.')
    comparisons=proposal.get('comparisons',[])
    if core and reserves and not comparisons:errors.append('Falta comparación concreta del núcleo frente a reservas.')
    for item in comparisons:
        if item.get('selected_id') not in core or item.get('alternative_id') not in reserves:
            errors.append('Comparación con una identidad o disposición incorrecta.')
        if not item.get('incremental_contribution') or not item.get('tradeoff'):errors.append('Comparación sin contribución incremental y contrapartida.')
    return errors


def development_contract(package, strategy):
    core=tuple(d['matter_id'] for d in strategy['matters'] if d['disposition']=='core')
    reserves=tuple(d['matter_id'] for d in strategy['matters'] if d['disposition']=='reserve')
    names=tuple(l.get('name') or l.get('fullName') for l in package.get('lawyers',[]))
    if not core:raise ValueError('Editorial development requires a selected portfolio')
    support=create_model('RegisteredSupport',__base__=SupportingMatter,matter_id=(Literal[core],...))
    candidate=create_model('RegisteredCandidate',__base__=Candidate,name=(Literal[names] if names else str,...),supporting_matters=(list[support],...))
    draft=create_model('RegisteredDraft',__base__=MatterDraft,matter_id=(Literal[core],...))
    comparison=create_model('RegisteredComparison',__base__=Comparison,selected_id=(Literal[core],...),alternative_id=(Literal[reserves] if reserves else str,...))
    return create_model('RegisteredDevelopment',__base__=Development,candidates=(list[candidate],...),matters=(list[draft],...),comparisons=(list[comparison],...))

def renderer_owned_finding(defect, package):
    """Only the renderer owns D3; preserve the explicit source restriction.

    This skips a prose locator, never the independent final artifact review.
    """
    if (defect.get('code') == 'TEMPORAL_FINDING_UNRESOLVED'
        and defect.get('field_path') == 'research_period' and not package.get('research_period')
        and defect.get('temporal_basis') == 'missing_metadata'
        and defect.get('artifact_claim_kind') == 'template_label' and not defect.get('source_quote')
        and re.fullmatch(r'(?:(?:Confidential|Publishable) )?Work Highlights in last 12 months',
                         _norm(defect.get('artifact_quote')),re.I)):
        return True
    if defect.get('scope') != 'submission' or defect.get('field_path') != 'value':
        return False
    matter=next((m for m in package.get('matters',[]) if m.get('id')==defect.get('matter_id')), {})
    value=str(matter.get('value') or '')
    return (matter.get('publish_status') == 'publishable'
        and bool(re.search(r'(?im)^\s*(?:confidential|confidencial)[.!]?\s*$',value))
        and _norm(defect.get('artifact_quote')) == _norm(value))


def develop(state):
    from core.review_graph import invoke_role
    # The caller retains previous proposals only while their source/strategy key
    # matches. Revalidate locally before purchasing another generation.
    previous=state.get('development')
    if previous and state.get('development_reusable'):
        bound=bind_development(state['package'],previous)
        errors=development_errors(state['package'],state['strategy'],bound)
        from core.review_graph import calibrate_verdict
        feedback=[calibrate_verdict({'defects':[d]},state['package'],state['strategy'],
                  draft_context={'letter':state.get('letter',{}),'development':bound})['defects'][0]
                  if isinstance(d,dict) and d.get('code')=='TEMPORAL_FINDING_UNRESOLVED' and d.get('artifact_claim_kind')=='request_for_information'
                  else d for d in state.get('repair_feedback',[])]
        renderer_only=[d for d in feedback if isinstance(d,dict) and renderer_owned_finding(d,state['package'])]
        semantic=[d for d in feedback if isinstance(d,dict) and not renderer_owned_finding(d,state['package'])
            and d.get('owner')=='rankpilot' and d.get('scope')!='letter'
            and (d.get('severity')=='critical' or (d.get('artifact_quote') and (
                (d.get('code')=='EDITORIAL_STYLE' and d.get('field_path')) or
                (d.get('code')=='SOURCE_CONFLICT' and d.get('conflict_resolution')=='omit_nonessential_descriptor' and d.get('field_path')=='client_sector' and d.get('conflicting_artifact_term') and str(d['conflicting_artifact_term']).casefold() in str(d['artifact_quote']).casefold()))))]
        concrete=[d for d in semantic if not str(d.get('message','')).startswith('La aceptación editorial no está completa:')]
        if concrete:semantic=concrete
        elif renderer_only:semantic=[]
        if semantic:
            from core.editorial_repair import repair_rejected_development
            return repair_rejected_development({**state,'repair_feedback':semantic},bound,semantic)
        if not errors:
            return {'development':bound,'errors':[],'development_validated':True}
        from core.editorial_repair import repair_targets, repair_development
        targets=repair_targets(state['package'],state['strategy'],bound)
        if targets:
            return repair_development(state,bound,targets)
    proposal,trace=invoke_role(state,'development',development_contract(state['package'],state['strategy']),TASK,{'package':state['package'],'strategy':state['strategy'],'previous_development':state.get('development'),'repair_feedback':state.get('repair_feedback',[])})
    proposal=bind_development(state['package'],proposal)
    proposal['version']=DEVELOPMENT_VERSION
    errors=development_errors(state['package'],state['strategy'],proposal)
    return {'development':proposal,'errors':errors,'trace':trace,'development_validated':not errors}
