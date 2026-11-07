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

DEVELOPMENT_VERSION = 'editorial-development-v4'
from core.candidate_evidence import ProfileCoverage, profile_errors, category_error
from core.editorial_execution import PersonalCaseLink, InstitutionalLink, EXECUTION_CONTRACT, execution_errors
from core.editorial_case import EditorialCase, support_ids as eligible_support_ids, additional_leaders, case_errors, prepare_case

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
    category_missing_criterion: str = Field(default='', description='Exact undecided eligibility or category-choice criterion when suggested_ranking is Category pending; state what specific evidence would resolve it. Empty for an evidenced specific category. Do not use a generic request for more references as a substitute for choosing a category.')
    profile_coverage: list[ProfileCoverage] = Field(default_factory=list)
    submission_case_coverage: list[PersonalCaseLink] = Field(default_factory=list)
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
    audit_required: bool = Field(default=True, description="True for a material borderline tradeoff the client must see; false for a clearly weaker reserve assessed internally. Keep the Audit concise, not a dump of every comparison.")
    selected_id: str
    alternative_id: str
    incremental_contribution: str
    tradeoff: str = Field(description="State concrete source-grounded differences. Never label a reserve menor escala/mayor escala/smaller scale/larger scale; state the actual supplied facts or comparable quantities, with their concepts, instead. Absence of a final result is not evidence of lower scale.")

class Development(BaseModel):
    execution_contract: str = ''
    institutional_execution: list[InstitutionalLink] = Field(default_factory=list)
    case_plan: EditorialCase
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

EXECUTION_INSTRUCTION=''' Return execution_contract linked-editorial-execution-v1. For every biography actually included by the directory (all supplied Chambers profiles, including develop/do_not_present; Legal 500 only the nominated profiles it includes), submission_case_coverage must bind distinct personally attributed supporting mandates to original source_quote and actual submission_bio public_quote (up to two where that evidence exists; one if only one supporting mandate exists). Keep the nomination decision separate from biography quality. The Audit and this BIO must defend the same distinctive personal contributions. For every mandate described in the BIO, retain any supplied achieved result; do not change it into intended prevention or pending status. Supporting only two source links does not excuse incomplete additional work assertions. When an achieved interim/final result is supplied, execute it; an ongoing mandate or intended stability cannot replace an achieved result. Develop their specific legal contribution, issue and evidenced result or actual pending position in natural B9 prose, retaining material career credentials; a specialty list is not the personal argument. Do not invent an outcome to fill a link. Reserved sources remain eligible personal evidence. Keep confidential identities and identifying metrics out of public quotes. Return institutional_execution once per case_plan institutional argument, using its zero-based argument_index and exact b10_quote/c2_quote from their own fields. B10 demonstrates what the practice did and achieved; C2 explains why that evidence warrants the requested coverage, without copying the B10 passage or repeating a service catalogue. These links are internal verification metadata, not new text to publish. A separately confirmed department head must be described as leading the department/practice in B9; merely being Partner or leading an individual mandate is insufficient.'''

EXECUTION_INSTRUCTION += ' Preserve material career roles even when their original sentence also contains a promotional comparison: retain the role through its actual public_quote, keep the complete original source_quote internally, and withdraw unverified national-superiority or reputation claims from public prose. Do not mechanically copy such comparisons merely to preserve a credential. In B10/C2, do not collectively describe a list as partners when it includes leaders whose partner status is unknown; use neutral lawyer/team leadership and preserve actual individual roles.'

EXECUTION_INSTRUCTION += ' For each personal mandate, execute every available achieved result in safe public generalisation; an ongoing status or a goal cannot substitute for an achieved result supplied by the source. Use pending relief only when no result is supplied.'
EXECUTION_INSTRUCTION += ' Every present candidate B9 must execute the highest-priority canonical core mandate personally led by that lawyer, alongside distinct existing personal evidence. Do not omit that primary source merely because other supporting cases have easier prose. Preserve all explicit narrative financial context in confidential E2, distinguishing source project cost, claim/exposure and legal matter value with their original currencies. Never move identifying metrics into public sections.'

