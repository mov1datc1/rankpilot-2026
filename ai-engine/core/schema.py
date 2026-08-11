from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal

class Matter(BaseModel):
    """Represents a specific legal case or 'matter' from the submission."""
    title: str = Field(description="The formal name of the legal matter or case.")
    client: str = Field(description="The name of the client involved.")
    summary: str = Field(description="A brief description of the work performed.")
    significance: str = Field(description="Why this matter is strategically important.")
    lead_partner: str = Field(description="The primary partner in charge of this matter.")
    is_cross_border: bool = Field(description="True if the matter involves multiple jurisdictions.")
    cross_border_jurisdictions: Optional[str] = Field(default="", description="If cross-border, list the jurisdictions involved (e.g. 'USA, Mexico, Chile').")
    team_members: Optional[str] = Field(default="", description="Other team members who worked on this matter.")
    other_firms: Optional[str] = Field(default="", description="Other law firms advising on the matter and their roles.")
    matter_value: Optional[str] = Field(default="", description="The monetary value of the deal/matter with currency (e.g. 'USD 250 million').")
    completion_date: Optional[str] = Field(default="", description="Date of completion or current status of the matter.")
    is_confidential: bool = Field(default=False, description="True if this matter contains confidential information not for publication.")
    is_new_client: bool = Field(default=False, description="True if the client is new within the last 12 months.")
    # v10.0: Explicit publish status — DETERMINISTIC and IMMUTABLE
    publish_status: Literal["publishable", "non_publishable", "confidential"] = Field(
        default="publishable",
        description="IMMUTABLE publish status extracted from source document. 'non_publishable' = matter appears in non-publishable/confidential section. 'confidential' = explicitly marked confidential. 'publishable' = safe for publication. The AI CANNOT change this after extraction."
    )

class LawyerProfile(BaseModel):
    """Profile of a ranked or unranked lawyer in the practice area."""
    name: str = Field(description="Full name of the lawyer.")
    url: Optional[str] = Field(default="", description="URL to the lawyer's biography page.")
    current_ranking: Optional[str] = Field(default="Not Ranked", description="Current Chambers ranking (e.g. 'Band 3', 'Not Ranked').")
    suggested_ranking: Optional[str] = Field(default="", description="Suggested ranking for this submission cycle.")
    key_focus: Optional[str] = Field(default="", description="Key areas of focus for this lawyer.")
    bio: Optional[str] = Field(default="", description="Brief biographical paragraph about the lawyer's practice.")
    standout_work: Optional[str] = Field(default="", description="Description of standout recent work. Prefix confidential parts with [CONFIDENTIAL].")
    is_partner: bool = Field(default=False, description="True if the lawyer is a partner.")
    is_ranked: bool = Field(default=False, description="True if the lawyer is currently ranked.")

class ContactPerson(BaseModel):
    """A contact person for interview arrangements."""
    name: str = Field(description="Full name of the contact.")
    email: Optional[str] = Field(default="", description="Email address.")
    phone: Optional[str] = Field(default="", description="Phone number with country code.")

class HireDeparture(BaseModel):
    """A hire or departure record for the department."""
    name: str = Field(description="Name of the person who joined or departed.")
    status: str = Field(default="", description="'Joined' or 'Departed'.")
    firm: Optional[str] = Field(default="", description="Name of the firm they joined from or departed to.")

class DepartmentInfo(BaseModel):
    """Department-level information for the submission."""
    department_name: Optional[str] = Field(default="", description="Department name as used by the firm.")
    num_partners: Optional[int] = Field(default=0, description="Number of partners in the department.")
    num_lawyers: Optional[int] = Field(default=0, description="Number of other qualified lawyers.")
    department_heads: List[ContactPerson] = Field(default_factory=list, description="Department heads or key partners.")
    hires_departures: List[HireDeparture] = Field(default_factory=list, description="Partner hires and departures in last 12 months.")
    department_description: Optional[str] = Field(default="", description="What the department is best known for (B7 section).")

class FirmMetadata(BaseModel):
    """Core details about the law firm and the submission."""
    firm_name: str = Field(description="The name of the law firm.")
    practice_area: str = Field(description="The practice area being submitted for (e.g. Banking & Finance).")
    location: str = Field(description="The jurisdiction or location of the firm.")
    narrative_overview: str = Field(description="A brief summary of the firm's narrative or intro.")

class SubmissionSchema(BaseModel):
    """The full structured representation of a law firm's practice submission."""
    metadata: FirmMetadata = Field(description="Core details about the law firm.")
    department: DepartmentInfo = Field(default_factory=DepartmentInfo, description="Department-level information.")
    lawyers: List[LawyerProfile] = Field(default_factory=list, description="Lawyer profiles for B6 section.")
    contacts: List[ContactPerson] = Field(default_factory=list, description="Contact persons for A4 section.")
    matters: List[Matter] = Field(description="List of distinct legal matters found in the text.")

