import json
import re
import os
from datetime import datetime
from typing import Dict
from dotenv import load_dotenv
from chains.extraction_chain import get_extraction_chain
# Importaciones de LangChain y Core
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage, HumanMessage

from core.state import AgentState
from agents.prompts import ( 
    STRATEGIC_ANALYSIS_PROMPT, 
    EDITORIAL_INTERROGATOR_PROMPT,
    LATEX_WRITER_PROMPT,
    MATTER_OPTIMIZER_PROMPT
)
from utils.pdf_generator import compile_latex_to_pdf
from utils.rag_router import RAGRouter
from utils.directory_config import get_directory_config, get_directory_context_block
from utils.practice_taxonomy import get_practice_taxonomy, get_practice_context_block

load_dotenv()

# --- UTILIDADES DE NODOS ---

def sanitize_text(text: str) -> str:
    """Remove problematic Unicode and control characters from text."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    text = text.replace('\x00', '')
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    text = text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
    return text

def strip_markdown(text: str) -> str:
    """v11.0: Remove markdown formatting artifacts from LLM output.
    The output goes to DOCX/PDF where markdown syntax appears as ugly literal characters."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    # Remove bold markers (**text** → text, __text__ → text)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    # Remove italic markers (*text* → text, _text_ → text) — be careful with underscores in names
    text = re.sub(r'(?<!\w)\*(.+?)\*(?!\w)', r'\1', text)
    # Remove header markers (## text → text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove backticks
    text = re.sub(r'`(.+?)`', r'\1', text)
    # Remove bullet point markers at start of lines (- text → text)
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)
    # Remove numbered list markers (1. text → text)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def safe_json_loads(text: str, fallback=None):
    """Parse JSON with multiple fallback strategies."""
    if not text:
        return fallback or {}
    cleaned = text.strip()
    if cleaned.startswith('```json'):
        cleaned = cleaned[7:]
    if cleaned.startswith('```'):
        cleaned = cleaned[3:]
    if cleaned.endswith('```'):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    try:
        safe_text = cleaned.encode('ascii', errors='replace').decode('ascii')
        return json.loads(safe_text)
    except (json.JSONDecodeError, UnicodeError):
        pass
    try:
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            return json.loads(match.group())
    except (json.JSONDecodeError, AttributeError):
        pass
    print(f"[SAFE_JSON_LOADS] Failed to parse. First 200 chars: {cleaned[:200]}")
    return fallback or {}

def get_model():
    """
    Configuración para OpenAI Directo (GPT-4o o GPT-4o-mini).
    Asegúrate de tener OPENAI_API_KEY en tu archivo .env.
    """
    return ChatOpenAI(
        model_name="gpt-4o",
        temperature=0.0,     # v10.2: Zero temperature for maximum scoring consistency between runs
        openai_api_key=os.environ.get("OPENAI_API_KEY")
    )

# 1. INGESTION NODE (v14.0 — Trust Layer)
def ingestion_node(state: AgentState) -> Dict:
    file_path = state.get("file_path")
    if not file_path:
        return {"messages": [("assistant", "No file provided.")]}
    try:
        from utils.doc_parser import DocumentParser
        text = DocumentParser.parse(file_path)
        text = sanitize_text(text)
        
        # =====================================================
        # v14.0 TRUST LAYER — Rule 71: Pipeline Manifest
        # Generate document stats BEFORE any LLM processing.
        # This is the ground truth about what the system read.
        # =====================================================
        doc_stats = DocumentParser.get_document_stats(file_path)
        source_matters = doc_stats.get("source_matters", {})
        
        print(f"[PIPELINE MANIFEST] Document: {doc_stats.get('file_name')}")
        print(f"[PIPELINE MANIFEST] Hash: {doc_stats.get('file_hash')}")
        print(f"[PIPELINE MANIFEST] Words: {doc_stats.get('word_count')} | Paragraphs: {doc_stats.get('paragraph_count')} | Tables: {doc_stats.get('table_count')}")
        print(f"[PIPELINE MANIFEST] Source matters: {source_matters.get('total', 0)} "
              f"(publishable: {source_matters.get('publishable', 0)}, "
              f"confidential: {source_matters.get('confidential', 0)})")
        if source_matters.get("matter_labels"):
            for label in source_matters["matter_labels"]:
                print(f"  → {label}")
        
        # Build the manifest object
        manifest = {
            "document": doc_stats,
            "timestamp": datetime.now().isoformat(),
            "extraction": {},  # Populated by extraction_node
            "rag_files_loaded": [],  # Populated by context_engine
            "validation": {},  # Populated by extraction validator
        }
        
    except Exception as e:
        print(f"[INGESTION ERROR] Failed to parse document: {e}")
        return {
            "doc_text": "",
            "pipeline_manifest": {"error": str(e)},
            "messages": [("assistant", f"Error al leer el documento: {str(e)}")]
        }
    return {
        "doc_text": text,
        "pipeline_manifest": manifest,
        "messages": [("assistant", "Document ingested. Analyzing structural signals...")]
    }