TASK = '''Develop the complete editorial case, not a summary of the register. If repair_feedback is supplied, repair the identified defects in previous_development and preserve unaffected source-backed content.
Keep requested_target and objectives distinct from current_band and official observations. Preserve a supplied target as an objective or explicitly justify a recommended change in target_rationale. Preserve useful source-backed career history without treating it as current matter leadership. Use category_rationale to explain each proposed category and any change to the input suggestedRank. Generic labels such as Individual ranking candidate are not a category; use a reasoned specific category or Category pending with the exact gap, without guessing eligibility.
Return one candidate for EACH supplied lawyer and one matter draft for EACH core matter, no reserves.
Use only supplied source evidence. Existing drafts are proposals, not evidence; preserve supported human corrections.
NARRATIVE DEPTH & BREADTH INVARIANT: Develop each matter according to available factual evidence, without a rigid minimum or maximum number of words or paragraphs. Do NOT write artificially compressed or superficial summaries when substantive facts exist. Seamlessly integrate the 5 core editorial dimensions based on verified facts: (1) client commercial objective and operational scale, (2) specific contentious or regulatory legal obstacle, (3) concrete procedural mechanism executed by the firm, (4) direct leadership and contribution of the lawyers, and (5) accredited outcome or current procedural status. Crucially, if an initial description states that a matter is pending or filed, but subsequent updates, otherInfo or status fields document a favorable ruling, injunction (suspensión definitiva), amparo victory, or executed resolution, resolve this progression into one integrated story rather than leaving conflicting disconnected statements. Do not reduce a documented result to an intention or merely list services. Preserve reported/approximate amounts and pending proceedings alongside any completed interim outcomes. Select legal_issue_source_quote from the original matter as the separate legal-issue preservation anchor. For matters where source facts are preliminary or incomplete, develop what is verified without inventing missing facts; record evidentiary gaps in internal fields rather than generating audit commentary in public submission prose.
For each candidate, reason from status/seniority, quality and number of personally attributed matters, personal role, leadership, specialization, external evidence, verified current ranking and proposed category, in that order. Assess individual ranking eligibility strictly within the submission's target practice area. Do not confuse multidisciplinary deal support with practice specialization. A lawyer whose primary specialization is another practice area (such as Tax, Labour, or Dispute Resolution) who assists on matters in the target practice area is NOT eligible for an individual ranking in the target practice area; their recommendation must be 'do_not_present' for individual ranking in this practice area (suggested_ranking: 'Not proposed in this practice area'), with category_rationale explaining that their involvement represents multidisciplinary support rather than core practice specialization. Only dedicated practitioners of the target practice area may be assessed for individual rankings in that practice area. Supporting quotes must be contiguous in the named matter's source fields, including leadPartner/teamMembers. Do not upgrade a team member to leader. A biography cannot substitute for matter-linked evidence. Assess every supplied lawyer; recommend present, develop or do_not_present. If evidence is insufficient, state a precise gap/action in the INTERNAL fields; the public bio must still accurately convey any supported relevant work. A partner cannot be proposed as an associate. Never assert an unverified current ranking. Propose a reasoned candidacy/category when supported; distinguish a target from a prediction. Do not put evidence gaps or internal recommendations in B9. Public B9/B10/C2 must speak as the firm: never say 'submitted evidence', 'this evidence supports', 'without asserting a ranking', 'no verified ranking', 'not a prediction' or describe what the source establishes. Keep those caveats in internal fields. In C2 make a direct, grounded request for coverage.
PRACTICE LEADERSHIP & DEPARTMENT HEADS: Use confirmed department heads in filing_details['heads'] or departmentHeads. Public B9 must state a supported practice leadership role; describe partner status only if the roster or substantive source separately confirms it. Never insert names or titles from an example or another firm.
Write developed, source-grounded English B9 bios. For multiple personally attributed mandates, explain distinct legal contributions without a generic one-line label. In public B9/B10/C2 remove confidential client and counterparty identities and identifying combinations of case-specific amounts, percentages, workforce, proceedings, facilities and geography. Preserve that exact evidence in E. Describe the legal work, difficulty and personal contribution meaningfully in neutral terms. A name omitted from public prose does not anonymize a distinctive quantitative footprint. A bio-only client name needs confirmed publication permission in the canonical register.
Write B10 (maximum 1,000 words, no minimum; allocate depth according to the available distinctive evidence) and C2 in English: articulate the practice's evidenced identity, national footprint, client scale, and strategic differentiation using ONLY the supplied source facts. B10 must NOT be a mere sequential listing of matters.
B10 OPENING: Start with the strongest differentiator actually established by this portfolio. Develop the relevant capabilities proportionately to their evidence, including contentious, transactional, regulatory and preventive work when documented. Never presume a firm is premier counsel, handles hundreds of proceedings, has multi-billion projects or performs cross-border transactions from its practice-area label. Preserve public privacy constraints even when scale is strategically useful; precise private case metrics remain in E.
C2 FIRM ADVOCACY: Make a direct grounded case for coverage, distinct from B10. Organize around evidenced strengths such as scale, complexity, personal leadership and depth. Benchmark peers only when actual supplied external evidence permits that comparison; no mandatory pillar justifies invention. Do not use timid stock petitions, unsupported market standing or internal research-scope disclaimers. Keep qualifications and evidence gaps in the internal Audit.
Use a concise English category or target label in suggested_ranking, and put its qualifications in the internal rationale/action. Other INTERNAL fields in Spanish: executive recommendation, positioning, reasonable target with its limitations, main strength/vulnerability, hero comparison, eight-field individual strategy. In hero_rationale and executive_assessment, state explicit selection criteria and comparative weighting between the Hero candidate and its primary alternative, explaining why the Hero matter is selected while acknowledging the comparative strengths of the runner-up mandate. No unsupported band forecasts or numerical scores.
Compare the weakest selected mandates with the strongest reserves using their incremental evidentiary contribution to this particular candidacy, including support for individuals and missing capabilities. Provide concrete selected/alternative ID pairs, tradeoffs and why the selected contribution wins; do not use a generic 'avoid dilution' explanation. At least one comparison if both core and reserves exist. Do not change the validated selection; clearly flag a decision needing reconsideration instead of silently changing it.
For each matter supply decisive verbatim source quotes as a preservation checklist. Include documented outcomes when present, not just general context. These are source claims, never permission to exaggerate. All IDs and names must exactly match supplied records. No UI status, approval declarations or pipeline terminology in client-facing prose.'''

