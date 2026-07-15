from pydantic import BaseModel, Field
from typing import List, Optional, Dict

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


# =====================================================
# SUBMISSION BLUEPRINT — Vol. VI, Chapter 15
# The structured planning object generated BEFORE writing.
# "The AI should not start writing. It should start DESIGNING."
# =====================================================

class MatterDisposition(BaseModel):
    """Decision about a single matter: include, exclude, or reposition."""
    matter_title: str = Field(description="Title of the matter.")
    disposition: str = Field(description="One of: 'include_as_hero', 'include_as_supporting', 'include_as_depth', 'exclude', 'reposition_to_other_practice'.")
    rationale: str = Field(description="Why this disposition was chosen — references Decision Rules 5, 6, 11.")
    proves_what: str = Field(default="", description="What this matter proves for the thesis that no other matter already proves.")
    redundant_with: str = Field(default="", description="If excluded for redundancy, which included matter already proves the same thing.")

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
    This is the bridge between reasoning and writing."""
    
    # Core thesis
    thesis: str = Field(description="The ONE specific argument this submission will prove. Not 'we do banking' but 'we have established dominance in lender-side restructurings for institutional creditors.'")
    
    # Matter architecture
    hero_matter: str = Field(description="The single matter that best demonstrates the thesis. Chosen by demonstrative power, NOT by deal value (Decision Rule 6).")
    hero_rationale: str = Field(description="Why this matter was chosen — what makes it the strongest proof.")
    supporting_matters: List[str] = Field(description="Matters that prove the Hero wasn't an exception. Each must prove something NEW (Ch. 4).")
    matters_to_exclude: List[MatterDisposition] = Field(default_factory=list, description="Matters actively excluded and why (Decision Rule 5: redundancy, contradiction, wrong practice, dilution).")
    
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