class ContextEngineOutput(BaseModel):
    practice_type: str = Field(description="One of: transactional, disputes, regulatory, mixed.")
    archetype: str = Field(description="The strategic archetype of the firm (e.g. Lender-driven finance, Elite arbitration boutique).")
    complexity_profile: str = Field(description="Summary of complexity patterns (cross-border, multi-jurisdiction, etc.).")
    client_type: str = Field(description="Summary of institutional vs one-off client relationships.")
    identity_adn: str = Field(description="Capa 8 Synthesis combining archetype, complexity, client, and work type.")


# =====================================================
# EDITORIAL REASONING ENGINE — Structured Output Schemas
# Based on Volume 0 (First Principles) and Volume II 
# (Editorial Reasoning Engine, Chapters 1-9)
# =====================================================

class ComprehensionOutput(BaseModel):
    """Chapter 1: Answers 9 fundamental questions before any analysis begins.
    The system must not proceed if these questions cannot be answered with 
    reasonable confidence."""
    firm_thesis: str = Field(description="What the firm appears to be trying to demonstrate with this submission.")
    practice_evaluated: str = Field(description="The specific practice area being evaluated.")
    editorial_applicable: str = Field(description="Which editorial/directory applies (Chambers, Legal 500, IFLR, Leaders League).")
    jurisdiction: str = Field(description="The jurisdiction or market being targeted.")
    target_band: str = Field(description="What ranking level the firm appears to be targeting.")
    apparent_thesis: str = Field(description="The thesis that emerges from the evidence itself, regardless of what the firm claims.")
    thesis_exists: bool = Field(description="True if a coherent thesis actually exists in the evidence, False if the submission is descriptive without a clear positioning argument.")
    evidence_sufficient: bool = Field(description="True if the evidence appears sufficient to sustain the apparent thesis.")
    missing_information: List[str] = Field(default_factory=list, description="Critical information gaps that must be filled before proceeding.")
    comprehension_confidence: float = Field(default=0.5, description="0-1 confidence that the submission is understood well enough to analyze.")


class CompetitiveIdentityOutput(BaseModel):
    """Chapter 9: Competitive identity discovered (never assumed) through 
    pattern detection across ALL evidence. Identity must emerge from the 
    convergence of 4 layers: internal evidence, editorial context, 
    competitive market, and relative comparison."""
    identity_statement: str = Field(description="One clear sentence defining the firm's competitive identity as discovered from evidence.")
    recurring_patterns: List[str] = Field(description="Patterns that appear consistently across multiple matters, clients, and sectors.")
    dominant_client_type: str = Field(description="The predominant type of client (institutional lenders, sponsors, corporates, PE funds, etc.).")
    dominant_matter_type: str = Field(description="The predominant type of work (restructurings, financings, M&A, disputes, etc.).")
    dominant_industries: List[str] = Field(description="Top 2-3 industries that appear most frequently.")
    sophistication_level: str = Field(description="One of: 'elite', 'high', 'medium', 'standard'. Based on complexity of work demonstrated.")
    complexity_patterns: List[str] = Field(description="Recurring complexity signals (cross-border, multi-party, regulatory, novel legal issues, etc.).")
    typical_roles: List[str] = Field(description="Roles the firm typically occupies (lead counsel, co-counsel, local counsel, advisor, etc.).")
    structural_strengths: List[str] = Field(description="Strengths that appear to be structural/institutional — would persist even if key people left.")
    anecdotal_strengths: List[str] = Field(description="Strengths that appear anecdotal — based on one-off matters or individual relationships.")
    sub_specialization: str = Field(description="The most clearly recognizable sub-specialization, if any. Empty string if none.")
    identity_coherence: str = Field(description="One of: 'coherent' (clear, focused identity), 'emerging' (identity forming but not yet fully established), 'fragmented' (no clear identity, mixed services).")


class EditorialHypothesis(BaseModel):
    """Chapter 6: A single editorial hypothesis with supporting evidence 
    and evaluation criteria. Multiple hypotheses must be generated and 
    compared — never just the first plausible one."""
    hypothesis_type: str = Field(description="One of: 'positioning', 'market', 'band', 'individual', 'narrative', 'risk'.")
    statement: str = Field(description="The hypothesis stated clearly in one sentence.")
    supporting_evidence: List[str] = Field(description="Specific evidence from the submission that supports this hypothesis.")
    contradicting_evidence: List[str] = Field(default_factory=list, description="Evidence that weakens or contradicts this hypothesis.")
    explanatory_coverage: List[str] = Field(description="Which dimensions this hypothesis explains (matters, clients, sectors, team, narrative, etc.).")
    assumption_count: int = Field(description="Number of assumptions required for this hypothesis to hold. Lower is better (explanatory economy).")
    consistency_score: float = Field(default=0.5, description="0-1 how internally consistent this hypothesis is.")
    plausibility_score: float = Field(default=0.5, description="0-1 how editorially plausible this hypothesis is given market context.")