TASK += " SHARED EDITORIAL CASE: First form case_plan version editorial-case-v1 from original evidence and the validated strategy. Both the Submission and Audit execute this SAME plan. Each institutional proposition must explain a specific evidenced distinction and how B10 demonstrates it and C2 argues for coverage. Return source-bound evidence for each; never a mere service list. Evaluate EVERY additional_leader supplied in source_obligations internally, preserving their exact matter IDs and deciding what actual missing information would change. These internal evaluations do not add public B9 profiles or infer seniority. Cover every reserve once INTERNALLY in comparisons against its closest relevant selected alternative. Mark audit_required only for material borderline decisions that merit the client’s attention (at least one when reserves exist); the other comparisons remain internal. Order the closest decisions first, considering capability redundancy, available outcomes and support for individual candidates, especially at the selection boundary. Do not satisfy this by comparing every reserve only with the hero. If the validated selection needs reconsideration, explain the specific tradeoff without silently altering membership. Candidate support may use personally attributed pertinent CORE OR RESERVE matters: reserve status never erases evidence, but excluded/off-practice work cannot establish individual eligibility. Do not ask for a role, result or contribution already present in those sources. The case_plan is internal and must never expose its source quotations in public prose. No additional model role, quota, ranking prediction or source alteration is authorised by this contract."

