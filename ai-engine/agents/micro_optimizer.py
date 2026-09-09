"""
Micro-Optimization Service for RankPilot 2026.
Provides isolated, high-speed (2-3 second) re-optimizations for:
1. Section B10 / B7 Department Narrative (4-Pillar Architecture)
2. Individual Work Highlights / Matters (3 Organic Paragraphs)
Strictly adheres to Owner Editorial Constitution:
- Zero invented metrics or clients
- Fact and number preservation
- Zero forbidden carpentry (IMPACT, EXECUTION, detached client titles)
"""

import re
from typing import Dict, Any, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from utils.model_factory import create_chat_model
from utils.model_response import coerce_message_text
from utils.evidence_validation import strip_carpentry_and_labels, ensure_three_paragraphs
from utils.language_guard import sanitize_submission_voice


def get_micro_model():
    # Uses low reasoning effort for 2-3 second execution to prevent HTTP timeouts
    return create_chat_model("extraction")


B10_SYSTEM_PROMPT = """You are the Senior Directory Editor for Chambers and Partners and The Legal 500.
Your task is to re-optimize Section B10 ("What is this department best known for?") into an authoritative, prestigious narrative.

MANDATORY RULES:
1. 4-PILLAR ARCHITECTURE:
   - Pillar 1: Practice Identity, core specialization, and why market leaders hire this specific team at moments of maximum commercial/regulatory exposure (e.g. construction suspended, operating permits under attack, title unregistrable, public authorities attempting uncompensated takings).
   - Pillar 2: Anchor Mandates & Concrete Scale: Reference real matters from the firm's portfolio with exact source figures, currency units, and operational impact. Highlight how the team converts complex legal mechanisms into business continuity and asset preservation.
   - Pillar 3: Leadership and Leveraged Bench Strength: Explicitly articulate the leveraged structure: founding/lead partners providing strategic command + key lead associates exercising substantive ownership on critical mandates. Avoid undifferentiated flat lists of names.
   - Pillar 4: National/Strategic Reach & Market Precedent: Define the multi-jurisdictional and federal reach of the practice. Proactively reframe and defeat any regional stereotype ("not merely a regional public-law practice... but a national real estate disputes practice").
2. WORD BUDGET:
   - Must be between 350 and 500 words (strict limit).
   - Must NOT be shorter than the core substance of the original text.
3. CONSTITUTIONAL INTEGRITY:
   - ZERO INVENTED FACTS: Never invent matter names, deal values, regulatory authorities, or client names.
   - Ground every statement strictly in the provided context and original narrative.
4. ZERO FORBIDDEN CARPENTRY & ZERO MARKETING BOILERPLATE:
   - Do NOT use section headers like "Pillar 1:", "Introduction:", "Overview:", or bullet points.
   - NEVER include passive marketing cliches like "We are dedicated to client satisfaction", "We seek long-term relationships", or self-limiting regional confessions ("most of our clients operate in Jalisco").
   - Present a seamless, multi-paragraph institutional narrative in elevated, authoritative third-person directory prose.
"""

MATTER_SYSTEM_PROMPT = """You are the Senior Legal Directory Editor optimizing a work highlight / matter narrative for Chambers and Partners and The Legal 500.

MANDATORY EDITORIAL ARCHITECTURE:
You must write EXACTLY THREE ORGANIC PARAGRAPHS separated by blank lines:

PARAGRAPH 1 — COMMERCIAL STAKES & ASSET PROFILE:
Lead immediately with the commercial stakes, asset profile, transaction/dispute scale (preserve exact source figures and currency units), and the existential commercial exposure or financial risk to the client. Frame the matter around business continuity, asset preservation, and deployed investment, not just procedural filings. Mention the client naturally in this paragraph.

PARAGRAPH 2 — LEGAL CRAFT & STRATEGIC EXECUTION:
Articulate the firm's decisive intervention and craft. Explain how the team converted legal/constitutional mechanisms into commercial protection, assembled technical/evidentiary records, overcame public opposition or regulatory decrees, and secured definitive outcomes (e.g. definitive suspensions, confirmed appeals, enforcement milestones).

PARAGRAPH 3 — OUTCOME, PRECEDENT & TEAM:
State the broader commercial outcome, market precedent, and identify the lead partner and active team members with their substantive, verified roles.

CONSTITUTIONAL RULES:
1. ZERO INVENTED FACTS: You cannot invent currencies, numbers, dates, courts, or client names.
2. PRESERVE ALL NUMBERS & IDENTIFIERS: If the original mentions an amount (e.g. MXN 3 billion, USD 27.7M, 207.5 hectares), it MUST appear accurately in the rewrite.
3. NO META-LABELS: Never include labels like "PARAGRAPH 1", "IMPACT:", "EXECUTION:", "OUTCOME:".
4. TONE: Objective, analytical, prestigious third-person legal directory prose.
5. NO META-COMMENTARY ON MISSING DATA: NEVER write phrases like "no discrete matter value has been specified", "no additional active team members have been specified", "no final precedent", or "no public quantified outcome is disclosed". If an attribute is not provided in source notes, omit it naturally without commentary.
6. NO SPELLED-OUT NUMBERS IN WORDS: Never spell out large monetary numbers in full words (e.g. NEVER write "Six hundred ninety-eight million, four hundred thousand, seven hundred fifty pesos 00/100 MXN"). Use concise editorial notation: "MXN 698.4 million (approx. USD 41.1 million)".
7. TEMPORAL RECONCILIATION: The latest verified status and outcome strictly supersedes obsolete historical milestones. If a 2024 enforcement or ruling is recorded, NEVER retain obsolete predictive phrases like "resolution expected in early 2023". Reconstruct the current state from the latest verified facts.
8. AVOID FORMULAIC REPETITIONS & GEOGRAPHIC REDUNDANCIES: Vary opening phrasing across matters (avoid repeating "In a confidential, ongoing cross-border mandate..." across multiple matters). Avoid repeating multi-jurisdiction lists (e.g. "New York, London and Bogotá") in consecutive sentences.
9. COMMERCIAL IMPACT OVER PROCEDURAL ARCHIVES: Translate legal disputes into commercial asset protection, operational continuity, and economic stakes. Do not transcribe notarial deed numbers, notary names, or procedural committee minutes unless commercially decisive.
"""