class HypothesisSetOutput(BaseModel):
    """Chapter 6.5-6.6: Multiple hypotheses generated and ranked using 
    6 evaluation criteria. The system must NEVER stop at the first 
    reasonable explanation."""
    hypotheses: List[EditorialHypothesis] = Field(description="All generated hypotheses, minimum 3.")
    preferred_hypothesis_index: int = Field(description="Index (0-based) of the hypothesis with highest overall ranking.")
    ranking_rationale: str = Field(description="Explanation of why the preferred hypothesis was ranked highest.")


class RefutationResult(BaseModel):
    """Chapter 7: Result of systematically attempting to destroy a hypothesis.
    Applies the Popper Principle — hypotheses can never be verified completely, 
    only survive successive falsification attempts."""
    hypothesis_statement: str = Field(description="The hypothesis that was tested.")
    survived: bool = Field(description="True if the hypothesis survived the refutation attempt.")
    contradicting_facts: List[str] = Field(default_factory=list, description="Specific facts found that contradict the hypothesis.")
    alternative_explanations: List[str] = Field(default_factory=list, description="Other equally plausible explanations for the same evidence.")
    single_matter_dependency: bool = Field(default=False, description="True if the hypothesis collapses without 1-2 key matters.")
    single_client_dependency: bool = Field(default=False, description="True if the hypothesis relies on a single client relationship.")
    wording_dependency: bool = Field(default=False, description="True if the hypothesis relies on submission wording rather than substance.")
    robustness_assessment: str = Field(description="Assessment of whether the hypothesis holds if top matters are removed.")
    competitor_differentiation: str = Field(description="Whether competitors show the same pattern (if yes, hypothesis is weaker).")
    confidence_after_refutation: float = Field(description="0-1 confidence level after the refutation attempt.")
    survival_rationale: str = Field(description="If survived: why. If destroyed: what destroyed it.")


class RefutationSetOutput(BaseModel):
    """Wrapper for multiple refutation results."""
    results: List[RefutationResult] = Field(description="Refutation results for each tested hypothesis.")
    surviving_hypotheses: List[str] = Field(description="Statements of hypotheses that survived refutation.")
    destroyed_hypotheses: List[str] = Field(description="Statements of hypotheses that were destroyed.")
    strongest_surviving: str = Field(description="The hypothesis with highest post-refutation confidence.")


class ComparativeAnalysisOutput(BaseModel):
    """Chapter 8: Multi-dimensional comparison. The minimum unit of analysis 
    is the submission WITHIN the market. 13-dimension comparison required.
    Never compare using a single variable."""
    quality_comparison: str = Field(description="How the quality of work compares to band expectations.")
    complexity_comparison: str = Field(description="How the complexity level compares to firms in target band.")
    consistency_comparison: str = Field(description="How consistent the practice is compared to peers.")
    diversity_comparison: str = Field(description="Client/matter diversity compared to band expectations.")
    specialization_comparison: str = Field(description="Level of specialization compared to market leaders in category.")
    reputation_comparison: str = Field(description="Market reputation compared to ranked competitors.")
    client_comparison: str = Field(description="Client quality and institutional relationships vs. band norms.")
    team_comparison: str = Field(description="Team structure and bench strength vs. comparable firms.")
    narrative_comparison: str = Field(description="Submission narrative quality vs. editorial expectations.")
    bench_strength_comparison: str = Field(description="Depth of team beyond lead partner vs. band requirements.")
    individual_recognition_comparison: str = Field(description="Individual lawyer recognitions vs. peer firms.")
    trend_comparison: str = Field(description="Direction of practice (ascending, stable, declining) vs. market movement.")
    identity_comparison: str = Field(description="Clarity and strength of competitive identity vs. established firms in band.")
    band_alignment: str = Field(description="Which band the evidence most closely aligns with, and why.")
    temporal_analysis: str = Field(description="Is the improvement structural (multi-year) or circumstantial (this cycle only)?")
    market_position_summary: str = Field(description="2-3 sentence summary of where this firm sits relative to the market.")


class EntryCaseOutput(BaseModel):
    """v13.0: Case for First-Time Recognition — generated when analysis_mode = first_recognition."""
    why_potentially_rankable: str = Field(description="Why this practice is potentially rankable.")
    strongest_entry_evidence: List[str] = Field(description="What evidence most strongly supports entry.")
    what_weakens_entry_case: str = Field(description="What weakens the entry case.")
    what_must_strengthen: List[str] = Field(description="What must be strengthened before submission.")
    entry_assessment: str = Field(description="One of: 'strong_entry_case', 'credible_entry_case', 'potential_but_underdeveloped', 'evidence_exists_not_defensible', 'insufficient_evidence'.")
    entry_assessment_rationale: str = Field(description="Rationale for the entry assessment.")