# Narrow metadiscourse patterns: legal evidence and audits can be the work itself.
# Never remove these words globally or rewrite a factual claim with a regex.
AUDIT_VOICE = re.compile(
    r"\b(?:"
    r"the (?:submitted )?(?:source|narrative|dossier|record)(?:\s+narrative)?\s+(?:describes|states|records|reports|identifies|characterises|characterizes|distinguishes|separately records|refers|frames|does not|doesn't|gives no|contains no|does not report|does not provide|does not define|does not state|establishes|does not explain)|"
    r"the formal status field|the narrative describes|the narrative therefore records|verified evidentiary record|evidence completeness|"
    r"our analysis indicates|the audit demonstrates|the submitted evidence (?:shows|supports|demonstrates)|"
    r"no verified ranking|without asserting a ranking|"
    r"no (?:completion|approval|result|outcome|final decision) should be inferred|"
    r"(?:the )?(?:ultimate|final) (?:merits )?(?:result|outcome) is not stated|"
    r"without claiming a final decision|"
    r"so the matter should be presented as|"
    r"it does not identify that figure as|"
    r"does not provide a matter value|"
    r"does not define that economic concept|"
    r"no discrete matter value has been specified|"
    r"monetary amounts are not stated|"
    r"these results are interim operational outcomes within a continuing engagement|"
    r"(?:the\s+)?(?:update|source)\s+reports\s+that|"
    r"it\s+further\s+reports|"
    r"the\s+reported\s+(?:\d{4}\s+)?developments|"
    r"with\s+the\s+source\s+recording|"
    r"is\s+identified\s+as\s+lead|"
    r"is\s+named\s+as\s+lead|"
    r"invites\s+researcher\s+dialogue|"
    r"would\s+welcome\s+researcher\s+dialogue|"
    r"warrants\s+recognition|"
    r"respectfully\s+petitions|"
    r"is\s+supplied|"
    r"the\s+supplied\s+(?:status|completion)|"
    r"no\s+final\s+disposition"
    r")\b",
    re.I,
)

def sanitize_completion_status(status):
    return sanitize_narrative_voice(str(status or ''))


def sanitize_narrative_voice(text):
    """Formatting only; source-grounded repairs own editorial wording and meaning."""
    if not isinstance(text, str):
        return ''
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    return '\n'.join(re.sub(r'[ \t\u00a0]+', ' ', line).strip()
                     for line in text.replace('\r\n', '\n').split('\n')).strip()


def submission_voice_paths(proposal):
    from core.editorial_voice import voice_matches
    fields = {'b10': proposal.get('b10', ''), 'c2': proposal.get('c2', '')}
    fields.update({f'matters/{i}/text': item.get('text', '') for i, item in enumerate(proposal.get('matters', []))})
    fields.update({f'matters/{i}/completion_status': item.get('completion_status', '') for i, item in enumerate(proposal.get('matters', []))})
    fields.update({f'candidates/{i}/submission_bio': item.get('submission_bio', '') for i, item in enumerate(proposal.get('candidates', []))})
    surface = re.compile(r"\b(?:the record (?:separately )?(?:lists|identifies)|no (?:final )?(?:portfolio-wide )?outcome is stated|no (?:monetary )?value, completion (?:status|date) or (?:discrete )?final outcome is stated|neither recovery nor compensation is stated|it does not report recovery|the remaining procedural stage is not specified|respectfully petitions|invite the Chambers research team to consult)\b", re.I)
    grammar = re.compile(r"\b(?:A\.C\.|S\.A\.\s+(?:DE|de)\s+C\.V\.)\s+Is\b|[a-z]{4,}\.[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}|[.!?]\s+the team\b")
    return [path for path, value in fields.items() if AUDIT_VOICE.search(str(value or '')) or surface.search(str(value or '')) or grammar.search(str(value or '')) or voice_matches(value)]

TASK += " PUBLIC CONFIDENTIALITY: Calling a client confidential or omitting its name is insufficient. In public B9, B10 and C2, do not reproduce a confidential mandate's identifying footprint through combinations of transaction/acquisition, counterparties, specific facilities or states, workforce totals, exact proceeding counts or case-specific values. Describe the legal work, difficulty and personal contribution in neutral terms. Do not carry a distinctive subset of that footprint from B9 into B10/C2. Preserve the precise facts and all decisive metrics in the confidential E narrative. Department-wide figures expressly supplied as department-wide facts retain their own scope."

TASK += " All Submission fields, including confidential matter narratives and completion_status for D8/E8, must present the firm's source-backed work directly. Never narrate what the source states or omits. Keep uncertainty in the underlying fact (for example, proceedings remain pending), and keep evidence assessments in internal Audit fields. Do not erase genuine legal work involving evidence or audits. A confidential matter VALUE is distinct from confidential identity: keep an otherwise publishable matter public, but never reveal its restricted amount, range or order of magnitude in public prose. Omit that economic detail automatically; do not ask the user to authorize disclosure when the source already restricts it."