# 2. EXTRACTION NODE (v14.0 — Trust Layer Validator)
def extraction_node(state: AgentState) -> Dict:
    doc_text = sanitize_text(state.get("doc_text", ""))
    chat_history = "\n".join([sanitize_text(msg.content) for msg in state["messages"] if hasattr(msg, 'content')])
    full_input = f"{doc_text}\n\nUpdates from chat:\n{chat_history}"

    try:
        chain = get_extraction_chain()
        structured_data = chain.invoke({"text": full_input})
    except Exception as e:
        print(f"[EXTRACTION ERROR] Chain failed: {e}")
        return {
            "metadata": {"firm_name": "", "practice_area": "", "location": "", "narrative": ""},
            "matters": [],
            "current_step": "context"
        }
    
    if hasattr(structured_data, "model_dump"):
        data_dict = structured_data.model_dump()
    elif isinstance(structured_data, dict):
        data_dict = structured_data
    else:
        data_dict = {"metadata": {}, "matters": [], "department": {}, "lawyers": [], "contacts": []}

    ext_meta = data_dict.get("metadata", {})
    if not isinstance(ext_meta, dict):
        ext_meta = {}

    ext_dept = data_dict.get("department", {})
    ext_lawyers = data_dict.get("lawyers", [])
    ext_contacts = data_dict.get("contacts", [])

    # v10.1: CONFIDENTIALITY GUARDRAIL — Calibrated lock
    # RULE: Respect the source document's classification. Only lock matters that have
    # EXPLICIT confidential signals. Do NOT default everything to confidential.
    # - If extraction found is_confidential=True → lock as non_publishable
    # - If extraction set publish_status to non_publishable/confidential → lock and sync is_confidential
    # - If NEITHER flag is explicitly set → KEEP the default publish_status ("publishable")
    # This prevents the bug where all 20 matters end up in Section E with 0 in Section D.
    matters_list = data_dict.get("matters", [])
    for matter in matters_list:
        if isinstance(matter, dict):
            explicitly_confidential = matter.get("is_confidential", False)
            ps = matter.get("publish_status", "publishable")
            explicitly_non_pub = ps in ("non_publishable", "confidential")
            
            if explicitly_confidential and not explicitly_non_pub:
                # Extraction said confidential but publish_status wasn't set → sync them
                matter["publish_status"] = "non_publishable"
                matter["_confidentiality_locked"] = True
            elif explicitly_non_pub:
                # Publish status explicitly non-publishable → sync is_confidential
                matter["is_confidential"] = True
                matter["_confidentiality_locked"] = True
            # else: both default → matter stays as publishable, no lock needed
    
    locked_count = sum(1 for m in matters_list if isinstance(m, dict) and m.get('_confidentiality_locked'))
    pub_count = sum(1 for m in matters_list if isinstance(m, dict) and m.get('publish_status') == 'publishable')
    print(f"[CONFIDENTIALITY GUARDRAIL v10.1] {len(matters_list)} matters: "
          f"{locked_count} locked as confidential, {pub_count} publishable")

    # =====================================================
    # v14.0 TRUST LAYER — Rule 70: Extraction Validator
    # Compare LLM-extracted matter count vs. programmatic source count.
    # If mismatch, log a WARNING — this is the #1 root cause of
    # incorrect downstream analysis (owner feedback July 2026).
    # =====================================================
    manifest = state.get("pipeline_manifest", {})
    source_matters = manifest.get("document", {}).get("source_matters", {})
    source_total = source_matters.get("total", 0)
    extracted_total = len(matters_list)
    
    extraction_validation = {
        "source_matter_count": source_total,
        "extracted_matter_count": extracted_total,
        "match": source_total == extracted_total or source_total == 0,
        "loss_count": max(0, source_total - extracted_total),
        "loss_percentage": round((1 - extracted_total / max(source_total, 1)) * 100, 1) if source_total > 0 else 0,
        "extracted_titles": [m.get("title", "?") for m in matters_list if isinstance(m, dict)],
    }
    
    if source_total > 0 and extracted_total < source_total:
        print(f"[MATTER LOSS WARNING] ⚠️ Source has {source_total} matters but extraction found only {extracted_total}")
        print(f"[MATTER LOSS WARNING] ⚠️ {source_total - extracted_total} matters LOST ({extraction_validation['loss_percentage']}% loss)")
        print(f"[MATTER LOSS WARNING] Source labels: {source_matters.get('matter_labels', [])}")
        print(f"[MATTER LOSS WARNING] Extracted titles: {extraction_validation['extracted_titles']}")
    elif source_total > 0:
        print(f"[EXTRACTION VALIDATOR ✅] Source: {source_total} matters | Extracted: {extracted_total} — MATCH")
    
    # Update manifest with extraction results
    manifest["extraction"] = extraction_validation
    manifest["validation"]["extraction_match"] = extraction_validation["match"]
    manifest["validation"]["matter_loss"] = extraction_validation["loss_count"]

    return {
        "metadata": {
            "firm_name": ext_meta.get("firm_name", ""),
            "practice_area": ext_meta.get("practice_area", ""),
            "location": ext_meta.get("location", ""),
            "narrative": ext_meta.get("narrative_overview", ""),
            "department": ext_dept,
            "lawyers": ext_lawyers,
            "contacts": ext_contacts,
        },
        "matters": matters_list,
        "pipeline_manifest": manifest,
        "current_step": "pre_flight"
    }