class EditorialConfidenceOutput(BaseModel):
    """Chapter 4: The Editorial Defensibility Test. The system must seek 
    the most DEFENSIBLE conclusion, not the most optimistic one.
    If this test fails, the system routes to interrogation."""
    evidence_threshold_met: bool = Field(description="Does the evidence clearly surpass the threshold for the target band?")
    market_comparison_supports: bool = Field(description="Does the market comparison support the recommendation?")
    precedents_exist: bool = Field(description="Do similar precedents exist within the same ranking table?")
    improvement_is_structural: bool = Field(description="Is the observed improvement structural and not merely circumstantial?")
    explainable_in_meeting: bool = Field(description="Could this recommendation be explained in an editorial meeting without vague assertions?")
    can_counter_objections: bool = Field(description="Can foreseeable editor objections be answered using only evidence?")
    strengthens_ranking_coherence: bool = Field(description="Does the recommendation strengthen the overall coherence of the ranking?")
    provides_editorial_interpretation: bool = Field(description="Does this add editorial interpretation, or merely repeat the submission?")
    overall_confidence: str = Field(description="One of: 'high', 'moderate', 'low', 'insufficient'.")
    passes_defensibility_test: bool = Field(description="True if the recommendation is editorially defensible.")
    recommendation: str = Field(description="One of: 'proceed' (confident), 'proceed_with_caveats' (moderate), 'downgrade_recommendation', 'needs_investigation' (insufficient).")
    defensibility_summary: str = Field(description="2-3 sentence summary of why the recommendation is or is not defensible.")
    
    # v13.0: First recognition case (if applicable)
    entry_case: Optional[EntryCaseOutput] = Field(default=None, description="Detailed assessment for unranked entry candidates.")
    
    # v6.0: Decomposed confidence dimensions (0-100 each)
    evidence_completeness_score: int = Field(default=0, description="0-100: How complete is the evidence base for the target band?")
    matter_quality_score: int = Field(default=0, description="0-100: Quality of individual matters for Chambers ranking purposes.")
    leadership_visibility_score: int = Field(default=0, description="0-100: How visible is partner/team leadership in the evidence?")
    narrative_cohesion_score: int = Field(default=0, description="0-100: How coherent and thesis-driven is the submission narrative?")
    differentiation_score: int = Field(default=0, description="0-100: How differentiated is this firm vs competitors in the same space?")
    institutional_depth_score: int = Field(default=0, description="0-100: Evidence of institutional (not individual) capability and bench strength.")


# =====================================================
# SUBMISSION BLUEPRINT — Vol. VI, Chapter 15
# The structured planning object generated BEFORE writing.
# "The AI should not start writing. It should start DESIGNING."
# =====================================================

class MatterDisposition(BaseModel):
    """Decision about a single matter: include, de-emphasize, or reposition."""
    matter_title: str = Field(description="Title of the matter.")
    disposition: str = Field(description="One of: 'include_as_lead', 'include_as_supporting', 'include_as_depth', 'de_emphasize', 'reposition_to_other_practice'. NEVER use 'exclude' — Rule #20 forbids eliminating evidence.")
    rationale: str = Field(description="Why this disposition was chosen — references Decision Rules 5, 6, 11.")
    proves_what: str = Field(default="", description="What this matter proves for the thesis that no other matter already proves.")
    redundant_with: str = Field(default="", description="If excluded for redundancy, which included matter already proves the same thing.")


class TransformationLogEntry(BaseModel):
    """v7.0: Documents every transformation the AI makes to client evidence."""
    matter_title: str = Field(description="Title of the matter that was transformed.")
    action: str = Field(description="One of: 'preserved_as_is', 'restructured', 'condensed', 'de_emphasized', 'repositioned', 'enhanced'.")
    rationale: str = Field(description="Why this transformation was applied.")
    what_was_changed: str = Field(default="", description="Specific elements that were modified.")
    what_was_preserved: str = Field(default="", description="Specific elements that were kept intact.")


class TransformationLog(BaseModel):
    """v7.0: Complete audit trail of how the AI transformed client evidence."""
    total_matters_received: int = Field(description="Number of matters the client submitted.")
    total_matters_evaluated: int = Field(description="Number of matters the AI evaluated. MUST equal total_matters_received.")
    total_matters_in_docx: int = Field(description="Number of matters that will appear in the DOCX export. MUST equal total_matters_received.")
    transformations: List[TransformationLogEntry] = Field(default_factory=list, description="Transformation details for each matter.")
    matters_accountability_passes: bool = Field(default=False, description="True if received == evaluated == docx. False triggers a warning.")


class EditorialCoherenceCheck(BaseModel):
    """Vol. VI Ch. 14: 10-question self-check before finalizing."""
    thesis_identifiable: bool = Field(description="Is there a single, clear thesis?")
    all_matters_contribute: bool = Field(description="Do ALL included matters contribute to the thesis?")
    hero_demonstrates_thesis: bool = Field(description="Does the Hero Matter directly demonstrate the thesis?")
    supporting_confirm_pattern: bool = Field(description="Do supporting matters confirm a pattern (not just add volume)?")
    narrative_thread_continuous: bool = Field(description="Is there a continuous narrative thread?")
    evidence_distribution_balanced: bool = Field(description="Is evidence distribution balanced across dimensions?")
    narrative_matches_positioning: bool = Field(description="Does the narrative match the discovered positioning?")
    cognitive_load_minimized: bool = Field(description="Does the architecture minimize cognitive load for the researcher?")
    conclusions_supported: bool = Field(description="Are conclusions backed by sufficient evidence?")
    impression_memorable: bool = Field(description="Does the document leave a clear, memorable impression?")
    passes_coherence: bool = Field(description="True if 8+ of the above are true.")
    redesign_notes: str = Field(default="", description="If coherence fails, what must change.")