TASK += " B9 must state supported credentials and personal contributions directly, never 'the supplied profile/biography/materials'. C2 must request coverage directly, never 'respectfully seeks' or 'the submission identifies'. D8/E8 must convey only the documented procedural status: never describe a status field or an omitted outcome. If the source has no status, use N/A without commentary; never invent ongoing proceedings or a completed result. Historical status followed by an explicit later update is a chronology: incorporate the later documented outcome and retain necessary procedural context, without inventing recent activity."

TASK += " PERSONAL ATTRIBUTION: A literal quotation naming another lead lawyer is not evidence for this candidate. Every supporting matter must name this candidate in that matter's original fields; otherwise omit that support and reassess the candidate without altering the mandate. D5/E5 Lead partner is a template heading for matter responsibility, not proof of partner seniority; preserve personally attributed leadership using a neutral lawyer title when no explicit professional title is established."

TASK += " UNCONFIRMED FINAL OUTCOMES: Distinguish a general legal standard from a ruling in this specific client matter; different subjects, procedural stages or dates alone are not incompatible facts. If the final merits outcome cannot be reconciled, do not choose a victory or defeat or infer the case remains ongoing. Retain separately documented interim relief or procedural work where it supports the selected matter; keep decisive uncontested scale and attribution. Apply that qualification consistently to the matter narrative, completion_status, B9, B10 and C2. Record both source passages and the unresolved final outcome in the INTERNAL Audit. Source uncertainty does not authorize erasing useful work or changing selection; if the selection depends on a disputed final victory, it needs genuine clarification."

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

NARRATIVE_SOURCE_FIELDS=('source_excerpt','rawNotes','summary','notes','description')
SOURCE_FIELDS=NARRATIVE_SOURCE_FIELDS+('leadPartner','teamMembers','value','completionDate','otherInfo')

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
    # Canonicalize generated presentation before binding and validation, never
    # after returning development_validated. Source evidence stays verbatim.
    for field in ('b10','c2'):
        if field in proposal:proposal[field]=sanitize_narrative_voice(proposal[field])
    register={m['id']:m for m in package.get('matters',[])}
    for draft in proposal.get('matters',[]):
        for field in ('text','completion_status'):
            if field in draft:draft[field]=sanitize_narrative_voice(draft[field])
        matter=register.get(draft.get('matter_id'),{})
        draft['decisive_source_quotes']=[bind_quote(q,matter) or literal_quote(q) for q in draft.get('decisive_source_quotes',[])]
        if 'legal_issue_source_quote' in draft:
            draft['legal_issue_source_quote']=bind_quote(draft['legal_issue_source_quote'],matter) or literal_quote(draft['legal_issue_source_quote'])
    for candidate in proposal.get('candidates',[]):
        if 'submission_bio' in candidate:candidate['submission_bio']=sanitize_narrative_voice(candidate['submission_bio'])
        # Binding evidence must not rewrite the biography after its quotations
        # have been generated. Head/partner claims belong to sourced drafting
        # and independent review, not an unconditional text substitution.
        from core.candidate_evidence import bind_public_quote
        for item in candidate.get('profile_coverage',[]):
            if item.get('decision') in ('retain','generalize'):
                item['public_quote']=bind_public_quote(sanitize_narrative_voice(item.get('public_quote','')),candidate.get('submission_bio',''),candidate.get('name',''))
        for item in candidate.get('submission_case_coverage',[]):
            item['source_quote']=bind_quote(item.get('source_quote',''),register.get(item.get('matter_id'),{})) or literal_quote(item.get('source_quote',''))
            item['public_quote']=bind_public_quote(sanitize_narrative_voice(item.get('public_quote','')),candidate.get('submission_bio',''),candidate.get('name',''))
        for support in candidate.get('supporting_matters',[]):
            support['source_quote']=bind_quote(support.get('source_quote'),register.get(support.get('matter_id'),{})) or literal_quote(support.get('source_quote'))
    for link in proposal.get('institutional_execution',[]):
        for field in ('b10_quote','c2_quote'):
            if field in link:link[field]=sanitize_narrative_voice(link[field])
    return proposal