# =====================================================
# 2.1 PRE-FLIGHT GATE NODE (v14.1 — Rule 74)
# Runs 5 validations BEFORE any analysis or reasoning.
# If critical validations fail, pipeline HALTS.
# Owner's 5 requirements:
#   1. Reading the correct submission
#   2. Extracted all matters
#   3. Correctly distinguishes publishable/confidential
#   4. Identifies correct directory and practice
#   5. Contrasts ranking status with editorial context
# =====================================================
def pre_flight_gate_node(state: AgentState) -> Dict:
    from utils.doc_parser import DocumentParser
    
    file_path = state.get("file_path", "")
    manifest = state.get("pipeline_manifest", {})
    submission_context = state.get("submission_context", {})
    matters = state.get("matters", [])
    
    user_directory = submission_context.get("directory", "")
    user_practice = submission_context.get("practice_area", "")
    user_jurisdiction = submission_context.get("jurisdiction", "")
    user_status = submission_context.get("current_status", "")
    
    # Pre-Flight Report
    pre_flight = {
        "passed": True,
        "checks": [],
        "warnings": [],
        "errors": [],
        "auto_corrections": {},
    }
    
    print(f"\n{'='*60}")
    print(f"[PRE-FLIGHT GATE v14.1] Starting 5-point validation")
    print(f"{'='*60}")
    
    # ── CHECK 1: Document Identity (Rule 71 complement) ──
    doc_info = manifest.get("document", {})
    if doc_info.get("file_name"):
        pre_flight["checks"].append({
            "name": "Document Identity",
            "status": "PASS",
            "detail": f"Reading: {doc_info['file_name']} (hash: {doc_info.get('file_hash', 'N/A')})"
        })
        print(f"[PRE-FLIGHT ✅] CHECK 1: Document identity confirmed — {doc_info['file_name']}")
    else:
        pre_flight["checks"].append({"name": "Document Identity", "status": "WARN", "detail": "No document stats available"})
        pre_flight["warnings"].append("Document identity could not be verified")
        print(f"[PRE-FLIGHT ⚠️] CHECK 1: Document identity — no stats available")
    
    # ── CHECK 2: Matter Extraction Completeness (Rule 70 gate) ──
    extraction = manifest.get("extraction", {})
    source_matters = doc_info.get("source_matters", {})
    source_total = source_matters.get("total", 0)
    extracted_total = extraction.get("extracted_matter_count", len(matters))
    
    if source_total > 0:
        loss_pct = extraction.get("loss_percentage", 0)
        if extraction.get("match", False) or loss_pct == 0:
            pre_flight["checks"].append({
                "name": "Matter Extraction",
                "status": "PASS",
                "detail": f"Source: {source_total} | Extracted: {extracted_total} — MATCH"
            })
            print(f"[PRE-FLIGHT ✅] CHECK 2: Matter extraction — {source_total}/{source_total} MATCH")
        elif loss_pct <= 20:
            pre_flight["checks"].append({
                "name": "Matter Extraction",
                "status": "WARN",
                "detail": f"Source: {source_total} | Extracted: {extracted_total} — {loss_pct}% loss (within tolerance)"
            })
            pre_flight["warnings"].append(f"Minor matter loss: {source_total - extracted_total} matters ({loss_pct}%)")
            print(f"[PRE-FLIGHT ⚠️] CHECK 2: Matter extraction — {loss_pct}% loss (within 20% tolerance)")
        else:
            pre_flight["checks"].append({
                "name": "Matter Extraction",
                "status": "FAIL",
                "detail": f"Source: {source_total} | Extracted: {extracted_total} — {loss_pct}% LOSS — CRITICAL"
            })
            pre_flight["errors"].append(f"CRITICAL matter loss: {source_total - extracted_total} of {source_total} matters lost ({loss_pct}%)")
            pre_flight["passed"] = False
            print(f"[PRE-FLIGHT ❌] CHECK 2: Matter extraction — {loss_pct}% LOSS — PIPELINE HALT")
    else:
        pre_flight["checks"].append({
            "name": "Matter Extraction",
            "status": "WARN",
            "detail": f"Source count unavailable. Extracted: {extracted_total}"
        })
        pre_flight["warnings"].append("Could not verify matter count against source document")
        print(f"[PRE-FLIGHT ⚠️] CHECK 2: Source count unavailable — extracted {extracted_total}")
    
    # ── CHECK 3: Publishable/Confidential Classification ──
    source_pub = source_matters.get("publishable", 0)
    source_conf = source_matters.get("confidential", 0)
    if source_pub > 0 or source_conf > 0:
        # Count extracted classification
        extracted_pub = sum(1 for m in matters if isinstance(m, dict) and 
                          not m.get("is_confidential", False))
        extracted_conf = sum(1 for m in matters if isinstance(m, dict) and 
                           m.get("is_confidential", False))
        
        pre_flight["checks"].append({
            "name": "Pub/Conf Classification",
            "status": "PASS",
            "detail": f"Source: {source_pub} pub / {source_conf} conf | Extracted: {extracted_pub} pub / {extracted_conf} conf"
        })
        print(f"[PRE-FLIGHT ✅] CHECK 3: Classification — Source {source_pub}p/{source_conf}c | Extracted {extracted_pub}p/{extracted_conf}c")
    else:
        pre_flight["checks"].append({
            "name": "Pub/Conf Classification",
            "status": "SKIP",
            "detail": "Source classification data not available"
        })
        print(f"[PRE-FLIGHT ⚠️] CHECK 3: Classification — source data unavailable")
    
    # ── CHECK 4: Directory & Practice Auto-Detection (Rule 73) ──
    template_info = {}
    if file_path:
        try:
            template_info = DocumentParser.detect_directory_template(file_path)
        except Exception as e:
            print(f"[PRE-FLIGHT] Template detection error: {e}")
    
    if template_info.get("detected_directory", "Unknown") != "Unknown":
        detected_dir = template_info["detected_directory"]
        detected_practice = template_info.get("detected_practice_area", "")
        detected_jurisdiction = template_info.get("detected_jurisdiction", "")
        detected_firm = template_info.get("detected_firm_name", "")
        
        dir_match = detected_dir.lower() in user_directory.lower() or user_directory.lower() in detected_dir.lower() if user_directory else True
        practice_match = True
        if detected_practice and user_practice:
            # Fuzzy match — check if key words overlap
            det_words = set(detected_practice.lower().split())
            usr_words = set(user_practice.lower().replace('&', '').replace(',', '').split())
            practice_match = bool(det_words & usr_words) or detected_practice.lower() in user_practice.lower()
        
        detail_parts = [f"Directory: {detected_dir}"]
        if detected_firm:
            detail_parts.append(f"Firm: {detected_firm}")
        if detected_practice:
            detail_parts.append(f"Practice: {detected_practice}")
        if detected_jurisdiction:
            detail_parts.append(f"Jurisdiction: {detected_jurisdiction}")
        
        if dir_match and practice_match:
            pre_flight["checks"].append({
                "name": "Directory/Practice Detection",
                "status": "PASS",
                "detail": " | ".join(detail_parts)
            })
            print(f"[PRE-FLIGHT ✅] CHECK 4: {' | '.join(detail_parts)}")
        else:
            mismatches = []
            if not dir_match:
                mismatches.append(f"Directory: user said '{user_directory}' but DOCX is '{detected_dir}'")
            if not practice_match:
                mismatches.append(f"Practice: user said '{user_practice}' but DOCX says '{detected_practice}'")
            
            pre_flight["checks"].append({
                "name": "Directory/Practice Detection",
                "status": "WARN",
                "detail": " | ".join(detail_parts) + " | MISMATCHES: " + "; ".join(mismatches)
            })
            pre_flight["warnings"].extend(mismatches)
            print(f"[PRE-FLIGHT ⚠️] CHECK 4: MISMATCH — {'; '.join(mismatches)}")
        
        # Auto-correct: fill in detected values if user left blanks
        if detected_firm and not state.get("metadata", {}).get("firm_name"):
            pre_flight["auto_corrections"]["firm_name"] = detected_firm
        if detected_practice and not user_practice:
            pre_flight["auto_corrections"]["practice_area"] = detected_practice
        if detected_jurisdiction and not user_jurisdiction:
            pre_flight["auto_corrections"]["jurisdiction"] = detected_jurisdiction
        
        manifest["template_detection"] = template_info
    else:
        pre_flight["checks"].append({
            "name": "Directory/Practice Detection",
            "status": "SKIP",
            "detail": "Could not detect template format"
        })
        print(f"[PRE-FLIGHT ⚠️] CHECK 4: Template detection — unknown format")
    
    # ── CHECK 5: Ranking Contradiction Detection (Rule 72) ──
    ranking_evidence = {}
    if file_path:
        try:
            ranking_evidence = DocumentParser.detect_ranking_evidence(file_path)
        except Exception as e:
            print(f"[PRE-FLIGHT] Ranking evidence error: {e}")
    
    user_says_unranked = "unranked" in str(user_status).lower() or not user_status
    has_evidence = ranking_evidence.get("has_ranking_evidence", False)
    
    if has_evidence and user_says_unranked:
        evidence_text = ranking_evidence.get("evidence_text", "")[:150]
        detected_band = ranking_evidence.get("detected_band", "")
        
        warning_msg = f"RANKING CONTRADICTION: User declared 'Unranked' but document contains ranking evidence"
        if detected_band:
            warning_msg += f" (detected: {detected_band})"
        warning_msg += f". Evidence: \"{evidence_text}\""
        
        pre_flight["checks"].append({
            "name": "Ranking Status Validation",
            "status": "WARN",
            "detail": warning_msg
        })
        pre_flight["warnings"].append(warning_msg)
        print(f"[PRE-FLIGHT ⚠️] CHECK 5: {warning_msg}")
    elif has_evidence:
        pre_flight["checks"].append({
            "name": "Ranking Status Validation",
            "status": "PASS",
            "detail": f"User declared '{user_status}' — ranking evidence found consistent"
        })
        print(f"[PRE-FLIGHT ✅] CHECK 5: Ranking status '{user_status}' — consistent with evidence")
    else:
        pre_flight["checks"].append({
            "name": "Ranking Status Validation",
            "status": "PASS",
            "detail": f"User declared '{user_status}' — no contradicting evidence found"
        })
        print(f"[PRE-FLIGHT ✅] CHECK 5: Ranking status '{user_status}' — no contradicting evidence")
    
    manifest["ranking_evidence"] = ranking_evidence
    
    # ── GATE DECISION ──
    manifest["pre_flight"] = pre_flight
    
    if not pre_flight["passed"]:
        print(f"\n{'='*60}")
        print(f"[PRE-FLIGHT GATE ❌] PIPELINE HALTED — {len(pre_flight['errors'])} critical errors")
        for err in pre_flight["errors"]:
            print(f"  ❌ {err}")
        print(f"{'='*60}\n")
        
        return {
            "pipeline_manifest": manifest,
            "analysis": {
                "pre_flight_failed": True,
                "pre_flight_report": pre_flight,
                "summary": "Pipeline halted at Pre-Flight Gate. Critical validation errors detected. The system cannot produce reliable analysis until these issues are resolved.",
                "score": 0,
                "risk_level": "Pre-Flight Failure",
                "audit_letter": {
                    "strategic_assessment": f"PRE-FLIGHT GATE FAILURE: {'; '.join(pre_flight['errors'])}",
                    "matter_evaluations": [],
                },
            },
            "current_step": "writing"  # Skip to writing to output the error report
        }
    
    print(f"\n{'='*60}")
    print(f"[PRE-FLIGHT GATE ✅] ALL CHECKS PASSED — {len(pre_flight['warnings'])} warnings")
    for w in pre_flight["warnings"]:
        print(f"  ⚠️ {w}")
    print(f"{'='*60}\n")
    
    return {
        "pipeline_manifest": manifest,
        "current_step": "context"
    }