class SubmissionBlueprintOutput(BaseModel):
    """Vol. VI, Chapter 15: The Submission Blueprint Object.
    Generated BETWEEN editorial_confidence and narrative_architecture.
    'The AI should not start writing. It should start DESIGNING.'
    This is the bridge between reasoning and writing.
    
    v7.0: Now includes full matter accountability — every matter must have a disposition."""
    
    # Core thesis
    thesis: str = Field(description="The ONE specific argument this submission will prove. Not 'we do banking' but 'we have established dominance in lender-side restructurings for institutional creditors.'")
    
    # Matter architecture
    hero_matter: str = Field(description="The single matter that best demonstrates the thesis. Chosen by 7-criteria editorial selection (thesis embodiment, client importance, economic impact, Chambers relevance, demonstrative capacity, differentiation, strategic position) — NOT by deal value or word count.")
    hero_rationale: str = Field(description="Why this matter was chosen — must reference multiple selection criteria, not just one dimension.")
    hero_selection_reasoning: str = Field(default="", description="Detailed explanation of 'Why this matter?' — how it embodies the editorial thesis and why alternatives were rejected.")
    supporting_matters: List[str] = Field(description="Matters that prove the Hero wasn't an exception. Each must prove something NEW (Ch. 4).")
    matters_to_exclude: List[MatterDisposition] = Field(default_factory=list, description="Matters to DE-EMPHASIZE narratively (NOT to remove from submission). Every client matter must still appear in DOCX export.")
    
    # v7.0: Full matter accountability
    all_matter_dispositions: List[MatterDisposition] = Field(default_factory=list, description="Disposition for EVERY matter received. count(all_matter_dispositions) MUST equal count(input_matters). This field tracks every matter's role.")
    transformation_summary: str = Field(default="", description="Human-readable summary of what the blueprint did to the matters and WHY. Explains any condensing, re-ordering, or de-emphasis decisions transparently.")
    
    # Strategic intelligence
    editorial_risks: List[str] = Field(description="Top 3-5 risks: single-client dependency, wording dependency, positioning gaps.")
    primary_pattern: str = Field(description="The dominant pattern across all evidence (e.g., 'institutional lender representation in distressed debt').")
    secondary_pattern: str = Field(default="", description="A secondary reinforcing pattern, if one exists.")
    practice_identity: str = Field(description="The competitive identity in ONE sentence — what the researcher should remember.")
    
    # Target perception
    target_impression: str = Field(description="What the researcher should think after finishing: [exact sentence].")
    three_key_messages: List[str] = Field(description="Exactly 3 ideas the researcher should remember one week later (Memory Engineering, Ch. 11).")
    
    # Architecture
    evidence_hierarchy: List[str] = Field(description="Ordered list of evidence points by probative strength (Pyramid Principle, Ch. 2). Strongest first.")
    narrative_sequence: List[str] = Field(description="The planned flow of the submission: which matter/section comes first, second, etc. Must create a persuasion curve (Ch. 12).")
    
    # Team & market
    lawyer_distribution: List[str] = Field(description="How lawyers are distributed across matters — demonstrates institutional depth, not just one partner.")
    bench_strength_signals: List[str] = Field(description="Specific evidence of bench strength and institutional capability.")
    client_diversity: List[str] = Field(description="Range of client types demonstrated (institutional, corporate, PE, sovereign, etc.).")
    sector_distribution: List[str] = Field(description="Industries/sectors covered — diversity vs. specialization balance.")
    complexity_distribution: List[str] = Field(description="Types of complexity demonstrated (cross-border, multi-party, regulatory, novel, etc.).")
    
    # Closing & validation
    closing_message: str = Field(description="The final impression to leave — consolidates identity, does NOT summarize (Ch. 13).")
    open_questions: List[str] = Field(default_factory=list, description="Questions the system cannot answer with current evidence.")
    confidence_level: str = Field(description="One of: 'high', 'moderate', 'low'. Based on how well the blueprint can be executed.")
    
    # Self-check
    coherence_check: EditorialCoherenceCheck = Field(description="Vol. VI Ch. 14: 10-question coherence validation.")
    
    # Decision audit
    positioning_change_recommended: bool = Field(default=False, description="Decision Rule 7: True if evidence contradicts the client's proposed narrative and repositioning is needed.")
    promotion_not_recommended: bool = Field(default=False, description="Decision Rule 8: True if evidence doesn't yet clearly surpass the threshold — recommend waiting.")
    practice_change_recommended: str = Field(default="", description="Decision Rule 10: If the firm should present in a different practice area, specify which one.")