def development_errors(package, strategy, proposal):
    """Identity, coverage and quotation checks independent of model approval."""
    errors=[f'Voz auditora en Submission: {path}' for path in submission_voice_paths(proposal)]
    from core.public_privacy import public_privacy_findings
    errors.extend(f"Combinación de métricas confidenciales en {f['path']}: {f['matter_id']}"
                  for f in public_privacy_findings(package,strategy,proposal))
    register={m['id']:m for m in package.get('matters', [])}
    core={d['matter_id'] for d in strategy.get('matters',[]) if d['disposition']=='core'}
    eligible_support = eligible_support_ids(package, strategy)
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
        category_problem=category_error(candidate) if proposal.get('version')==DEVELOPMENT_VERSION else None
        if category_problem:
            errors.append(category_problem+': '+str(candidate.get('name')))
        if proposal.get('version')==DEVELOPMENT_VERSION:
            errors.extend('Perfil B9: '+str(candidate.get('name'))+': '+e for e in profile_errors(person,candidate))
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
            if item.get('matter_id') not in eligible_support or not found_support:
                errors.append(f"Atribución sin evidencia literal del asunto: {candidate.get('name')}")
            from core.role_evidence import matter_names_person
            if not matter_names_person(candidate.get('name'), matter):
                errors.append(f"Atribución personal sin nombre en fuentes del asunto: {candidate.get('name')}")
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
    if proposal.get('version') in ('editorial-development-v3', DEVELOPMENT_VERSION):
        errors.extend(case_errors(package, strategy, proposal))
    errors.extend(execution_errors(package,proposal,strategy))
    return errors


def development_contract(package, strategy):
    core=tuple(d['matter_id'] for d in strategy['matters'] if d['disposition']=='core')
    reserves=tuple(d['matter_id'] for d in strategy['matters'] if d['disposition']=='reserve')
    names=tuple(l.get('name') or l.get('fullName') for l in package.get('lawyers',[]))
    if not core:raise ValueError('Editorial development requires a selected portfolio')
    support=create_model('RegisteredSupport',__base__=SupportingMatter,matter_id=(Literal[tuple(sorted(eligible_support_ids(package,strategy)))],...))
    personal_link=create_model('RegisteredPersonalCaseLink',__base__=PersonalCaseLink,matter_id=(Literal[tuple(sorted(eligible_support_ids(package,strategy)))],...))
    candidate=create_model('RegisteredCandidate',__base__=Candidate,name=(Literal[names] if names else str,...),supporting_matters=(list[support],...),
        submission_case_coverage=(list[personal_link],Field(default_factory=list)))
    draft=create_model('RegisteredDraft',__base__=MatterDraft,matter_id=(Literal[core],...))
    comparison=create_model('RegisteredComparison',__base__=Comparison,selected_id=(Literal[core],...),alternative_id=(Literal[reserves] if reserves else str,...))
    return create_model('RegisteredDevelopment',__base__=Development,candidates=(list[candidate],...),matters=(list[draft],...),comparisons=(list[comparison],...),
        execution_contract=(Literal[EXECUTION_CONTRACT],EXECUTION_CONTRACT))

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
    if state.get('development_revalidation_only'):
        if not previous or not state.get('development_reusable'):
            return {'errors':['La propuesta guardada ya no corresponde a sus fuentes.'],'development_validated':False,'development_repair_unlocatable':True}
        bound=bind_development(state['package'],previous)
        errors=development_errors(state['package'],state['strategy'],bound)
        if any(isinstance(d,dict) and (d.get('severity')=='critical' or d.get('artifact_quote')) for d in state.get('repair_feedback',[])):
            errors.append('La entrega conserva una revisión semántica pendiente.')
        return {'development':bound,'errors':errors,'development_validated':not errors,
            'development_repair_unlocatable':bool(errors),'trace':list(state.get('trace',[])),
            'development_recheck_report':{'provider_calls':0,'source_and_strategy_reused':True}}
    if previous and state.get('development_reusable'):
        bound=bind_development(state['package'],previous)
        errors=development_errors(state['package'],state['strategy'],bound)
        # A successfully applied delta is persisted even if local validation
        # rejects one residual field. Repair that residual before reusing the
        # old artifact feedback: its other claims may already have changed.
        # The original final verdict remains rejected until fresh Word review.
        if errors and state.get('repair_report',{}).get('corrected_paths'):
            from core.editorial_repair import repair_targets, repair_development, public_privacy_paths, repair_rejected_development
            applied=set(state['repair_report']['corrected_paths'])
            pending=[]
            for defect in state.get('repair_feedback',[]):
                for path in public_privacy_paths(defect,bound):
                    if path not in applied:
                        pending.append({**defect,'field_path':path,'artifact_quote':bound[path]})
            if pending:
                return repair_rejected_development({**state,'residual_repaired_public_paths':list(applied & {'b10','c2'})},bound,pending)
            targets=repair_targets(state['package'],state['strategy'],bound)
            if targets:
                return repair_development(state,bound,targets)
        from core.review_graph import calibrate_verdict
        feedback=[calibrate_verdict({'defects':[d]},state['package'],state['strategy'],
                  draft_context={'letter':state.get('letter',{}),'development':bound})['defects'][0]
                  if isinstance(d,dict) and d.get('code')=='TEMPORAL_FINDING_UNRESOLVED' and d.get('artifact_claim_kind')=='request_for_information'
                  else d for d in state.get('repair_feedback',[])]
        renderer_only=[d for d in feedback if isinstance(d,dict) and renderer_owned_finding(d,state['package'])]
        semantic=[d for d in feedback if isinstance(d,dict) and not renderer_owned_finding(d,state['package'])
            and d.get('owner')=='rankpilot' and d.get('scope')!='letter'
            and (d.get('severity')=='critical' or (d.get('artifact_quote') and (
                (d.get('code')=='UNSUPPORTED_CLAIM' and d.get('source_quote') and d.get('field_path')) or
                (d.get('code')=='EDITORIAL_STYLE' and d.get('field_path')) or
                (d.get('code')=='SOURCE_CONFLICT' and d.get('conflict_resolution')=='omit_nonessential_descriptor' and (d.get('source_field_path') or d.get('field_path'))=='client_sector' and d.get('conflicting_artifact_term') and str(d['conflicting_artifact_term']).casefold() in str(d['artifact_quote']).casefold()))))]
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
    proposal,trace=invoke_role(state,'development',development_contract(state['package'],state['strategy']),TASK+EXECUTION_INSTRUCTION,{'package':state['package'],'strategy':state['strategy'],'previous_development':state.get('development'),'repair_feedback':state.get('repair_feedback',[]),'source_obligations':state.get('case_requirements') or prepare_case(state)['case_requirements']})
    proposal=bind_development(state['package'],proposal)
    proposal['version']=DEVELOPMENT_VERSION
    errors=development_errors(state['package'],state['strategy'],proposal)
    return {'development':proposal,'errors':errors,'trace':trace,'development_validated':not errors}