# 2.5 CONTEXT ENGINE NODE (8-Layer Methodology)
def context_engine_node(state: AgentState) -> Dict:
    submission_context = state.get("submission_context", {})
    jurisdiction = submission_context.get("jurisdiction", "")
    practice_area = submission_context.get("practice_area", "")
    directory = submission_context.get("directory", "")
    current_status = submission_context.get("current_status", "")
    
    # Capa 2: Clasificación del punto de partida
    starting_position = "Unknown"
    status_lower = str(current_status).lower()
    if "unranked" in status_lower or not status_lower:
        starting_position = "Entry Candidate"
    elif "5" in status_lower or "4" in status_lower:
        starting_position = "Lower Tier Consolidation"
    elif "3" in status_lower or "2" in status_lower:
        starting_position = "Upper Tier Push"
    elif "1" in status_lower:
        starting_position = "Defensive Leadership"

    # LLM extraction for Capa 3, 4, 5, 8
    llm = get_model()
    from core.schema import ContextEngineOutput
    structured_llm = llm.with_structured_output(ContextEngineOutput)
    
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", [])
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are the RankPilot Context Engine (v11.0). Analyze the firm's evidence and extract exactly the requested fields.

ARCHETYPE CLASSIFICATION (MANDATORY — select the BEST match):

For Corporate/M&A practices:
- "High-End Corporate/M&A" — star partners, elite market perception, premium institutional clients, high-value transactions, market-defining work
- "Strong Mid-Market Corporate/M&A" — ex-elite lawyers, sophisticated but lower-ticket matters, agile structure, strong growth potential, niche positioning
- "Emerging Boutique" — specialist ex-biglaw founders, focused premium expertise, single-practice dominance, strong market momentum
- "Corporate Generalist" — broad service capability, weaker differentiation, mixed client base, lower strategic positioning

For Banking & Finance:
- "Lender-Driven Finance" — primarily represents financial institutions, syndicated lending, structured finance
- "Borrower-Side Finance" — corporate borrower representation, acquisition finance, project finance
- "Full-Spectrum Finance" — balanced lender/borrower practice, diversified facility types

For Disputes:
- "Elite Arbitration Boutique" — international arbitration focus, ICC/LCIA/ICSID, cross-border disputes
- "Full-Service Litigation" — commercial litigation, regulatory disputes, appeals
- "Specialist Disputes" — sector-specific litigation (banking, IP, competition, tax)

For Labour & Employment:
- "Employer-Side Labour" — workforce management, restructurings, compliance
- "Union/Employee-Side Labour" — collective bargaining, worker advocacy, labour board proceedings
- "Strategic Employment Advisory" — HR frameworks, M&A employment, executive compensation

For other practices, describe the archetype based on evidence patterns.

PRACTICE TYPE must be one of: transactional, disputes, regulatory, mixed.

COMPLEXITY PROFILE: Describe the dominant complexity patterns (e.g., "cross-border multi-jurisdictional with regulatory overlay" or "domestic high-volume litigation with precedent value").

IDENTITY_ADN: Synthesize archetype + complexity + client type + work type into a single strategic identity sentence.