class MatterInHierarchy(BaseModel):
    """A single matter's role within the narrative architecture."""
    matter_title: str = Field(description="Title or name of the matter.")
    editorial_role: str = Field(description="One of: 'hero_matter' (flagship), 'thesis_reinforcement', 'differentiation_evidence', 'depth_demonstration', 'supporting'.")
    narrative_function: str = Field(description="What this matter proves in the overall story (e.g., 'Proves cross-border coordination capability').")
    prominence_order: int = Field(description="Order in which this matter should appear (1 = most prominent).")
    amplify_elements: List[str] = Field(default_factory=list, description="Specific elements of this matter to amplify in the narrative.")
    minimize_elements: List[str] = Field(default_factory=list, description="Elements to de-emphasize or omit.")


class NarrativeArchitectureOutput(BaseModel):
    """Pre-writing blueprint that plans the editorial story BEFORE any 
    writing happens. This is the bridge between reasoning and writing — 
    it ensures the system constructs a thesis-driven narrative, not a 
    descriptive summary."""
    thesis_statement: str = Field(description="The ONE sentence thesis this submission will prove. This is the core editorial argument.")
    hero_matter: str = Field(description="The single flagship matter that best embodies the thesis.")
    hero_matter_rationale: str = Field(description="Why this matter was chosen as the hero — what makes it the strongest proof of the thesis.")
    matter_hierarchy: List[MatterInHierarchy] = Field(description="Ordered list of all matters with their editorial role and narrative function.")
    narrative_arc: str = Field(description="How the story should flow from opening to closing — the editorial architecture.")
    positioning_statement: str = Field(description="The competitive identity expressed in editorial language, ready for B7/C2 sections.")
    key_differentiators: List[str] = Field(description="Top 3-5 elements that differentiate this firm from competitors in this space.")
    evidence_to_amplify: List[str] = Field(description="Specific evidence points that should be prominently featured.")
    evidence_to_minimize: List[str] = Field(description="Evidence that is weak, off-message, or dilutes the thesis — minimize or omit.")
    target_researcher_perception: str = Field(description="After reading this submission, the researcher should think: [this sentence].")
    editorial_tone: str = Field(description="The tone the writing should take (authoritative, specialist, institutional, etc.).")
    bench_strength_narrative: str = Field(description="How to present team depth and individual lawyers to reinforce institutional strength.")


class ReasoningTraceEntry(BaseModel):
    """Principle 13: Every editorial decision must be explainable.
    This provides the audit trail for transparency and defensibility."""
    stage: str = Field(description="Pipeline stage that produced this entry (comprehension, identity, hypothesis, refutation, comparison, confidence, narrative).")
    decision: str = Field(description="The specific decision or conclusion reached.")
    evidence_used: List[str] = Field(description="Evidence that informed this decision.")
    alternatives_considered: List[str] = Field(default_factory=list, description="Alternative interpretations that were considered and why they were rejected.")
    confidence: float = Field(description="0-1 confidence in this decision.")
    principle_applied: str = Field(default="", description="Which First Principle was most relevant to this decision.")


# =====================================================
# EDITORIAL MEMORY — v7.0 Continuous Learning System
# Stores editorial decisions and lessons from past submissions
# to improve reasoning quality over time.
# =====================================================

class EditorialMemoryEntry(BaseModel):
    """A single editorial lesson learned from processing a submission."""
    practice_area: str = Field(description="The practice area this lesson applies to.")
    jurisdiction: str = Field(description="The jurisdiction this lesson applies to.")
    lesson_type: str = Field(description="One of: 'inference_pattern', 'common_error', 'successful_thesis', 'client_diversity_pattern', 'matter_quality_signal'.")
    lesson: str = Field(description="The specific editorial insight learned.")
    source_firm: str = Field(default="", description="Anonymized identifier for the firm that generated this lesson.")
    confidence: float = Field(default=0.7, description="0-1 confidence in this lesson's applicability.")
    timestamp: str = Field(default="", description="When this lesson was learned.")


class EditorialMemoryBank(BaseModel):
    """Accumulated editorial intelligence from past submissions.
    This bank grows with each processed submission, making the AI
    progressively smarter about specific practice areas and jurisdictions."""
    entries: List[EditorialMemoryEntry] = Field(default_factory=list, description="All accumulated editorial lessons.")
    total_submissions_processed: int = Field(default=0, description="Total number of submissions that contributed to this memory bank.")
    practice_areas_covered: List[str] = Field(default_factory=list, description="Unique practice areas seen so far.")
    jurisdictions_covered: List[str] = Field(default_factory=list, description="Unique jurisdictions seen so far.")


# =====================================================
# PRACTICE INTELLIGENCE LAYER — v12.0
# Based on Editorial Intelligence Specification:
# "Practice Intelligence Layer — Interpretation Rules"
# Sections §1-§23: How RankPilot interprets practice-specific
# editorial knowledge.
# =====================================================