TASK += " SOURCE PROFILE COVERAGE: source_obligations.profile_requirements lists original profile units separately from mandate evidence. Return one profile_coverage decision for EVERY unit of this candidate, using its reference and full original source_quote. Retain material prior employment, regional responsibility, professional offices, associations and qualifications in B9 alongside personally attributed matters. A current mandate does not replace career credentials. public_quote must occur literally in this candidate submission_bio. generalize only restricted identities, preserving role, scope and historical/current relationship. omit only truly immaterial, duplicated or unsupported content with an internal reason; the independent final reviewer will judge that decision against the source. Never present a former employer or professional association as a client. A named employer or association in a source biography is not, by that fact, an unconfirmed client reference. Respect explicit restrictions and entity restrictions in the actual client register. Apply source_obligations.category_methodology when supplied, keeping proposed categories separate from actual recognition. For suggested_ranking choose a specific source-supported category as an editorial target, not a forecast, or exactly Category pending and set category_missing_criterion to the precise undecided criterion and recommended_action to what would resolve it. Band ranking candidate and other generic placeholders are invalid. Do not invent a band to satisfy this rule. Explain the specific category comparison and any departure from a supplied proposal in category_rationale."

TASK += " PERSONAL EVIDENCE CAPACITY: Read source_obligations.personal_attribution_policy. A literal team listing alone establishes membership, not individual substantive responsibility or achievements. Keep such a category-pending, not-nominated public profile limited to supplied credentials and participation; do not manufacture two personal contributions or force a client answer merely to complete the report. This exception does not dilute substantive personally attributed mandates or an actual proposed nomination. Do not identify a shorter name with a longer lead name without source support. Record optional identity or role follow-up internally."