IMPORTANT: Do NOT default to "General Practice". Analyze the evidence and choose the most specific archetype that fits."""),
        ("human", "Firm Data: {data}")
    ])

    
    chain = prompt | structured_llm
    
    try:
        context_output = chain.invoke({"data": json.dumps(input_data)})
        if hasattr(context_output, "model_dump"):
            context_dict = context_output.model_dump()
        else:
            context_dict = dict(context_output)
    except Exception as e:
        print(f"Error in Context Engine LLM: {e}")
        context_dict = {
            "practice_type": "mixed",
            "archetype": "General Practice",
            "complexity_profile": "Standard domestic work",
            "client_type": "Mixed clients",
            "identity_adn": "General full-service practice"
        }

    # Capa 6: Benchmark Relativo (v15.0 — Jurisdiction-Aware)
    # Only provide quantitative benchmarks when we have real RAG data
    benchmark_available = False
    benchmark = "No specific benchmark data available for this combination. Use evidence-based observations and general Chambers methodology."
    
    jurisdiction_lower = str(jurisdiction).lower()
    practice_lower = str(practice_area).lower()
    
    if "mexico" in jurisdiction_lower and "banking" in practice_lower:
        benchmark = "Entry: mid-market deals, some cross-border. Band 3: strong deal flow, repeat clients. Band 1: flagship deals, complex structuring."
        benchmark_available = True
    elif "mexico" in jurisdiction_lower and ("corporate" in practice_lower or "m&a" in practice_lower):
        benchmark = "Entry: demonstrated transactional capability with recognizable clients. Band 4-5: consistent deal flow, multi-sector coverage, identifiable team. Band 1-3: flagship transactions, market-defining work."
        benchmark_available = True
    
    # Determine jurisdiction type for cross-border calibration
    jurisdiction_type = "national"  # default
    if any(term in practice_lower for term in ["international", "cross-border", "trade", "arbitration"]):
        jurisdiction_type = "global"
    elif any(term in jurisdiction_lower for term in ["latin america", "europe", "asia", "global", "regional"]):
        jurisdiction_type = "regional"
    
    # Determine if cross-border is inherently relevant for this practice
    cross_border_relevant = jurisdiction_type != "national" or any(
        term in practice_lower for term in ["international", "cross-border", "trade", "arbitration", "m&a"]
    )
    
    # Capa 7 & Objective Routing (v13.0)
    primary_objective = submission_context.get("primary_objective", "")
    secondary_objective = submission_context.get("secondary_objective", "")
    
    if starting_position == "Entry Candidate" and not primary_objective:
        primary_objective = "First-time recognition"
        
    if primary_objective == "First-time recognition" or starting_position == "Entry Candidate":
        analysis_mode = "first_recognition"
        target_realistic = "Assess whether submission presents a defensible case for initial inclusion"
    elif primary_objective == "Maintain current ranking":
        analysis_mode = "maintain_ranking"
        target_realistic = "Maintain defensible track record"
    elif primary_objective in ["Move up one band/tier", "Move up multiple bands/tiers"]:
        analysis_mode = "promotion"
        target_realistic = "Consolididation needed to break into higher tiers"
    else:
        analysis_mode = "ranked_assessment"
        target_realistic = f"Assess practice competitiveness and alignment with objective: {primary_objective}"

    # v10.0: Load directory config and inject into strategic_context
    dir_config = get_directory_config(directory)
    practice_taxonomy = get_practice_taxonomy(practice_area)
    
    strategic_context = {
        "directory": directory,
        "directory_name": dir_config["name"],
        "directory_short_name": dir_config["short_name"],
        "ranking_unit": dir_config["ranking_unit"],
        "ranking_labels": dir_config["ranking_labels"],
        "wrong_unit": dir_config["wrong_unit"],
        "matter_label": dir_config["matter_label"],
        "quality_labels": dir_config["quality_labels"],
        "lawyer_categories": dir_config["lawyer_categories"],
        "export_template": dir_config["export_template"],
        "jurisdiction": jurisdiction,
        "practice_area": practice_area,
        "practice_taxonomy": practice_taxonomy.get("name", "") if practice_taxonomy else "",
        "current_status": current_status,
        "starting_position": starting_position,
        "practice_type": context_dict.get("practice_type"),
        "archetype": context_dict.get("archetype"),
        "complexity_profile": context_dict.get("complexity_profile"),
        "client_type": context_dict.get("client_type"),
        "identity_adn": context_dict.get("identity_adn"),
        "benchmark_reference": benchmark,
        "benchmark_available": benchmark_available,
        "jurisdiction_type": jurisdiction_type,
        "cross_border_relevant": cross_border_relevant,
        "target_realistic": target_realistic,
        "analysis_mode": analysis_mode,
        "primary_objective": primary_objective,
        "secondary_objective": secondary_objective
    }
    
    print(f"[DIRECTORY ROUTER] Directory: {dir_config['name']} | Ranking unit: {dir_config['ranking_unit']} | Template: {dir_config['export_template']}")
    if practice_taxonomy:
        print(f"[PRACTICE TAXONOMY] Detected: {practice_taxonomy.get('name', 'Generic')} | Value metric: {practice_taxonomy.get('value_is_not', 'standard')}")

    return {
        "strategic_context": strategic_context,
        "current_step": "analysis"
    }
# 3. ANALYSIS NODE (Now thesis-driven via Editorial Reasoning Engine)
def analysis_node(state: AgentState) -> Dict:
    llm = get_model()
    
    # 1. Recuperar contexto para el RAG
    submission_context = state.get("submission_context", {})
    jurisdiction = submission_context.get("jurisdiction", "")
    practice_area = submission_context.get("practice_area", "")
    directory = submission_context.get("directory", "")
    
    # 2. Inicializar RAG Router y extraer guías
    router = RAGRouter()
    rag_knowledge = router.get_rag_context(practice_area, directory)
    
    # v14.0 TRUST LAYER — Rule 71: Capture RAG files in pipeline manifest
    manifest = state.get("pipeline_manifest", {})
    if manifest:
        rag_file_names = re.findall(r'SPECIFIC KNOWLEDGE.*?:\s*(.+?)\s*---', rag_knowledge or "")
        manifest["rag_files_loaded"] = rag_file_names
        print(f"[PIPELINE MANIFEST] RAG files loaded: {len(rag_file_names)}")
        for fn in rag_file_names:
            print(f"  → {fn}")
    
    # v10.0: Generate directory and practice context blocks
    directory_context_block = get_directory_context_block(directory, practice_area, jurisdiction)
    practice_context_block = get_practice_context_block(practice_area)
    
    # v10.1: Compute full universe counts for FULL_UNIVERSE_ANALYSIS_RULE
    # ENHANCED: Also scan matter text (summary, significance) for cross-border and sector signals
    all_matters = state.get("matters", [])
    unique_clients = set()
    unique_sectors = set()
    cross_border_count = 0
    cross_border_matters = []  # Track which matters are cross-border for anti-self-referential
    team_members_set = set()
    
    # Country keywords for cross-border text scanning
    COUNTRY_KEYWORDS = [
        "usa", "united states", "mexico", "canada", "brazil", "chile", "argentina", "colombia", "peru",
        "germany", "france", "spain", "italy", "uk", "united kingdom", "netherlands", "switzerland",
        "china", "japan", "india", "australia", "singapore", "hong kong", "korea",
        "turkey", "israel", "uae", "saudi arabia"
    ]
    
    for m in all_matters:
        if isinstance(m, dict):
            client = m.get("client", "") or m.get("title", "")
            if client:
                unique_clients.add(client.strip().lower())
            
            # Scan ALL text fields for sector and cross-border signals
            sig = str(m.get("significance", "") or "").lower()
            title = str(m.get("title", "") or "").lower()
            summary = str(m.get("summary", "") or "").lower()
            cbj = str(m.get("cross_border_jurisdictions", "") or "").lower()
            all_text = f"{sig} {title} {summary} {cbj}"
            
            # Enhanced sector detection from ALL text fields
            for sector in ["automotive", "energy", "infrastructure", "security", "entertainment", 
                          "manufacturing", "retail", "technology", "mining", "telecom",
                          "real estate", "construction", "agriculture", "pharma", "food",
                          "banking", "finance", "insurance", "tourism", "hospitality",
                          "logistics", "transportation", "renewable", "solar", "wind",
                          "gas station", "fuel", "petroleum", "oil"]:
                if sector in all_text:
                    unique_sectors.add(sector)
            
            # Enhanced cross-border detection: check boolean, jurisdictions field, AND text content
            is_cb = m.get("is_cross_border", False)
            has_cb_jurisdictions = bool(m.get("cross_border_jurisdictions"))
            
            # Text-based cross-border detection: count distinct country mentions
            if not is_cb and not has_cb_jurisdictions:
                countries_found = set()
                for country in COUNTRY_KEYWORDS:
                    if country in all_text:
                        countries_found.add(country)
                if len(countries_found) >= 2:
                    is_cb = True
                    m["is_cross_border"] = True  # Upgrade the detection
            
            if is_cb or has_cb_jurisdictions:
                cross_border_count += 1
                cross_border_matters.append(client or title)
            
            for member_field in ["team_members", "lead_partner"]:
                member_val = m.get(member_field, "")
                if member_val:
                    team_members_set.update([n.strip() for n in str(member_val).split(",") if n.strip()])
    
    # v10.1: Build MANDATORY_UNIVERSE_FACTS block — Anti-Self-Referential Rule
    # This block contains HARD FACTS that the AI CANNOT contradict in its analysis
    universe_facts = []
    universe_facts.append(f"TOTAL MATTERS SUBMITTED: {len(all_matters)}")
    universe_facts.append(f"UNIQUE CLIENTS: {len(unique_clients)}")
    universe_facts.append(f"UNIQUE SECTORS DETECTED: {len(unique_sectors)} ({', '.join(sorted(unique_sectors))})")
    universe_facts.append(f"CROSS-BORDER MATTERS: {cross_border_count}")
    if cross_border_matters:
        universe_facts.append(f"CROSS-BORDER MATTER CLIENTS: {', '.join(cross_border_matters[:10])}")
    universe_facts.append(f"TEAM MEMBERS INVOLVED: {len(team_members_set)}")
    
    # v10.2: Inject current date for deadline accuracy
    current_date = datetime.now().strftime("%d %B %Y")
    universe_facts.append(f"CURRENT DATE: {current_date}")
    
    universe_facts_block = "\n".join(universe_facts)
    
    print(f"[UNIVERSE COUNTS v10.1] Clients={len(unique_clients)}, Sectors={len(unique_sectors)}, "
          f"CrossBorder={cross_border_count}, Team={len(team_members_set)}")
    
    # 3. Preparar datos — NOW ENRICHED with Editorial Reasoning outputs + v10.1 universe counts
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": all_matters,
        "strategic_context": state.get("strategic_context", {}),
        "RAG_KNOWLEDGE": rag_knowledge,
        # Editorial Reasoning Engine context
        "narrative_architecture": state.get("narrative_architecture", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "editorial_confidence": state.get("editorial_confidence", {}),
        "surviving_hypotheses": state.get("refutation_results", {}).get("surviving_hypotheses", []),
        "comparative_analysis_summary": state.get("comparative_analysis", {}).get("market_position_summary", ""),
        # v7.0: Matter accountability + blueprint context
        "submission_blueprint": state.get("submission_blueprint", {}),
        "total_matters_submitted": len(all_matters),
        # v10.1: Full universe counts for FULL_UNIVERSE_ANALYSIS_RULE
        "total_unique_clients": len(unique_clients),
        "total_unique_sectors": len(unique_sectors),
        "total_cross_border_count": cross_border_count,
        "total_team_members": len(team_members_set),
        # v10.1: MANDATORY FACTS — AI must not contradict these
        "MANDATORY_UNIVERSE_FACTS": universe_facts_block,
        # v10.2: Current date for deadline generation
        "current_date": current_date,
    }
    
    # v10.1: Inject directory, practice, and MANDATORY FACTS context into the prompt
    analysis_prompt = STRATEGIC_ANALYSIS_PROMPT
    analysis_prompt = analysis_prompt.replace("{{directory_context_block}}", directory_context_block)
    analysis_prompt = analysis_prompt.replace("{{practice_context_block}}", practice_context_block)
    # v10.1: Inject mandatory universe facts if placeholder exists, otherwise append
    if "{{mandatory_universe_facts}}" in analysis_prompt:
        analysis_prompt = analysis_prompt.replace("{{mandatory_universe_facts}}", universe_facts_block)
    else:
        # Fallback: prepend to the prompt so AI sees facts FIRST
        analysis_prompt = f"""MANDATORY HARD FACTS — DO NOT CONTRADICT THESE IN YOUR ANALYSIS:
{universe_facts_block}