# v13.1: Simplified fallback schema for when the full PIL schema fails
class PracticeIntelligenceLite(BaseModel):
    """Simplified Practice Intelligence output for LLM fallback.
    When the full PracticeIntelligenceOutput (30+ fields, nested lists) causes
    the LLM structured output to fail, this lite schema captures the essential
    10 fields needed for downstream nodes to function."""
    
    practice_main: str = Field(description="Primary practice area identified from evidence.")
    centre_of_gravity: str = Field(description="The dominant pattern around which evidence organizes.")
    centre_of_gravity_type: str = Field(default="single", description="One of: 'single', 'dual', 'fragmented'.")
    hypothesis_primary: str = Field(description="Primary hypothesis about practice identity and positioning.")
    hypothesis_alternative: str = Field(default="", description="Alternative hypothesis.")
    hypothesis_conservative: str = Field(default="", description="Conservative interpretation.")
    hypothesis_confidence: float = Field(default=0.5, description="0-1 confidence in the primary hypothesis.")
    team_classification: str = Field(default="functional", description="One of: 'dependent', 'functional', 'robust'.")
    team_classification_rationale: str = Field(default="", description="Why this team classification was assigned.")
    narrative_coherence_label: str = Field(default="coherent", description="One of: 'overclaim', 'coherent', 'underpositioned'.")
    narrative_coherence_rationale: str = Field(default="", description="Why this coherence label was assigned.")
    fit_score: int = Field(default=4, description="Practice Fit Test score 0-8.")
    top_risks: List[str] = Field(default_factory=list, description="Top 3 practice risks detected.")
    top_signals: List[str] = Field(default_factory=list, description="Top 5 signals detected, described in plain text.")
    status: str = Field(default="PROCEED", description="'PROCEED' or 'CLARIFICATION_REQUIRED'.")


class PracticeSignal(BaseModel):
    """§10: A single structured signal extracted from evidence.
    10 universal signal types (A-J) with practice-specific expression."""
    signal_type: str = Field(description="One of: 'client' (A), 'matter' (B), 'complexity' (C), 'role' (D), 'leadership' (E), 'team' (F), 'market' (G), 'continuity' (H), 'innovation' (I), 'outcome' (J).")
    description: str = Field(description="What this signal demonstrates in practice-specific language.")
    source_matter: str = Field(default="", description="The matter or evidence that produced this signal.")
    relevance: str = Field(description="One of: 'strong', 'medium', 'weak', 'contradictory'.")
    confidence: float = Field(default=0.5, description="0-1 confidence in this signal's accuracy.")
    practice_specific_expression: str = Field(default="", description="§11: The practice-specific expression preserving editorial grammar (e.g., 'Collateral architecture across dual legal systems' for Banking).")


class PracticePattern(BaseModel):
    """§12: A detected pattern across multiple signals.
    Governed by 7 Pattern Recognition Rules."""
    pattern_type: str = Field(description="One of: 'dominant', 'secondary', 'emerging', 'anecdotal'.")
    description: str = Field(description="What pattern emerges from the evidence.")
    supporting_signals: List[str] = Field(description="Signal descriptions that support this pattern.")
    distribution: str = Field(description="§12.3-12.4: 'concentrated_in_one_lawyer', 'distributed_in_team', 'concentrated_in_one_client', 'distributed_across_clients'.")
    persistence: str = Field(default="current_cycle", description="§12.5: 'multi_cycle' (stronger) or 'current_cycle' (weaker).")
    is_commodity: bool = Field(default=False, description="§12.6: True if the pattern reflects commodity work, not excellence.")
    coherence_sources: List[str] = Field(default_factory=list, description="§12.7: Where the pattern appears (matters, clients, profiles, overview, market).")


class PracticeTension(BaseModel):
    """§15: A structural tension detected between evidence layers."""
    tension_type: str = Field(description="One of: 'claim_evidence' (§15.1), 'practice_category' (§15.2), 'matter_team' (§15.3), 'firm_lawyer' (§15.4), 'directory' (§15.5), 'breadth_specialisation' (§15.6), 'volume_sophistication' (§15.7), 'market_narrative' (§15.8).")
    description: str = Field(description="What the tension is and why it matters editorially.")
    severity: str = Field(description="One of: 'critical', 'moderate', 'minor'.")
    recommendation: str = Field(default="", description="How to resolve or mitigate this tension.")


class PracticeFitTest(BaseModel):
    """§14: 8-dimension validation that evidence fits the practice category."""
    category_fit: bool = Field(description="§14.1: Does the evidence belong to this category?")
    category_fit_notes: str = Field(default="", description="Explanation of category fit assessment.")
    matter_fit: bool = Field(description="§14.2: Do the central matters prove the hypothesis?")
    matter_fit_notes: str = Field(default="", description="Explanation of matter fit assessment.")
    client_fit: bool = Field(description="§14.3: Is the client profile coherent with the practice?")
    client_fit_notes: str = Field(default="", description="Explanation of client fit assessment.")
    role_fit: bool = Field(description="§14.4: Did the firm have the role the hypothesis requires?")
    role_fit_notes: str = Field(default="", description="Explanation of role fit assessment.")
    team_fit: bool = Field(description="§14.5: Does the team sustain the identity?")
    team_fit_notes: str = Field(default="", description="Explanation of team fit assessment.")
    lawyer_fit: bool = Field(description="§14.6: Are individual profiles coherent with the practice?")
    lawyer_fit_notes: str = Field(default="", description="Explanation of lawyer fit assessment.")
    directory_fit: bool = Field(description="§14.7: Does the editorial recognize and value this practice type?")
    directory_fit_notes: str = Field(default="", description="Explanation of directory fit assessment.")
    market_fit: bool = Field(description="§14.8: Is there a defensible competitive space?")
    market_fit_notes: str = Field(default="", description="Explanation of market fit assessment.")
    overall_fit: bool = Field(description="True if 6+ of the 8 dimensions pass.")
    fit_score: int = Field(default=0, description="Count of passing dimensions (0-8).")