def optimize_b10_micro(
    original_b10: str,
    practice_area: str = "",
    firm_name: str = "",
    directive: str = "",
    strategic_context: Optional[Dict[str, Any]] = None,
    narrative_architecture: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Runs a 3-second micro-optimization of Section B10."""
    original_clean = (original_b10 or "").strip()
    if not original_clean and not directive:
        return {
            "success": False,
            "error": "No B10 text or directive provided to optimize."
        }

    strategic_context = strategic_context or {}
    narrative_architecture = narrative_architecture or {}

    thesis = narrative_architecture.get("thesis_statement", "")
    anchor_evidence = narrative_architecture.get("anchor_evidence", [])

    context_blocks = []
    if firm_name:
        context_blocks.append(f"FIRM NAME: {firm_name}")
    if practice_area:
        context_blocks.append(f"PRACTICE AREA: {practice_area}")
    if thesis:
        context_blocks.append(f"STRATEGIC THESIS: {thesis}")
    if anchor_evidence:
        context_blocks.append(f"KEY PORTFOLIO MATTERS/FIGURES: {'; '.join(str(e) for e in anchor_evidence[:5])}")
    if directive:
        context_blocks.append(f"USER RE-OPTIMIZATION DIRECTIVE: {directive}")

    context_str = "\n".join(context_blocks)

    messages = [
        SystemMessage(content=B10_SYSTEM_PROMPT),
        HumanMessage(content=f"CONTEXT:\n{context_str}\n\nORIGINAL B10 NARRATIVE:\n{original_clean}\n\nProduce the optimized 4-pillar narrative (300-500 words):")
    ]

    try:
        llm = get_micro_model()
        response = llm.invoke(messages)
        text = coerce_message_text(response).strip()

        # Sanitize voice & strip fillers
        try:
            from agents.nodes import strip_fillers
            text = strip_fillers(text)
        except Exception:
            pass
        text = sanitize_submission_voice(text)

        # Word count check
        words = text.split()
        if len(words) > 500:
            text = " ".join(words[:500])

        return {
            "success": True,
            "enhanced_b10": text,
            "word_count": len(text.split()),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def optimize_matter_micro(
    matter: Dict[str, Any],
    directive: str = "",
    practice_area: str = "",
    firm_name: str = "",
    thesis: str = "",
) -> Dict[str, Any]:
    """Runs a 3-second micro-optimization of an individual work highlight."""
    client_name = matter.get("client") or matter.get("name") or "Confidential Client"
    raw_notes = matter.get("rawNotes") or matter.get("raw_notes") or ""
    current_text = matter.get("optimizedText") or matter.get("optimized_text") or raw_notes
    value = matter.get("value") or ""
    lead_partner = matter.get("leadPartner") or matter.get("lead_partner") or ""
    team_members = matter.get("teamMembers") or matter.get("team_members") or ""
    cross_border = matter.get("crossBorder") or matter.get("cross_border") or ""
    completion_date = matter.get("completionDate") or matter.get("completion_date") or ""

    if not current_text and not raw_notes:
        return {
            "success": False,
            "error": "Matter has no text or notes to optimize."
        }

    matter_details = [
        f"CLIENT: {client_name}",
        f"VALUE: {value or 'Not specified'}",
        f"LEAD PARTNER: {lead_partner or 'Not specified'}",
        f"TEAM MEMBERS: {team_members or 'Not specified'}",
        f"STATUS/DATE: {completion_date or 'Ongoing / Recent'}",
    ]
    if cross_border:
        matter_details.append(f"CROSS-BORDER: {cross_border}")
    if directive:
        matter_details.append(f"EDITORIAL DIRECTIVE: {directive}")
    if thesis:
        matter_details.append(f"OVERALL PRACTICE THESIS: {thesis}")

    details_str = "\n".join(matter_details)
    source_body = raw_notes if raw_notes and len(raw_notes) > len(current_text) else current_text

    messages = [
        SystemMessage(content=MATTER_SYSTEM_PROMPT),
        HumanMessage(content=f"MATTER ATTRIBUTES:\n{details_str}\n\nSOURCE MATTER DESCRIPTION:\n{source_body}\n\nProduce the refined 3-paragraph matter narrative:")
    ]

    try:
        llm = get_micro_model()
        response = llm.invoke(messages)
        text = coerce_message_text(response).strip()

        # Deterministic carpentry cleaning
        cleaned = strip_carpentry_and_labels(text)
        final_text = ensure_three_paragraphs(cleaned)

        return {
            "success": True,
            "optimized_text": final_text,
            "word_count": len(final_text.split()),
            "client": client_name
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