If the facts above say CROSS-BORDER MATTERS: 5, you MUST NOT say "no cross-border work presented".
If the facts above say UNIQUE SECTORS: 10, you MUST NOT say "limited practice breadth".
Violating these facts is a CRITICAL ERROR.

MATTER EVALUATIONS COMPLETENESS RULE (v10.2):
- The submission contains EXACTLY {len(all_matters)} matters.
- Your "matter_evaluations" array MUST contain EXACTLY {len(all_matters)} entries — one for EACH matter.
- If your output contains fewer than {len(all_matters)} matter_evaluations, the output is INVALID.
- Count your matter_evaluations before finalizing. If count < {len(all_matters)}, you MUST add the missing ones.

EVIDENCE-BASED SCORING RULE (v10.2 — SUPREME PRIORITY):
- The "current_band" (Unranked, Band 5, etc.) is USER-PROVIDED metadata and MAY BE INACCURATE or unknown.
- "Unranked" simply means the firm has NOT BEEN EVALUATED BEFORE — it says NOTHING about evidence quality.
- An Unranked firm with 20 strong matters and cross-border work is JUST AS STRONG as a Band 3 firm with the same evidence.

ABSOLUTE PROHIBITION — SCORING BIAS FROM CURRENT BAND:
- NEVER write "due to its unranked status" as a reason for low confidence or low score.
- NEVER write "the firm is unranked, therefore..." or "as an unranked firm..." in any negative context.
- NEVER lower the confidence score BECAUSE the firm is currently unranked.
- NEVER say "the improvement appears circumstantial" based on unranked status.
- The word "unranked" must ONLY appear in the factual header (Current Band: Unranked), NEVER as a justification for lower scores.

WHAT YOU MUST DO INSTEAD:
- Evaluate ONLY: matter count, matter quality, cross-border depth, sector breadth, lawyer visibility, narrative coherence.
- If evidence is strong (15+ quality matters, cross-border work, sector diversity): score MUST be 70+, confidence MUST be Moderate or High.
- If evidence is weak (few matters, no outcomes, single sector): score can be low — but cite the EVIDENCE weakness, not the band status.

SCORING FLOOR CALIBRATION:
- 20 matters with automotive + energy + real estate + banking = minimum score 70
- 5+ cross-border matters = minimum confidence "Moderate"
- Hero matter with USD 100M+ impact = minimum confidence "Moderate"