class PracticeIntelligenceOutput(BaseModel):
    """§8 + §19: The master Practice Interpretation Object.
    Generated between context_engine and comprehension.
    Transforms raw evidence into structured, practice-specific intelligence.
    
    'The Practice Intelligence Layer comprehends the practice.
     The Positioning Intelligence Engine determines where it competes.
     The Decision Engine decides what recommendation is defensible.
     The Narrative Engine decides how to express it.'
    """
    
    # §19.1: Practice Classification
    practice_main: str = Field(description="Primary practice area identified from evidence.")
    sub_practices: List[str] = Field(default_factory=list, description="Sub-practices detected.")
    centre_of_gravity: str = Field(description="§9: The dominant pattern around which evidence organizes. NOT a marketing label — a conclusion from frequency, quality, repetition, relevance, coherence, centrality.")
    centre_of_gravity_type: str = Field(description="§9.2-9.4: One of: 'single' (signals converge), 'dual' (primary + secondary), 'fragmented' (no coherent identity).")
    secondary_gravity: str = Field(default="", description="§9.3: If dual, the secondary centre of gravity.")
    overlaps: List[str] = Field(default_factory=list, description="Categories that overlap with this practice.")
    category_fit_concerns: List[str] = Field(default_factory=list, description="Concerns about evidence fitting the declared category.")
    
    # §19.2: Activated Knowledge
    rags_used: List[str] = Field(default_factory=list, description="RAG files that were activated for this analysis.")
    rules_applied: List[str] = Field(default_factory=list, description="Interpretation rules that were applied.")
    conflicts_resolved: List[str] = Field(default_factory=list, description="§6: Conflicts between RAG sources that were resolved.")
    
    # §19.3: Signal Map (§10)
    signals: List[PracticeSignal] = Field(default_factory=list, description="All extracted signals, classified by type and relevance.")
    
    # §19.4: Pattern Map (§12)
    patterns: List[PracticePattern] = Field(default_factory=list, description="Detected patterns across signals.")
    excessive_dependencies: List[str] = Field(default_factory=list, description="§19.4: Over-reliance on single clients, lawyers, or matter types.")
    
    # §19.5: Practice Hypotheses (§13)
    hypothesis_primary: str = Field(description="§13.3: Primary hypothesis about practice identity.")
    hypothesis_alternative: str = Field(description="§13.3: Alternative hypothesis.")
    hypothesis_conservative: str = Field(description="§13.3: Conservative interpretation.")
    hypothesis_confidence: float = Field(default=0.5, description="0-1 confidence in the primary hypothesis.")
    hypothesis_evidence_for: List[str] = Field(default_factory=list, description="Evidence supporting primary hypothesis.")
    hypothesis_evidence_against: List[str] = Field(default_factory=list, description="Evidence contradicting primary hypothesis.")
    
    # §19.6: Practice Risks
    risks: List[str] = Field(default_factory=list, description="§8.8: Detected risks (dilution, category mismatch, overclaiming, insufficient complexity, commodity work, weak role, lack of team depth, overdependence, fragmented identity).")
    
    # §19.7: Recommended Research Questions
    research_questions: List[str] = Field(default_factory=list, description="Questions to ask the user before continuing.")
    
    # Practice Fit Test (§14)
    fit_test: PracticeFitTest = Field(description="8-dimension practice fit validation.")
    
    # Tension Detection (§15)
    tensions: List[PracticeTension] = Field(default_factory=list, description="Structural tensions detected between evidence layers.")
    
    # Documento Maestro Mod 5: Team Structure Classification
    team_classification: str = Field(description="One of: 'dependent' (single partner), 'functional' (working but thin), 'robust' (deep bench, succession, specialization).")
    team_classification_rationale: str = Field(default="", description="Why this team classification was assigned.")
    
    # Documento Maestro Mod 4: Narrative Coherence Label
    narrative_coherence_label: str = Field(description="One of: 'overclaim' (claim > evidence), 'coherent' (claim = evidence), 'underpositioned' (evidence > claim).")
    narrative_coherence_rationale: str = Field(default="", description="Why this coherence label was assigned.")
    
    # §20: Stop Condition
    status: str = Field(default="PROCEED", description="'PROCEED' or 'CLARIFICATION_REQUIRED'. If clarification needed, research_questions must be populated.")
    stop_reason: str = Field(default="", description="If status is CLARIFICATION_REQUIRED, explain why processing cannot continue.")