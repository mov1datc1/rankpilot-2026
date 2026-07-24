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

# 1. INGESTION NODE
def ingestion_node(state: AgentState) -> Dict:
    file_path = state.get("file_path")
    if not file_path:
        return {"messages": [("assistant", "No file provided.")]}
    try:
        from utils.doc_parser import DocumentParser
        text = DocumentParser.parse(file_path)
        text = sanitize_text(text)
    except Exception as e:
        print(f"[INGESTION ERROR] Failed to parse document: {e}")
        return {
            "doc_text": "",
            "messages": [("assistant", f"Error al leer el documento: {str(e)}")]
        }
    return {
        "doc_text": text,
        "messages": [("assistant", "Document ingested. Analyzing structural signals...")]
    }

# 2. EXTRACTION NODE (Sincronizado con AgentState)
# 2. EXTRACTION NODE (CORREGIDO)
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
        ("system", "You are the RankPilot Context Engine. Analyze the firm's evidence and extract exactly the requested fields."),
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

    # Capa 6: Benchmark Relativo (Hardcoded V1)
    benchmark = "Standard regional baseline requirements apply."
    if "mexico" in str(jurisdiction).lower() and "banking" in str(practice_area).lower():
        benchmark = "Entry: mid-market deals, some cross-border. Band 3: strong deal flow, repeat clients. Band 1: flagship deals, complex structuring."
    
    # Capa 7: Evaluación de viabilidad
    target_realistic = "Viability assessment pending."
    if starting_position == "Entry Candidate":
        if "cross-border" in str(context_dict.get("complexity_profile", "")).lower() or "institutional" in str(context_dict.get("client_type", "")).lower():
            target_realistic = "Band 4-5 viable"
        else:
            target_realistic = "Below ranking threshold"
    elif starting_position == "Upper Tier Push":
        target_realistic = "Consolidation needed to break into top tiers"
    elif starting_position == "Lower Tier Consolidation":
        target_realistic = "Path to Band 3 viable with flagship mandates"
    else:
        target_realistic = "Maintain defensible track record"

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
        "target_realistic": target_realistic
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

EVIDENCE-BASED SCORING RULE (v10.2):
- The "current_band" (Unranked, Band 5, etc.) is USER-PROVIDED metadata and MAY BE INACCURATE or unknown.
- Base your score, confidence, and defensibility SOLELY on the EVIDENCE quality in the submission.
- The same evidence should produce the same score regardless of whether current_band says "Unranked" or "Band 3".
- Score the SUBMISSION QUALITY, not the firm's current market position.
- A firm with strong evidence scores HIGH even if marked as "Unranked".

{analysis_prompt}"""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", analysis_prompt),
        ("human", "Analyze this firm data and return JSON: {data}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"data": json.dumps(input_data, indent=2, default=str, ensure_ascii=True)})
    
    try:
        res_json = safe_json_loads(response.content, fallback={"confidence_score": 50})
        
        # v10.0: CONFIDENTIALITY GUARDRAIL — Post-analysis validation
        matter_evals = res_json.get("matter_evaluations", [])
        for eval_item in matter_evals:
            if isinstance(eval_item, dict):
                # Find the original matter to check locked status
                matter_name = eval_item.get("matter_name", "").lower()
                for orig_matter in all_matters:
                    if isinstance(orig_matter, dict):
                        orig_name = (orig_matter.get("client", "") or orig_matter.get("title", "")).lower()
                        if matter_name and orig_name and (matter_name in orig_name or orig_name in matter_name):
                            if orig_matter.get("_confidentiality_locked"):
                                # Force the eval type to match the locked status
                                eval_item["type"] = orig_matter.get("publish_status", "non_publishable")
                            break
        
        return {
            "analysis": res_json,
            "confidence_score": float(res_json.get("confidence_score", 100)),
            "current_step": "writing"
        }
    except Exception as e:
        print(f"[ANALYSIS PARSE ERROR] {e}")
        return {"confidence_score": 0, "analysis": {"error": "Analysis parsing failed"}}

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
            
            matter['optimized_text'] = optimized_text
            matter['status'] = 'AI Optimized'
            
        except Exception as e:
            print(f"Error optimizing matter: {e}")
            matter['optimized_text'] = matter.get('summary', '')
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