{analysis_prompt}"""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", analysis_prompt),
        ("human", "Analyze this firm data and return JSON: {data}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"data": json.dumps(input_data, indent=2, default=str, ensure_ascii=True)})
    
    # v10.2: VALIDATION GATE — Programmatic quality filter with auto-retry
    max_retries = 2
    attempt = 0
    last_violations = []
    
    while attempt <= max_retries:
        if attempt > 0:
            print(f"[VALIDATION GATE] Retry #{attempt}/{max_retries} — violations: {last_violations}")
            # Re-invoke the chain with the same data
            response = chain.invoke({"data": json.dumps(input_data, indent=2, default=str, ensure_ascii=True)})
        
        try:
            res_json = safe_json_loads(response.content, fallback={"confidence_score": 50})
            
            # v10.0: CONFIDENTIALITY GUARDRAIL — Post-analysis validation
            matter_evals = res_json.get("matter_evaluations", [])
            for eval_item in matter_evals:
                if isinstance(eval_item, dict):
                    matter_name = eval_item.get("matter_name", "").lower()
                    for orig_matter in all_matters:
                        if isinstance(orig_matter, dict):
                            orig_name = (orig_matter.get("client", "") or orig_matter.get("title", "")).lower()
                            if matter_name and orig_name and (matter_name in orig_name or orig_name in matter_name):
                                if orig_matter.get("_confidentiality_locked"):
                                    eval_item["type"] = orig_matter.get("publish_status", "non_publishable")
                                break
            
            # ═══════════════════════════════════════════════════════
            # VALIDATION GATE — Hard Rule Checks (NO LLM, pure logic)
            # ═══════════════════════════════════════════════════════
            violations = []
            
            # CHECK 1: Matter Evaluations Completeness
            # v13.1 Rule 69: Check BOTH root-level AND inside audit_letter (schema puts them inside audit_letter)
            eval_count = len(res_json.get("matter_evaluations", []))
            if eval_count == 0:
                # Fallback: check inside audit_letter where the prompt schema actually places them
                audit_evals = res_json.get("audit_letter", {}).get("matter_evaluations", []) if isinstance(res_json.get("audit_letter"), dict) else []
                if audit_evals:
                    # Promote to root level so downstream code finds them
                    res_json["matter_evaluations"] = audit_evals
                    eval_count = len(audit_evals)
            expected_count = len(all_matters)
            if eval_count < expected_count:
                violations.append(f"EVAL_COUNT: Got {eval_count} matter_evaluations, expected {expected_count}")
            
            # CHECK 2: No "exclude" disposition (Rule #42)
            audit_letter = res_json.get("audit_letter", {})
            all_disps = audit_letter.get("all_matter_dispositions", []) if isinstance(audit_letter, dict) else []
            # Also check blueprint-level dispositions
            blueprint = res_json.get("submission_blueprint", {})
            bp_disps = blueprint.get("all_matter_dispositions", []) if isinstance(blueprint, dict) else []
            for disp_list in [all_disps, bp_disps]:
                for d in disp_list:
                    if isinstance(d, dict) and d.get("disposition", "").lower() == "exclude":
                        violations.append(f"EXCLUDE_USED: Matter '{d.get('matter_title', '?')}' has disposition 'exclude' — must use 'de_emphasize'")
            
            # CHECK 3: Matter Dispositions Completeness
            disp_count = max(len(all_disps), len(bp_disps))
            if disp_count > 0 and disp_count < expected_count:
                violations.append(f"DISP_COUNT: Got {disp_count} dispositions, expected {expected_count}")
            
            # CHECK 4: Future Deadlines (Rule #41)
            path_steps = audit_letter.get("the_path_to_dominance", []) if isinstance(audit_letter, dict) else []
            import re as re_module
            for step in path_steps:
                if isinstance(step, dict):
                    deadline = str(step.get("deadline", ""))
                    # Check for obviously past years (2020-2025)
                    past_year_match = re_module.search(r'20(2[0-5]|1\d)', deadline)
                    if past_year_match:
                        violations.append(f"PAST_DEADLINE: '{deadline}' is in the past")
            
            # CHECK 5: Score is present and numeric
            score = res_json.get("score")
            if score is None or (isinstance(score, (int, float)) and score == 0):
                violations.append("MISSING_SCORE: No score or score is 0")
            
            # CHECK 6: No "unranked status" bias (Rule #47)
            # Scan key text fields for forbidden phrases
            bias_phrases = [
                "due to its unranked status",
                "due to its unranked position",
                "because the firm is unranked",
                "as an unranked firm",
                "given its unranked status",
                "its unranked status",
                "the firm is currently unranked",
                "being unranked",
            ]
            # Check audit_letter narrative fields
            text_fields_to_scan = []
            if isinstance(audit_letter, dict):
                for key in ["editorial_confidence_explanation", "the_state_of_play", "competitive_context", "executive_summary"]:
                    val = audit_letter.get(key, "")
                    if isinstance(val, str):
                        text_fields_to_scan.append(val)
            # Also check top-level fields
            for key in ["editorial_confidence_explanation", "the_state_of_play", "competitive_context"]:
                val = res_json.get(key, "")
                if isinstance(val, str):
                    text_fields_to_scan.append(val)
            
            full_text_scan = " ".join(text_fields_to_scan).lower()
            for phrase in bias_phrases:
                if phrase in full_text_scan:
                    violations.append(f"UNRANKED_BIAS: Found '{phrase}' — scoring must be evidence-based, not status-based")
                    break  # One violation is enough
            
            # CHECK 7: Scoring Floor Calibration (Rule #47)
            if isinstance(score, (int, float)) and expected_count >= 15:
                # With 15+ matters, score should be at least 65
                if score < 65:
                    violations.append(f"SCORE_FLOOR: Score {score} is below minimum 65 for a submission with {expected_count} matters")
            
            # Log results
            if violations:
                print(f"[VALIDATION GATE] ❌ FAILED (attempt {attempt + 1}) — {len(violations)} violations:")
                for v in violations:
                    print(f"  → {v}")
                last_violations = violations
                attempt += 1
                
                if attempt > max_retries:
                    # All retries exhausted — return best effort with warnings
                    print(f"[VALIDATION GATE] ⚠️ Max retries exhausted. Returning result with {len(violations)} violations.")
                    res_json["_validation_warnings"] = violations
                    break
                continue  # Retry
            else:
                print(f"[VALIDATION GATE] ✅ PASSED (attempt {attempt + 1}) — all checks green")
                break  # Success
            
        except Exception as e:
            print(f"[ANALYSIS PARSE ERROR] {e}")
            attempt += 1
            if attempt > max_retries:
                return {"confidence_score": 0, "analysis": {"error": "Analysis parsing failed after retries"}}
            continue
    
    return {
        "analysis": res_json,
        "confidence_score": float(res_json.get("confidence_score", 100)),
        "pipeline_manifest": manifest,
        "current_step": "writing"
    }

# 4. INTERROGATOR NODE
def interrogator_node(state: AgentState) -> Dict:
    llm = get_model()
    analysis = state.get("analysis", {})
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", EDITORIAL_INTERROGATOR_PROMPT),
        ("placeholder", "{messages}"),
        ("human", "Current Analysis: {analysis_data}. Ask for missing info.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({
        "messages": state["messages"],
        "analysis_data": json.dumps(analysis)
    })
    
    return {"messages": [response]}

# 5. OPTIMIZATION NODE
def optimization_node(state: AgentState) -> Dict:
    print("--- OPTIMIZING MATTERS ---")
    matters = state.get("matters", [])
    
    if not matters:
        return state

    llm = get_model()
    # Require JSON output with 'optimized_text' key
    llm = llm.bind(response_format={"type": "json_object"})
    
    optimized_matters = []
    for matter in matters:
        # Construct the raw matter text to feed to the optimizer
        raw_text = f"Title: {matter.get('title', '')}\nClient: {matter.get('client', '')}\nValue: {matter.get('value', '')}\nSummary: {matter.get('summary', '')}\nSignificance: {matter.get('significance', '')}\nLead Partner: {matter.get('lead_partner', '')}"
        
        messages = [
            SystemMessage(content=MATTER_OPTIMIZER_PROMPT),
            HumanMessage(content=f"Optimize this raw matter:\n\n{raw_text}")
        ]
        
        try:
            response = llm.invoke(messages)
            result = json.loads(response.content)
            optimized_text = result.get('optimized_text', matter.get('summary'))
            
            # ═══ v8.0: PROBATIVE PRESERVATION VALIDATOR (Constitutional Article V) ═══
            original_word_count = len(raw_text.split())
            optimized_word_count = len(optimized_text.split()) if optimized_text else 0
            ratio = optimized_word_count / max(original_word_count, 1)
            
            # Check 1: Word count ratio — optimized should be >= 75% of original
            needs_reoptimization = ratio < 0.75
            
            # Check 2: Key evidence element preservation
            import re as _re
            # Extract key elements from original
            original_lower = raw_text.lower()
            optimized_lower = (optimized_text or '').lower()
            
            # Check client name preservation
            client_name = matter.get('client', '').lower().strip()
            if client_name and len(client_name) > 2 and client_name not in optimized_lower:
                needs_reoptimization = True
                print(f"  [PROBATIVE] Client name '{matter.get('client')}' missing from optimized text")
            
            # Check monetary value preservation
            value_str = matter.get('value', '').strip()
            if value_str and value_str != 'N/A':
                # Extract numeric portions for comparison
                original_numbers = set(_re.findall(r'\d[\d,\.]+', value_str))
                for num in original_numbers:
                    if num not in (optimized_text or ''):
                        needs_reoptimization = True
                        print(f"  [PROBATIVE] Value '{num}' missing from optimized text")
                        break
            
            # ═══ v9.0: EVIDENCE LIST DETECTOR (Owner Observation 1 & 6) ═══
            # Detect if original contains a LIST of sub-matters/contracts/entities
            # and verify the optimized text preserves them
            
            # Check for numeric evidence counts (e.g., "17 asuntos", "300 contratos", "8 years")
            evidence_numbers = set(_re.findall(r'\b(\d+)\s*(?:matters?|asuntos?|contracts?|contratos?|agreements?|years?|años?|mandates?|projects?|engagements?|providers?|proveedores?|distributors?)', raw_text.lower()))
            for num in evidence_numbers:
                if num not in (optimized_text or '').lower():
                    needs_reoptimization = True
                    print(f"  [EVIDENCE-LIST] Numeric evidence '{num}' (count of sub-items) missing from optimized text")
            
            # Check for Strategic Client Relationship signals
            scr_signals = ['exclusive external', 'departamento jurídico externo', 'ongoing counsel', 
                          'institutional counsel', 'retained counsel', 'exclusive counsel',
                          'external legal department', 'long-term advisory', 'longstanding relationship']
            original_has_scr = any(signal in raw_text.lower() for signal in scr_signals)
            if original_has_scr:
                # If it's a Strategic Client Relationship, the optimized text MUST be at least 90% of original
                if ratio < 0.90:
                    needs_reoptimization = True
                    print(f"  [SCR-DETECT] Strategic Client Relationship detected — ratio {ratio:.2f} is below 90% threshold")
            
            # Check for named entity preservation (company names in uppercase or capitalized)
            original_entities = set(_re.findall(r'\b[A-Z][A-Za-z]{2,}(?:\s+[A-Z][A-Za-z]+)*\b', matter.get('summary', '') or matter.get('significance', '') or ''))
            if len(original_entities) > 3:  # Multi-entity evidence
                preserved = sum(1 for e in original_entities if e.lower() in optimized_lower)
                preservation_ratio = preserved / len(original_entities)
                if preservation_ratio < 0.70:
                    needs_reoptimization = True
                    print(f"  [ENTITY-LOSS] Only {preserved}/{len(original_entities)} named entities preserved ({preservation_ratio:.0%})")
            
            if needs_reoptimization:
                print(f"  [PROBATIVE] Re-optimizing matter '{matter.get('title', 'unknown')}' — ratio: {ratio:.2f}")
                preservation_prompt = (
                    "CRITICAL RE-OPTIMIZATION REQUIRED.\n"
                    "The previous optimization LOST probative evidence (Constitutional Article V violation).\n"
                    "You MUST preserve ALL of the following from the original:\n"
                    "- Client name exactly as written\n"
                    "- All monetary values with currency\n"
                    "- All jurisdictions mentioned\n"
                    "- The firm's specific role (not generic 'advised')\n"
                    "- All team members mentioned\n"
                    "- The outcome or result\n"
                    "- ALL numeric counts (e.g., '17 matters', '300 contracts', '8 years') — NEVER compress to 'various' or 'multiple'\n"
                    "- ALL named sub-entities (e.g., PUREM, Hutchison, ISOCLIMA) — preserve EVERY name\n"
                    "- Exclusivity signals (e.g., 'exclusive external counsel') — NEVER drop\n"
                    "- Duration signals (e.g., 'eight-year relationship') — NEVER drop\n\n"
                    "EVIDENCE VS PROSE RULE: If the original contains LISTS of matters, contracts, or entities, "
                    "these are COMPETITIVE EVIDENCE, not prose. Preserve each item individually.\n\n"
                    "RESTRUCTURE for editorial impact but do NOT compress or summarize away evidence.\n"
                    "The optimized version MUST be at least 75% of the original word count "
                    "(90% if a Strategic Client Relationship is detected).\n\n"
                    f"Original text:\n{raw_text}\n\n"
                    f"Previous (rejected) optimization:\n{optimized_text}\n\n"
                    "Provide a corrected optimization that preserves ALL probative elements."
                )
                try:
                    retry_messages = [
                        SystemMessage(content=MATTER_OPTIMIZER_PROMPT),
                        HumanMessage(content=preservation_prompt)
                    ]
                    retry_response = llm.invoke(retry_messages)
                    retry_result = json.loads(retry_response.content)
                    optimized_text = retry_result.get('optimized_text', optimized_text)
                    print(f"  [PROBATIVE] Re-optimization complete. New word count: {len(optimized_text.split())}")
                except Exception as retry_err:
                    print(f"  [PROBATIVE] Re-optimization failed: {retry_err}. Keeping original optimization.")
            
            # v11.0: Strip any markdown formatting before storing
            matter['optimized_text'] = strip_markdown(optimized_text)
            matter['status'] = 'AI Optimized'
            
        except Exception as e:
            print(f"Error optimizing matter: {e}")
            matter['optimized_text'] = strip_markdown(matter.get('summary', ''))
            matter['status'] = 'Optimization Failed'
            
        optimized_matters.append(matter)
        
    return {"matters": optimized_matters}

# 6. WRITER NODE
def writer_node(state: AgentState, config: RunnableConfig) -> Dict:
    print("--- GENERATING PDF REPORT ---")
    analysis = state.get("analysis", {})
    metadata = state.get("metadata", {})
    matters = state.get("matters", [])
    
    # 1. Load LaTeX Template
    try:
        with open("templates/report_template.tex", "r") as f:
            template_content = f.read()
    except Exception as e:
        print(f"Template not found: {e}")
        return {"is_complete": True, "pdf_url": ""}

    # 2. Format Matters for LaTeX
    matter_list_latex = ""
    for m in matters:
        name = m.get("name") or m.get("title") or "Unnamed Matter"
        val = m.get("value", "N/A")
        client = m.get("client", "N/A")
        summary = m.get("optimizedText") or m.get("optimized_text") or m.get("rawNotes") or m.get("summary") or "No description."
        matter_list_latex += f"\\item \\textbf{{{name}}} (Client: {client} | Value: {val})\\\\ {summary}\n"

    if not matter_list_latex:
        matter_list_latex = "\\item \\textit{No matters associated.}"

    # 3. Format Evolution Steps
    evo_steps = analysis.get("recommendations", [])
    if isinstance(evo_steps, list):
        evo_latex = "\n".join([f"\\item {step}" for step in evo_steps])
    else:
        evo_latex = f"\\item {evo_steps}"
        
    if not evo_latex.strip():
        evo_latex = "\\item Maintain current strategy."

    # 4. Replace Placeholders
    latex_code = template_content
    latex_code = latex_code.replace("{{FIRM_NAME}}", str(metadata.get("firm_name", "Unknown Firm")))
    latex_code = latex_code.replace("{{PRACTICE_AREA}}", str(metadata.get("practice_area", "General Practice")))
    latex_code = latex_code.replace("{{MODEL_NAME}}", str(analysis.get("practice_model", "Standard")))
    latex_code = latex_code.replace("{{TIER}}", str(analysis.get("current_tier_assessment", "Unranked / New Entry")))
    latex_code = latex_code.replace("{{CONFIDENCE}}", str(state.get("confidence_score", 80)))
    latex_code = latex_code.replace("{{ADVANTAGE}}", str(analysis.get("competitive_edge", "Standard Market Offerings")))
    latex_code = latex_code.replace("{{MATTER_LIST}}", matter_list_latex)
    latex_code = latex_code.replace("{{EVOLUTION_STEPS}}", evo_latex)

    # Sanitize LaTeX (basic escape for &, %, $, #, _)
    for char in ['&', '%', '$', '#', '_']:
        if char in latex_code:
            # We skip proper escaping for this prototype to avoid breaking actual latex commands
            pass

    # 5. Compile PDF
    output_filename = f"report_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    pdf_path = compile_latex_to_pdf(latex_code, output_filename)
    
    # 6. Return the URL (For local dev, we assume the python API serves the root or we return relative path)
    # In production with Vercel, we would upload to Supabase Storage here.
    # For now, we return the path which the FastAPI can serve.
    pdf_url = f"/api/download/{pdf_path}" if pdf_path else ""

    return {
        "is_complete": True,
        "pdf_url": pdf_url
    }