import json
import re
import os
import time
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
from utils.validators import get_ranking_architecture, validate_analysis_output, validate_matter_enhancement
from utils.benchmark_scraper import scrape_rankings, get_benchmark_summary

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


# ═══════════════════════════════════════════════════════════════
# v17.5: CENTRALIZED FILLER PHRASE STRIPPER (Module Level)
# Owner directive: "The system substitutes evidence with elegance.
# 'played a pivotal role', 'robust framework', 'comprehensive advice'
# — all seven matters end up sounding the same."
# This runs on ALL LLM output: matters, B7, any future text.
# ═══════════════════════════════════════════════════════════════
GENERIC_FILLERS = [
    # === STANDALONE ADJECTIVES (the LLM's favorite crutches) ===
    (r'\bpivotal\b', 'important'),
    (r'\bseamlessly\b', 'effectively'),
    (r'\bmeticulously\b', 'carefully'),
    (r'\bholistic\b', 'integrated'),
    (r'\bparamount\b', 'significant'),
    # === FILLER PHRASES ===
    (r'\bstands as a (?:beacon|testament|cornerstone|pillar)\b', 'is'),
    (r'\bserves as a (?:beacon|testament|cornerstone|pillar)\b', 'is'),
    (r'\bis a testament to\b', 'demonstrates'),
    (r'\bcarved out a niche\b', 'specialises'),
    (r'\bsolidified its\b', 'established its'),
    (r'\bunderscores\b', 'demonstrates'),
    (r'\brobust (?:framework|infrastructure|system|platform)\b', 'framework'),
    (r'\bcomprehensive\b', 'thorough'),
    (r'\bdistinguished\b', 'recognised'),
    (r'\benhanced compliance posture\b', 'improved compliance'),
    (r'\bcomplex regulatory landscape\b', 'regulatory environment'),
    (r'\bnavigate the intricacies\b', 'address the requirements'),
    (r'\bnavigate (?:the )?complex\b', 'address'),
    (r'\binstrumental in\b', 'central to'),
    (r'\bplayed a (?:crucial|key|critical|instrumental|significant|pivotal) role\b', 'contributed'),
    (r'\bat the forefront of\b', 'active in'),
    (r'\bbeacon of (?:expertise|excellence)\b', 'centre of expertise'),
    (r'\bexemplifies\b', 'demonstrates'),
    (r'\bprofound and enduring\b', 'long-standing'),
    (r'\btestament to\b', 'evidence of'),
    (r'\bcornerstone of\b', 'central to'),
    (r'\bauthoritative role\b', 'role'),
    (r'\bstrengthened compliance\b', 'improved compliance'),
    (r'\bdemonstrating expertise\b', 'showing capability'),
    (r'\bwith a keen focus\b', 'focusing'),
    # === v18.0: EXTENDED PATTERNS (compensate for logit_bias removal on GPT-5.6) ===
    (r'\bunderpinned\b', 'supported'),
    (r'\bspearheaded\b', 'led'),
    (r'\bsafeguarding\b', 'protecting'),
    (r'\blandscape\b(?!\s+(?:of|in|for))', 'environment'),
    (r'\brobust\b', 'strong'),
    (r'\bleveraged?\b', 'used'),
    (r'\bfacilitated?\b', 'enabled'),
    (r'\bcommitment to\b', 'focus on'),
    (r'\bdemonstrated a\b', 'showed'),
    (r'\bnotable\b', 'significant'),
    (r'\binvaluable\b', 'important'),
    (r'\btransformative\b', 'significant'),
    (r'\brendered\b', 'provided'),
    (r'\bprofound\b', 'significant'),
    (r'\boutstanding\b', 'strong'),
    # === v18.7: WEAK OUTCOME PHRASES (found duplicated across matters in v18-4) ===
    (r'\breduced regulatory exposure\b', 'reduced specific regulatory risk'),
    (r'\bstrengthened compliance posture\b', 'achieved measurable compliance'),
    (r'\bmitigated potential risks\b', 'addressed identified risks'),
    (r'\bwidely recognised\b', 'recognised'),
    (r'\bparticularly recognised\b', 'recognised'),
    (r'\bstrategic advisory role\b', 'advisory function'),
]

def strip_fillers(text: str) -> str:
    """v17.5: Remove generic filler phrases from any LLM-generated text.
    Centralized function called on all output: matters, B7, audit sections."""
    if not text:
        return text
    cleaned = text
    count = 0
    for pattern, replacement in GENERIC_FILLERS:
        new_text = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
        if new_text != cleaned:
            count += 1
        cleaned = new_text
    if count > 0:
        print(f"[FILLER STRIP v17.5] Cleaned {count} filler patterns")
    return cleaned


def verify_client_descriptors(original_raw: str, enhanced_text: str, client_name: str) -> str:
    """v18.7: PROGRAMMATIC client descriptor verification and repair.
    
    The LLM tends to replace specific client descriptions with generic labels:
      "Grupo Excelsior, one of Mexico's leading dairy producers" 
      → "Grupo Excelsior, a prominent client"
    
    This function:
    1. Extracts the client descriptor from the ORIGINAL text
    2. Checks if key industry/sector words survived in the enhanced text
    3. If lost, surgically splices the original descriptor back in
    
    v18.7 FIX: Searches ALL occurrences of client name, not just the first.
    The first occurrence is often in "Title:" or "Client:" fields (no comma).
    The descriptor with comma lives in "Summary:" (2nd+ occurrence).
    
    This is DETERMINISTIC — no LLM involved, cannot be ignored.
    """
    if not original_raw or not enhanced_text or not client_name:
        return enhanced_text
    
    client_clean = client_name.strip()
    if not client_clean:
        return enhanced_text
    
    # ═══ Step 1: Find ALL occurrences of client name in original text ═══
    # v18.7 FIX: The old code only found the FIRST match, which was in
    # "Title: Grupo Excelsior Data Protection..." (no comma after = no descriptor).
    # The descriptor "one of Mexico's leading dairy producers" was in the SECOND
    # match inside "Summary: Advised Grupo Excelsior, one of Mexico's..."
    orig_lower = original_raw.lower()
    client_lower = client_clean.lower()
    
    # Collect ALL positions where client name appears
    positions = []
    search_start = 0
    while True:
        pos = orig_lower.find(client_lower, search_start)
        if pos == -1:
            break
        positions.append(pos)
        search_start = pos + 1
    
    # If no exact match, try partial match
    if not positions:
        parts = client_clean.split()
        for p in parts:
            if len(p) > 3 and p[0].isupper():
                search_start = 0
                while True:
                    pos = orig_lower.find(p.lower(), search_start)
                    if pos == -1:
                        break
                    positions.append(pos)
                    search_start = pos + 1
                if positions:
                    client_lower = p.lower()
                    break
    
    if not positions:
        return enhanced_text
    
    # ═══ Step 2: Extract descriptor phrase after client name ═══
    # v18.7 FIX: Try ALL positions, pick the first one with a comma-delimited descriptor.
    # Position 0 is typically "Title: Grupo Excelsior Data Protection..." (no comma)
    # Position 1+ is typically "Summary: Advised Grupo Excelsior, one of Mexico's..." (HAS comma)
    descriptor = ""
    for pos in positions:
        after_client_start = pos + len(client_lower)
        remaining_orig = original_raw[after_client_start:]
        
        # Pattern A: "ClientName, descriptor phrase, ..." (comma-delimited)
        if remaining_orig.lstrip().startswith(','):
            remaining_trimmed = remaining_orig.lstrip()[1:].strip()
            # Find end of descriptor — first clause boundary
            end_markers = [', on ', ', in the ', ', to ', ', for ', '. ', ', has ', ', was ', ', is ',
                          ', instructed ', ', engaged ', ', entered ', ', retained ']
            end_pos = len(remaining_trimmed)
            for marker in end_markers:
                mp = remaining_trimmed.lower().find(marker)
                if mp != -1 and mp < end_pos and mp > 5:  # at least 5 chars of descriptor
                    end_pos = mp
            candidate = remaining_trimmed[:end_pos].strip()
            if candidate and len(candidate) >= 5:
                descriptor = candidate
                break  # Found a good descriptor — stop searching
        
        # Pattern B: "ClientName — descriptor" (em dash)
        elif remaining_orig.lstrip().startswith('-') or remaining_orig.lstrip().startswith('—'):
            remaining_trimmed = remaining_orig.lstrip().lstrip('-—').strip()
            end_pos = remaining_trimmed.find('.')
            if end_pos == -1:
                end_pos = len(remaining_trimmed)
            candidate = remaining_trimmed[:end_pos].strip()
            if candidate and len(candidate) >= 5:
                descriptor = candidate
                break
    
    if not descriptor or len(descriptor) < 5:
        return enhanced_text
    
    # ═══ Step 3: Extract identity-bearing words from the descriptor ═══
    # Comprehensive list of words that carry client identity
    industry_terms = {
        # Sectors
        'dairy', 'pharmaceutical', 'retail', 'hospitality', 'engineering',
        'manufacturing', 'automotive', 'infrastructure', 'energy', 'transport',
        'transportation', 'mining', 'oil', 'gas', 'telecommunications', 'technology',
        'banking', 'insurance', 'reinsurance', 'agriculture', 'food', 'beverage',
        'construction', 'media', 'entertainment', 'healthcare', 'health',
        'chemical', 'textile', 'logistics', 'shipping', 'aviation', 'aerospace',
        'steel', 'cement', 'plastics', 'electronics', 'software',
        'consulting', 'financial', 'investment', 'consumer', 'industrial',
        'advertising', 'marketing', 'information', 'services', 'experience',
        'education', 'defense', 'agriculture', 'forestry', 'fishing',
        'communications', 'digital', 'biotechnology', 'cosmetics', 'fashion',
        # Organization types
        'producer', 'producers', 'manufacturer', 'manufacturers', 'chain',
        'group', 'conglomerate', 'corporation', 'provider', 'providers',
        'distributor', 'operator', 'developer', 'contractor',
        # Qualifiers that describe identity
        'diversified', 'leading', 'largest', 'major', 'premier', 'top',
        'first', 'oldest', 'multinational', 'international', 'domestic',
        'independent', 'private', 'public', 'state-owned', 'family-owned',
        # Time-based descriptors
        'decades', 'years', 'century', 'established',
        # Multi-word phrase components
        'call', 'center', 'real', 'estate', 'private', 'equity',
        'venture', 'capital', 'natural', 'resources', 'public', 'sector',
    }
    
    descriptor_lower = descriptor.lower()
    # Extract matching words
    descriptor_words = [w for w in descriptor_lower.split() if w in industry_terms]
    
    # Also check multi-word phrases
    multi_word_phrases = [
        'call center', 'real estate', 'private equity', 'venture capital',
        'natural resources', 'public sector', 'oil and gas', 'food and beverage',
    ]
    matching_phrases = [p for p in multi_word_phrases if p in descriptor_lower]
    
    # Combine: each matching phrase counts as 2 identity signals
    identity_score = len(descriptor_words) + len(matching_phrases) * 2
    
    if identity_score == 0:
        return enhanced_text
    
    # ═══ Step 4: Check if identity words survived in enhanced text ═══
    enhanced_lower = enhanced_text.lower()
    
    # Count preserved words
    preserved_words = [w for w in descriptor_words if w in enhanced_lower]
    preserved_phrases = [p for p in matching_phrases if p in enhanced_lower]
    preserved_score = len(preserved_words) + len(preserved_phrases) * 2
    
    preservation_ratio = preserved_score / max(identity_score, 1)
    
    if preservation_ratio >= 0.5:  # 50%+ of identity preserved = OK
        return enhanced_text
    
    # ═══ Step 5: REPAIR — splice the original descriptor back in ═══
    enh_pos = enhanced_lower.find(client_lower)
    if enh_pos == -1:
        parts = client_clean.split()
        for p in parts:
            if len(p) > 3:
                enh_pos = enhanced_lower.find(p.lower())
                if enh_pos != -1:
                    break
    
    if enh_pos == -1:
        return enhanced_text
    
    # Find end of client name in enhanced text
    enh_after = enh_pos + len(client_lower)
    enh_remaining = enhanced_text[enh_after:]
    
    # Replace existing (generic) descriptor with original descriptor
    if enh_remaining.lstrip().startswith(','):
        offset = len(enh_remaining) - len(enh_remaining.lstrip())
        rest = enh_remaining.lstrip()[1:].strip()
        
        # Find end of existing generic descriptor
        end_markers = [', on ', ', to ', ', for ', '. ', ', has ', ', was ', ', is ',
                       ', plays', ', engaged', ', entered', ', undertook', ', retained']
        end_pos = len(rest)
        for marker in end_markers:
            mp = rest.lower().find(marker)
            if mp != -1 and mp < end_pos and mp > 3:
                end_pos = mp
        
        old_descriptor = rest[:end_pos]
        
        # Reconstruct with original descriptor
        repaired = (
            enhanced_text[:enh_after] + 
            ', ' + descriptor + 
            rest[end_pos:]
        )
        
        lost = [w for w in descriptor_words if w not in enhanced_lower]
        print(f"  [DESCRIPTOR REPAIR v17.6] Client '{client_clean}'")
        print(f"    Replaced: \"{old_descriptor[:80]}\"")
        print(f"    With:     \"{descriptor[:80]}\"")
        print(f"    Lost words: {lost}")
        return repaired
    
    return enhanced_text


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
    
    # Strategy 1: Direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[SAFE_JSON_LOADS] Strategy 1 failed: {e}")
    
    # Strategy 2: Find the first complete JSON object by brace matching
    try:
        start_idx = cleaned.index('{')
        depth = 0
        in_string = False
        escape_next = False
        end_idx = start_idx
        for i in range(start_idx, len(cleaned)):
            c = cleaned[i]
            if escape_next:
                escape_next = False
                continue
            if c == '\\' and in_string:
                escape_next = True
                continue
            if c == '"' and not escape_next:
                in_string = not in_string
                continue
            if not in_string:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        end_idx = i + 1
                        break
        if end_idx > start_idx:
            json_str = cleaned[start_idx:end_idx]
            result = json.loads(json_str)
            print(f"[SAFE_JSON_LOADS] Strategy 2 succeeded: extracted {len(json_str)} chars")
            return result
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[SAFE_JSON_LOADS] Strategy 2 failed: {e}")
    
    # Strategy 3: ASCII replacement (handles encoding issues)
    try:
        safe_text = cleaned.encode('utf-8', errors='replace').decode('utf-8')
        return json.loads(safe_text)
    except (json.JSONDecodeError, UnicodeError):
        pass
    
    # Strategy 4: Regex extraction
    try:
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            return json.loads(match.group())
    except (json.JSONDecodeError, AttributeError):
        pass
    
    # Strategy 5: If truncated JSON, try to repair by closing open braces/brackets
    try:
        # Find the first '{' and try to close all open structures
        json_start = cleaned.index('{')
        partial = cleaned[json_start:]
        # Count unclosed braces and brackets
        open_braces = partial.count('{') - partial.count('}')
        open_brackets = partial.count('[') - partial.count(']')
        # Check if we're inside a string (odd number of unescaped quotes)
        if open_braces > 0 or open_brackets > 0:
            repaired = partial
            # Close any open string
            quote_count = len(re.findall(r'(?<!\\)"', repaired))
            if quote_count % 2 != 0:
                repaired += '"'
            # Close brackets then braces
            repaired += ']' * max(0, open_brackets)
            repaired += '}' * max(0, open_braces)
            result = json.loads(repaired)
            print(f"[SAFE_JSON_LOADS] Strategy 5 succeeded: repaired truncated JSON ({open_braces} braces, {open_brackets} brackets closed)")
            return result
    except (json.JSONDecodeError, ValueError):
        pass
    
    print(f"[SAFE_JSON_LOADS] ALL strategies failed. Content length: {len(cleaned)} chars")
    print(f"[SAFE_JSON_LOADS] First 300 chars: {cleaned[:300]}")
    print(f"[SAFE_JSON_LOADS] Last 200 chars: {cleaned[-200:]}")
    return fallback or {}

def get_model():
    """
    v18.0: Migrated from GPT-4o to GPT-5.6-terra.
    
    BREAKING CHANGE: logit_bias is NOT supported by GPT-5.6-terra (API returns
    error 400: "Unsupported parameter"). Filler word defense now relies on:
      - Layer 2: Prompt rules with few-shot examples (suggestive)
      - Layer 3: strip_fillers() — 45+ regex patterns (DETERMINISTIC)
      - Layer 4: verify_client_descriptors() (DETERMINISTIC)
    
    NEW: reasoning_effort parameter controls depth of internal reasoning.
    Configurable via REASONING_EFFORT env var (none/low/medium/high/xhigh/max).
    Model configurable via OPENAI_MODEL env var for easy A/B testing & rollback.
    """
    model_name = os.environ.get("OPENAI_MODEL", "gpt-5.6-terra")
    reasoning = os.environ.get("REASONING_EFFORT", "medium")
    
    kwargs = {
        "model_name": model_name,
        "temperature": 0.0,
        "max_tokens": 8192,
        "request_timeout": 300,
        "openai_api_key": os.environ.get("OPENAI_API_KEY"),
    }
    
    # reasoning_effort only supported on GPT-5.x models
    if "gpt-5" in model_name:
        kwargs["model_kwargs"] = {"reasoning_effort": reasoning}
    # logit_bias only supported on GPT-4o/4.1 (legacy fallback)
    elif "gpt-4o" in model_name or "gpt-4.1" in model_name:
        kwargs["model_kwargs"] = {"logit_bias": {
            "96138": -100, "77640": -100, "124315": -100,
            "103445": -100, "79130": -100, "144018": -100,
            "68202": -100, "111864": -100, "168008": -100,
        }}
    
    return ChatOpenAI(**kwargs)


def invoke_with_retry(chain, input_data, max_retries=3, base_delay=5):
    """v18.0: Retry wrapper for unstable connections.
    Uses exponential backoff: 5s → 10s → 20s.
    Catches API timeouts and connection errors that occur with
    unstable internet — especially critical for GPT-5.6-terra
    which generates denser outputs than GPT-4o."""
    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except Exception as e:
            err_str = str(e).lower()
            is_retriable = any(kw in err_str for kw in [
                "timeout", "connection", "reset by peer", "broken pipe",
                "eof", "timed out", "network", "ssl", "connectionerror",
                "server_error", "502", "503", "529"
            ])
            if not is_retriable or attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"[RETRY v18.0] Attempt {attempt+1}/{max_retries} failed: {type(e).__name__}")
            print(f"[RETRY v18.0] Retrying in {delay}s...")
            time.sleep(delay)

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
    
    # =====================================================
    # v17.3: EXTRACT ORIGINAL B10/B7 DEPARTMENT NARRATIVE
    # Preserve the firm's original prose for the B7 Enhancement Pipeline.
    # This text is the FOUNDATION — it must never be summarized.
    # =====================================================
    original_b10 = ""
    try:
        import re as _re
        # Look for B10/B7 section headers in the raw text
        # Chambers uses "B10 What is this department best known for"
        # Some forms use "B7 What is this department best known for"
        # IMPORTANT: Do NOT match "B7 Head or Heads of department" — that's the contacts section
        b10_pattern = _re.search(
            r'B(?:10|7)\s+What is this department best known for.*?\n',
            text, _re.IGNORECASE
        )
        if b10_pattern:
            start_idx = b10_pattern.end()
            # Find the end: next section (C1, D., or another B section)
            end_pattern = _re.search(
                r'\n\s*(?:C1\s|C\.\s|D\.\s|B8\s|B9\s|Publishable|CONFIDENTIAL)',
                text[start_idx:], _re.IGNORECASE
            )
            if end_pattern:
                original_b10 = text[start_idx:start_idx + end_pattern.start()].strip()
            else:
                # Take up to 3000 chars as safety
                original_b10 = text[start_idx:start_idx + 3000].strip()
            
            # Clean up: remove header repetitions and instruction text
            original_b10 = _re.sub(
                r'(?:Please include:.*?word count limit\)?|Address any feedback.*?word count limit\)?)',
                '', original_b10, flags=_re.IGNORECASE | _re.DOTALL
            ).strip()
            
            if original_b10:
                b10_words = len(original_b10.split())
                print(f"[B10 EXTRACTOR] ✅ Extracted original department narrative: {b10_words} words")
                manifest["original_b10_words"] = b10_words
            else:
                print("[B10 EXTRACTOR] Section found but empty after cleanup")
        else:
            print("[B10 EXTRACTOR] No B10/B7 section header found in document")
    except Exception as b10_err:
        print(f"[B10 EXTRACTOR] Warning: {b10_err}")
    
    return {
        "doc_text": text,
        "original_b10": original_b10,
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
    manifest.setdefault("validation", {})["extraction_match"] = extraction_validation["match"]
    manifest.setdefault("validation", {})["matter_loss"] = extraction_validation["loss_count"]

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
        # v18.1: ALWAYS prefer DOCX-detected jurisdiction over UI dropdown.
        # The UI dropdown has the REGION (e.g., "Latin America") but the DOCX
        # template has the actual COUNTRY (e.g., "Mexico City and Houston").
        # The country-level jurisdiction is critical for market analysis.
        generic_regions = ["latin america", "europe", "asia", "global", "africa", "middle east", "north america"]
        user_is_generic = user_jurisdiction.lower().strip() in generic_regions if user_jurisdiction else True
        if detected_jurisdiction:
            if not user_jurisdiction or user_is_generic:
                pre_flight["auto_corrections"]["jurisdiction"] = detected_jurisdiction
                print(f"[PRE-FLIGHT 🌎] JURISDICTION UPGRADE: '{user_jurisdiction}' → '{detected_jurisdiction}' (DOCX template has country-level data)")
        
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
    
    # v18.1: Apply auto-corrections to submission_context so downstream nodes use the corrected values
    auto_corrections = pre_flight.get("auto_corrections", {})
    updated_context = dict(state.get("submission_context", {}))
    if auto_corrections.get("jurisdiction"):
        old_j = updated_context.get("jurisdiction", "")
        updated_context["jurisdiction"] = auto_corrections["jurisdiction"]
        print(f"[PRE-FLIGHT 🌎] submission_context.jurisdiction CORRECTED: '{old_j}' → '{auto_corrections['jurisdiction']}'")
    if auto_corrections.get("practice_area"):
        updated_context["practice_area"] = auto_corrections["practice_area"]
    
    return {
        "pipeline_manifest": manifest,
        "submission_context": updated_context,
        "current_step": "context"
    }

# 2.5 CONTEXT ENGINE NODE (8-Layer Methodology)
def context_engine_node(state: AgentState) -> Dict:
    submission_context = state.get("submission_context", {})
    # v18.1: Resolve jurisdiction with correct priority:
    # 1. DOCX-detected (from pre_flight auto_corrections, now in submission_context)
    # 2. AI extraction from metadata.location
    # 3. User UI dropdown (may be generic region like "Latin America")
    metadata_location = state.get("metadata", {}).get("location", "")
    context_jurisdiction = submission_context.get("jurisdiction", "")
    generic_regions = ["latin america", "europe", "asia", "global", "africa", "middle east", "north america"]
    
    # If context_jurisdiction is a generic region and we have a specific location from AI, prefer AI
    if context_jurisdiction.lower().strip() in generic_regions and metadata_location:
        jurisdiction = metadata_location
        print(f"[CONTEXT ENGINE 🌎] Using AI-detected location '{metadata_location}' over generic region '{context_jurisdiction}'")
    else:
        jurisdiction = context_jurisdiction
    
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
    
    # v16.0: RANKING ARCHITECTURE VALIDATION LAYER (RAVL)
    ranking_arch = get_ranking_architecture(
        directory, "", jurisdiction, practice_area
    )
    strategic_context["ranking_architecture"] = {
        "scenario": ranking_arch.get("scenario", "D"),
        "ranking_type": ranking_arch.get("ranking_type", "unknown"),
        "firm_bands_exist": ranking_arch.get("firm_bands_exist", False),
        "editorial_guidance": ranking_arch.get("editorial_guidance", ""),
        "benchmark_prohibited_phrases": ranking_arch.get("benchmark_prohibited_phrases", []),
    }
    
    # v16.0: If RAVL scenario is B (individuals only), override benchmark to prevent invention
    if ranking_arch.get("scenario") == "B":
        strategic_context["benchmark_reference"] = ranking_arch.get("editorial_guidance", benchmark)
        strategic_context["benchmark_available"] = False
        print(f"[RAVL] Scenario B: individuals_only — firm band benchmarks PROHIBITED")
    elif ranking_arch.get("scenario") == "C":
        strategic_context["benchmark_reference"] = "No ranking exists for this combination. Focus on evidence quality."
        strategic_context["benchmark_available"] = False
        print(f"[RAVL] Scenario C: no ranking exists — all benchmarks PROHIBITED")
    elif ranking_arch.get("scenario") == "D":
        strategic_context["benchmark_available"] = False
        print(f"[RAVL] Scenario D: unknown — defaulting to no benchmark")
    
    # =====================================================
    # v17.2: LIVE BENCHMARK ENGINE — INTELLIGENT JURISDICTION RESOLUTION
    # 1. Try exact jurisdiction first (e.g., "Venezuela")
    # 2. If miss AND jurisdiction is regional (e.g., "Latin America"),
    #    scan URL map for sub-jurisdictions under same practice area
    # 3. If firm found in benchmark, AUTO-DETECT current band
    # 4. Override user-declared "Unranked" with verified band
    # =====================================================
    firm_name = submission_context.get("firm_name", "")
    live_benchmark = None
    resolved_jurisdiction = jurisdiction  # Track which jurisdiction resolved
    
    try:
        # Step 1: Try exact jurisdiction
        live_benchmark = scrape_rankings(directory, practice_area, jurisdiction)
        
        # Step 2: If miss and jurisdiction is regional, try sub-jurisdictions
        if not live_benchmark and jurisdiction.lower() in [
            "latin america", "europe", "asia pacific", "global", 
            "middle east", "africa", "caribbean"
        ]:
            print(f"[BENCHMARK RESOLVER] Regional jurisdiction '{jurisdiction}' — scanning for country-level URLs...")
            url_map = {}
            config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "benchmark_url_map.json")
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    url_map = json.load(f)
            except Exception:
                pass
            
            # Find all country-level entries for this practice area
            from utils.benchmark_scraper import _normalize_practice_area
            practice_normalized = _normalize_practice_area(practice_area)
            dir_section = url_map.get("chambers", {}) if "chambers" in directory.lower() else url_map.get("legal500", {})
            
            candidate_jurisdictions = []
            for map_key in dir_section.keys():
                if "|" in map_key:
                    map_practice, map_jurisdiction = map_key.split("|", 1)
                    if map_practice.lower() == practice_normalized.lower():
                        candidate_jurisdictions.append(map_jurisdiction)
            
            if candidate_jurisdictions:
                print(f"[BENCHMARK RESOLVER] Found {len(candidate_jurisdictions)} candidates: {candidate_jurisdictions}")
                
                # Scrape ALL candidates and pick the one containing the firm
                all_benchmarks = {}
                for candidate in candidate_jurisdictions:
                    bm = scrape_rankings(directory, practice_area, candidate)
                    if bm:
                        all_benchmarks[candidate] = bm
                        # Check if THIS benchmark contains our firm
                        if firm_name:
                            firm_lower_check = firm_name.lower().strip()
                            for rf in bm.get("firms", []):
                                rn = rf.get("name", "").lower().strip()
                                if firm_lower_check in rn or rn in firm_lower_check:
                                    # PRIORITY: use THIS jurisdiction because it has our firm
                                    live_benchmark = bm
                                    resolved_jurisdiction = candidate
                                    print(f"[BENCHMARK RESOLVER] ✅ FIRM MATCH: '{firm_name}' found in {candidate} → using this jurisdiction")
                                    break
                        if live_benchmark:
                            break
                
                # If no firm match found, use the first available benchmark as context
                if not live_benchmark and all_benchmarks:
                    first_key = list(all_benchmarks.keys())[0]
                    live_benchmark = all_benchmarks[first_key]
                    resolved_jurisdiction = first_key
                    print(f"[BENCHMARK RESOLVER] No firm match — using first available: '{first_key}'")
            else:
                print(f"[BENCHMARK RESOLVER] No candidate sub-jurisdictions found for {practice_normalized}")
        
        if live_benchmark:
            benchmark_summary = get_benchmark_summary(live_benchmark)
            strategic_context["live_benchmark"] = live_benchmark
            strategic_context["benchmark_reference"] = benchmark_summary
            strategic_context["benchmark_available"] = True
            strategic_context["benchmark_source"] = "live_scrape"
            strategic_context["resolved_jurisdiction"] = resolved_jurisdiction
            
            # Override RAVL scenario with real data
            live_structure = live_benchmark.get("structure", {})
            strategic_context["ranking_architecture"]["firm_bands_exist"] = live_structure.get("has_firm_bands", False)
            strategic_context["ranking_architecture"]["live_enriched"] = True
            
            if not live_structure.get("has_firm_bands", False) and live_structure.get("has_individual_bands", False):
                strategic_context["ranking_architecture"]["scenario"] = "B"
                strategic_context["ranking_architecture"]["ranking_type"] = "individuals_only"
            elif live_structure.get("has_firm_bands", False):
                strategic_context["ranking_architecture"]["scenario"] = "A"
                strategic_context["ranking_architecture"]["ranking_type"] = "firms_and_individuals"
            
            print(f"[LIVE BENCHMARK ✅] Enriched with REAL data from {live_benchmark.get('source', '?')}")
            print(f"[LIVE BENCHMARK] Firms: {live_benchmark.get('total_firms', 0)} | "
                  f"Individuals: {live_benchmark.get('total_individuals', 0)} | "
                  f"Firm bands: {live_structure.get('firm_bands', [])}")
            
            # =====================================================
            # v17.2: AUTO-DETECT CURRENT BAND FROM LIVE BENCHMARK
            # Search for the submission firm in the benchmark data
            # Override user-declared band with verified band
            # =====================================================
            if firm_name and live_benchmark.get("firms"):
                firm_lower = firm_name.lower().strip()
                detected_band = None
                matched_firm_name = None
                
                for ranked_firm in live_benchmark["firms"]:
                    ranked_name = ranked_firm.get("name", "").lower().strip()
                    # Fuzzy match: check if firm name is contained or vice versa
                    if (firm_lower in ranked_name or ranked_name in firm_lower or
                        # Also try without common suffixes
                        firm_lower.replace(",", "").replace(".", "").split()[0] in ranked_name):
                        detected_band = ranked_firm.get("band", "")
                        matched_firm_name = ranked_firm.get("name", "")
                        break
                
                if detected_band:
                    print(f"[BAND AUTO-DETECT ✅] Found '{matched_firm_name}' in {detected_band}")
                    print(f"[BAND AUTO-DETECT] Overriding user-declared '{current_status}' → '{detected_band}'")
                    
                    # Override strategic context
                    strategic_context["current_status"] = detected_band
                    strategic_context["verified_band"] = detected_band
                    strategic_context["band_source"] = "live_benchmark"
                    strategic_context["user_declared_band"] = current_status
                    
                    # Re-classify starting_position based on real band
                    band_lower = detected_band.lower()
                    if "1" in band_lower:
                        starting_position = "Defensive Leadership"
                    elif "2" in band_lower or "3" in band_lower:
                        starting_position = "Upper Tier Push"
                    elif "4" in band_lower or "5" in band_lower:
                        starting_position = "Lower Tier Consolidation"
                    
                    strategic_context["starting_position"] = starting_position
                    print(f"[BAND AUTO-DETECT] Starting position reclassified: '{starting_position}'")
                else:
                    print(f"[BAND AUTO-DETECT] Firm '{firm_name}' NOT found in benchmark — keeping user-declared '{current_status}'")
                    # Check individuals too
                    for ranked_ind in live_benchmark.get("individuals", []):
                        ind_firm = ranked_ind.get("firm", "").lower().strip()
                        if firm_lower in ind_firm or ind_firm in firm_lower:
                            print(f"[BAND AUTO-DETECT] Found firm in INDIVIDUALS: {ranked_ind.get('name', '')} ({ranked_ind.get('firm', '')}) — {ranked_ind.get('band', '')}")
                            if not detected_band:
                                # Use the individual's category to infer firm presence
                                strategic_context["firm_has_ranked_individuals"] = True
                                strategic_context["individual_band_evidence"] = ranked_ind.get("band", "")
                            break
        else:
            strategic_context["benchmark_source"] = "ravl_static"
            print(f"[LIVE BENCHMARK] No live data available — using RAVL static config")
    except Exception as e:
        strategic_context["benchmark_source"] = "ravl_static"
        print(f"[LIVE BENCHMARK] Scraping failed (graceful fallback): {e}")
    
    print(f"[DIRECTORY ROUTER] Directory: {dir_config['name']} | Ranking unit: {dir_config['ranking_unit']} | Template: {dir_config['export_template']}")
    # v17.4c: Print from UPDATED strategic_context (post live-scrape), not old static ranking_arch
    final_ravl = strategic_context.get("ranking_architecture", {})
    print(f"[RAVL FINAL] Scenario={final_ravl.get('scenario', '?')} | Firm bands={final_ravl.get('firm_bands_exist', False)} | Type={final_ravl.get('ranking_type', '?')} | Live={final_ravl.get('live_enriched', False)}")
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

RANKING ARCHITECTURE VALIDATION LAYER (v17.4 — RAVL):
"""
    # v17.4: 4-Scenario Ranking Architecture Validation
    strategic_context = state.get("strategic_context", {})
    ravl = strategic_context.get("ranking_architecture", {})
    scenario = ravl.get("scenario", "D")
    ranking_type = ravl.get("ranking_type", "unknown")
    firm_bands_exist = ravl.get("firm_bands_exist", False)
    print(f"[ANALYSIS NODE RAVL] Scenario={scenario} | Type={ranking_type} | Firm bands={firm_bands_exist} | Live={ravl.get('live_enriched', False)}")
    
    # Build scenario-specific RAVL block
    if scenario == "A" and firm_bands_exist:
        # ═══ SCENARIO A: Firm + Individual Rankings Exist ═══
        ravl_block = f"""
RANKING ARCHITECTURE (SCENARIO A — Firms + Individuals):
This practice area has BOTH firm/department rankings AND individual lawyer rankings.
- Ranking type: {ranking_type}
- Firm bands: {ravl.get('firm_bands', [])}
- Individual categories: {ravl.get('individual_categories', [])}

PERMITTED: You may compare the submission against:
- Firms actually ranked in this category and their band positions
- Editorial descriptions of ranked firms
- Types of work and sectors visible in the ranking
- Positioning and institutional depth
- Individual lawyers and their band positions

You may use phrases like "Band X firms", "peer firms", "firms in this band".
"""
    elif scenario == "B" or (not firm_bands_exist and ranking_type == "individuals_only"):
        # ═══ SCENARIO B: Only Individual Rankings Exist ═══
        ravl_block = f"""
RANKING ARCHITECTURE (SCENARIO B — Individuals Only):
This category ONLY has individual lawyer rankings. There are NO firm/department rankings.
- Ranking type: individuals_only
- Individual categories: {ravl.get('individual_categories', [])}
- Firms ranked: ZERO. The category does NOT rank departments or firms.

=== ABSOLUTE PROHIBITION (CONSTITUTIONAL RULE) ===
You are FORBIDDEN from using ANY of the following phrases or concepts:
- "Band X firms" (no firm bands exist)
- "peer firms" (there is no peer set of firms)
- "entry-level firm bands" (no firm bands exist at any level)
- "firms currently positioned in Band..." (no firms are positioned)
- "firm ranking" or "departmental ranking" (does not exist)
- "the firm would need to compete with Band X firms" (impossible — no firm bands)
- "threshold for entry-level recognition" as a firm (no firm entry exists)

=== WHAT YOU MUST DO INSTEAD ===
1. Acknowledge that this category currently contains ONLY individual lawyer rankings
2. Analyze whether the submission demonstrates an INSTITUTIONAL practice capable of supporting FUTURE departmental recognition
3. Contrast the firm's lawyers against the individuals currently recognised (by name and band)
4. Evaluate if the submission shows a practice beyond one or two individual lawyers
5. Identify what evidence supports a future departmental candidacy
6. Frame recommendations around building departmental visibility, NOT achieving a non-existent band

=== CORRECT EDITORIAL FRAMING ===
Example: "Chambers Latin America currently recognises individual lawyers in Mexico for Data Protection, but does not display a departmental ranking of law firms in this category. The relevant editorial question is whether the evidence demonstrates an institutional practice capable of supporting future departmental recognition."
"""
    elif scenario == "C":
        # ═══ SCENARIO C: No Ranking Exists ═══
        ravl_block = """
RANKING ARCHITECTURE (SCENARIO C — No Ranking Exists):
No ranking exists for this exact combination of directory, guide, jurisdiction, and practice area.

=== ABSOLUTE PROHIBITION ===
- Do NOT reference any bands, tiers, peer firms, or ranked lawyers
- Do NOT invent a benchmark from general knowledge
- Do NOT say "firms in this category" — there IS no category

=== WHAT YOU MUST DO ===
1. State clearly that no direct ranking exists for this combination
2. If an adjacent category exists (same practice, different guide; related practice, same jurisdiction), identify it explicitly as a PROXY — never as direct evidence
3. Assess the submission on its own merits: evidence quality, matter significance, market presence
4. Frame as: "Should this combination be ranked? Does the evidence justify a new category?"
"""
    else:
        # ═══ SCENARIO D: Unknown / No Data ═══
        ravl_block = """
RANKING ARCHITECTURE (SCENARIO D — Unknown / No Verified Data):
RankPilot does not have verified ranking data for this combination.

=== ABSOLUTE PROHIBITION ===
- Do NOT reference any specific bands, tiers, or firm positions
- Do NOT invent benchmarks from general knowledge
- Do NOT say "Band X firms typically..." or "entry-level firms..."

=== WHAT YOU MUST DO ===
1. Evaluate the submission purely on evidence quality
2. Assess matters, clients, complexity, and narrative coherence
3. Do NOT make comparative statements about the market
4. Flag that benchmark data is unavailable and recommend verification
"""
    
    analysis_prompt = f"""{ravl_block}

{analysis_prompt}"""
    
    # ═══════════════════════════════════════════════════════════════
    # v18.0: CROSS-BORDER PROHIBITION for analysis node
    # Previously only existed in editorial_nodes._inject_directives()
    # but was MISSING here, causing GPT-5.6-terra to flag "Cross-border
    # evidence" as a gap for domestic practices like Data Protection.
    # ═══════════════════════════════════════════════════════════════
    cross_border_relevant = strategic_context.get("cross_border_relevant", True)
    if not cross_border_relevant:
        cross_border_block = """
### CROSS-BORDER PROHIBITION (CONSTITUTIONAL RULE — v18.0)
This practice area does NOT require cross-border work.
ABSOLUTE PROHIBITIONS:
- Do NOT list "cross-border" as a gap, weakness, risk, or missing element
- Do NOT mention "lacks cross-border", "zero cross-border matters", or "no cross-border evidence"
- Do NOT penalize or lower confidence because of absent cross-border work
- Do NOT recommend "expand cross-border capabilities"
- In key_evidence_gaps: Do NOT include any cross-border related gaps
- cross_border_matters count of 0 is EXPECTED and NOT a deficiency

WHAT TO DO INSTEAD:
- For domestic practices (data protection, compliance, tax, labour),
  sophisticated LOCAL mandates are MORE probative than cross-border work
- Focus on: regulatory complexity, client sophistication, market depth
"""
        analysis_prompt = f"""{cross_border_block}

{analysis_prompt}"""
        print(f"[ANALYSIS NODE v18.0] Cross-border prohibition injected (domestic practice)")
    
    # v17.0: Inject LIVE BENCHMARK context when available
    if strategic_context.get("benchmark_source") == "live_scrape":
        from agents.prompts import LIVE_BENCHMARK_CONTEXT
        benchmark_summary = strategic_context.get("benchmark_reference", "")
        live_block = LIVE_BENCHMARK_CONTEXT.replace("{live_benchmark_data}", benchmark_summary)
        live_block = live_block.replace("{source}", strategic_context.get("live_benchmark", {}).get("source", "directory"))
        analysis_prompt = f"""{live_block}

{analysis_prompt}"""
        print(f"[ANALYSIS NODE v17.0] Live benchmark context injected ({len(benchmark_summary)} chars)")
    
    # v17.0: Force JSON output mode so the LLM returns parseable JSON
    llm_json = llm.bind(response_format={"type": "json_object"})
    # Use direct message invocation (NOT ChatPromptTemplate) because analysis_prompt
    # contains JSON schemas with {} that would break template variable parsing
    from langchain_core.messages import SystemMessage, HumanMessage as HMsg
    data_str = json.dumps(input_data, indent=2, default=str, ensure_ascii=True)
    response = llm_json.invoke([
        SystemMessage(content=analysis_prompt),
        HMsg(content=f"Analyze this submission data and return your analysis as JSON:\n\n{data_str}")
    ])
    
    # v17.0: Debug — log response content stats
    response_text = response.content or ""
    finish_reason = response.response_metadata.get("finish_reason", "unknown")
    print(f"[ANALYSIS NODE] Response length: {len(response_text)} chars | finish_reason: {finish_reason}")
    if finish_reason == "length":
        print(f"[ANALYSIS NODE] ⚠️ TRUNCATED — gpt-4o hit max_tokens limit. JSON will be incomplete.")
        print(f"[ANALYSIS NODE] Consider increasing max_tokens or decomposing the output.")
    if response_text:
        print(f"[ANALYSIS NODE] First 200 chars: {response_text[:200]}")
        print(f"[ANALYSIS NODE] Last 100 chars: {response_text[-100:]}")
    
    # v10.2: VALIDATION GATE — Programmatic quality filter with auto-retry
    max_retries = 2
    attempt = 0
    last_violations = []
    
    while attempt <= max_retries:
        if attempt > 0:
            print(f"[VALIDATION GATE] Retry #{attempt}/{max_retries} — violations: {last_violations}")
            # Re-invoke the LLM with the same messages
            response = llm_json.invoke([
                SystemMessage(content=analysis_prompt),
                HMsg(content=f"Analyze this submission data and return your analysis as JSON:\n\n{data_str}")
            ])
            response_text = response.content or ""
            finish_reason = response.response_metadata.get("finish_reason", "unknown")
            print(f"[ANALYSIS NODE] Retry response length: {len(response_text)} chars | finish_reason: {finish_reason}")
            if finish_reason == "length":
                print(f"[ANALYSIS NODE] ⚠️ RETRY ALSO TRUNCATED — output too large for max_tokens")
        
        try:
            res_json = safe_json_loads(response.content, fallback={"confidence_score": 50})
            
            # v17.1: Unwrap gpt-4o's common pattern of wrapping everything in {"analysis": {...}}
            # The validation code expects score, audit_letter, etc. at the top level
            if "analysis" in res_json and isinstance(res_json["analysis"], dict):
                inner = res_json["analysis"]
                # Check if the inner dict has our expected fields but the outer doesn't
                if "score" not in res_json and ("score" in inner or "submission_summary" in inner or "firm_name" in inner):
                    print(f"[ANALYSIS NODE] Unwrapping nested 'analysis' wrapper (gpt-4o json_object mode artifact)")
                    # Promote inner keys to top level, preserving any top-level keys
                    for k, v in inner.items():
                        if k not in res_json:
                            res_json[k] = v
                    # Also check for score in editorial_confidence
                    if "score" not in res_json:
                        ec = inner.get("editorial_confidence", {})
                        if isinstance(ec, dict):
                            for score_key in ["overall_score", "confidence_score", "score"]:
                                if score_key in ec and isinstance(ec[score_key], (int, float)):
                                    res_json["score"] = ec[score_key]
                                    print(f"[SCORE FIX] Extracted score={ec[score_key]} from editorial_confidence.{score_key}")
                                    break
            
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
            expected_count = len(all_matters)  # v17.1: Define for validation checks
            
            # CHECK 1: Matter Evaluations Completeness
            # v17.0: SKIPPED — matter_evaluations are now generated in Call 2 (separate LLM call)
            # This check was causing 3 unnecessary retries per pipeline run
            # The eval count is verified after Call 2 merges results
            eval_count = len(res_json.get("matter_evaluations", []))
            if eval_count == 0:
                # Fallback: check inside audit_letter where the prompt schema actually places them
                audit_evals = res_json.get("audit_letter", {}).get("matter_evaluations", []) if isinstance(res_json.get("audit_letter"), dict) else []
                if audit_evals:
                    # Promote to root level so downstream code finds them
                    res_json["matter_evaluations"] = audit_evals
                    eval_count = len(audit_evals)
            # v17.0: Don't fail on missing evals — Call 2 will provide them
            
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
            
            # CHECK 5: Score is present and numeric — search multiple possible locations
            score = res_json.get("score")
            if score is None or (isinstance(score, (int, float)) and score == 0):
                # gpt-4o sometimes nests the score inside 'analysis', 'audit_letter', or 'editorial_confidence'
                for nested_key in ["analysis", "audit_letter", "editorial_confidence"]:
                    nested = res_json.get(nested_key, {})
                    if isinstance(nested, dict):
                        for score_key in ["score", "confidence_score", "overall_score", "editorial_score"]:
                            found = nested.get(score_key)
                            if found and isinstance(found, (int, float)) and found > 0:
                                score = found
                                res_json["score"] = score  # Promote to top level
                                print(f"[SCORE FIX] Found score={score} inside '{nested_key}.{score_key}', promoted to top level")
                                break
                    if score and isinstance(score, (int, float)) and score > 0:
                        break
            if score is None or (isinstance(score, (int, float)) and score == 0):
                # v17.1.2: Derive score from editorial_confidence — check BOTH res_json AND pipeline state
                # gpt-4o's analysis response rarely has editorial_confidence, but the pipeline state always does
                ec = res_json.get("editorial_confidence", {})
                if not isinstance(ec, dict) or not ec:
                    # Fallback: get from pipeline state (editorial_confidence is a separate upstream node)
                    ec = state.get("editorial_confidence", {})
                if isinstance(ec, dict):
                    confidence_map = {"high": 80, "moderate": 65, "low": 45, "limited": 30, "very high": 90, "insufficient": 35}
                    overall = str(ec.get("overall_confidence", "")).lower().strip()
                    if overall in confidence_map:
                        score = confidence_map[overall]
                        res_json["score"] = score
                        print(f"[SCORE DERIVED] Derived score={score} from editorial_confidence.overall_confidence='{overall}' (source: {'res_json' if res_json.get('editorial_confidence') else 'pipeline_state'})")
                    else:
                        # Try numeric scores from editorial_confidence dimensions
                        dim_scores = []
                        for dim_key in ["evidence_completeness_score", "matter_quality_score", "leadership_visibility_score",
                                       "narrative_cohesion_score", "differentiation_score", "institutional_depth_score"]:
                            ds = ec.get(dim_key)
                            if isinstance(ds, (int, float)) and ds > 0:
                                dim_scores.append(ds)
                        if dim_scores:
                            score = int(sum(dim_scores) / len(dim_scores))
                            res_json["score"] = score
                            print(f"[SCORE DERIVED] Derived score={score} from {len(dim_scores)} editorial_confidence dimension averages")
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
    
    # ═══════════════════════════════════════════════════════════════
    # v17.0 CALL 2: MATTER EVALUATIONS (separate LLM call)
    # Prevents JSON truncation by keeping each call under max_tokens
    # ═══════════════════════════════════════════════════════════════
    if all_matters and len(all_matters) > 0:
        print(f"[ANALYSIS NODE] Call 2: Generating matter evaluations for {len(all_matters)} matters...")
        try:
            from agents.prompts import MATTER_EVALUATIONS_PROMPT
            
            # Prepare matter data for evaluation
            matter_data = []
            for m in all_matters:
                if isinstance(m, dict):
                    matter_data.append({
                        "title": m.get("title", ""),
                        "client": m.get("client", ""),
                        "value": m.get("value", ""),
                        "summary": m.get("summary", ""),
                        "significance": m.get("significance", ""),
                        "lead_partner": m.get("lead_partner", ""),
                        "publish_status": m.get("publish_status", "non_publishable"),
                        "raw_text": m.get("raw_text", ""),
                    })
            
            eval_prompt_text = MATTER_EVALUATIONS_PROMPT.replace("{matter_count}", str(len(all_matters)))
            eval_prompt = ChatPromptTemplate.from_messages([
                ("system", eval_prompt_text),
                ("human", "Evaluate these matters and return JSON:\n{data}")
            ])
            
            eval_chain = eval_prompt | llm_json
            eval_response = eval_chain.invoke({"data": json.dumps(matter_data, indent=2, default=str, ensure_ascii=False)})
            
            eval_finish = eval_response.response_metadata.get("finish_reason", "unknown")
            print(f"[ANALYSIS NODE] Call 2 response: {len(eval_response.content or '')} chars | finish_reason: {eval_finish}")
            if eval_finish == "length":
                print(f"[ANALYSIS NODE] ⚠️ Call 2 ALSO TRUNCATED — matter evaluations may be incomplete")
            
            eval_json = safe_json_loads(eval_response.content, fallback={})
            
            # Merge matter evaluations into audit_letter
            matter_evals = eval_json.get("matter_evaluations", [])
            recommended_rewrites = eval_json.get("recommended_rewrites", [])
            
            if matter_evals:
                print(f"[ANALYSIS NODE] ✅ Call 2 SUCCESS: {len(matter_evals)} matter evaluations generated")
                # Apply confidentiality guardrail to evaluations
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
                
                # Merge into res_json — both at root level AND inside audit_letter
                res_json["matter_evaluations"] = matter_evals
                if isinstance(res_json.get("audit_letter"), dict):
                    res_json["audit_letter"]["matter_evaluations"] = matter_evals
                    if recommended_rewrites:
                        res_json["audit_letter"]["recommended_rewrites"] = recommended_rewrites
                res_json["recommended_rewrites"] = recommended_rewrites
            else:
                print(f"[ANALYSIS NODE] ⚠️ Call 2 returned 0 matter evaluations")
                
        except Exception as e:
            print(f"[ANALYSIS NODE] ⚠️ Call 2 failed: {e}")
            # Non-fatal — continue with empty evaluations
    
    # v16.0: POST-VALIDATION GATES — Programmatic enforcement
    strategic_context = state.get("strategic_context", {})
    res_json, validation_report = validate_analysis_output(res_json, strategic_context)
    
    # Store validation report in manifest for transparency
    if manifest:
        manifest["v16_validation_report"] = validation_report
    
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
    # v18.6: Detect constitutional validation retry
    constitutional_retry = state.get("constitutional_retry_count", 0)
    violation_feedback = state.get("constitutional_violation_feedback", "")
    if constitutional_retry > 0:
        print(f"--- OPTIMIZING MATTERS (CONSTITUTIONAL RETRY {constitutional_retry}/2) ---")
        print(f"  Violation feedback: {violation_feedback[:200]}...")
    else:
        print("--- OPTIMIZING MATTERS ---")
    
    matters = state.get("matters", [])

    llm = get_model()
    # Require JSON output with 'optimized_text' key
    llm = llm.bind(response_format={"type": "json_object"})
    
    optimized_matters = []
    
    # v17.4: Build dynamic context for matter enhancement
    strategic_ctx = state.get("strategic_context", {})
    narrative_arch = state.get("narrative_architecture", {})
    cross_border_relevant = strategic_ctx.get("cross_border_relevant", True)
    thesis = narrative_arch.get("thesis_statement", "")
    
    # v17.4: Dynamic injections for matter enhancer
    matter_context_lines = []
    if thesis:
        matter_context_lines.append(f"EDITORIAL THESIS: {thesis}")
        matter_context_lines.append("Connect each matter to this thesis. Each matter must demonstrate a DIFFERENT aspect of this thesis.")
    if not cross_border_relevant:
        matter_context_lines.append(
            "CROSS-BORDER PROHIBITION: This practice area does NOT require cross-border evidence. "
            "Do NOT add cross-border language, international scope claims, or multi-jurisdictional framing "
            "unless the original matter explicitly describes cross-border work."
        )
    matter_context_block = "\n".join(matter_context_lines)
    
    # v18.6: On constitutional retry, inject violation feedback
    if constitutional_retry > 0 and violation_feedback:
        matter_context_block += f"\n\n⚠️ CONSTITUTIONAL VALIDATION RETRY (attempt {constitutional_retry + 1}):\n{violation_feedback}\n\nYou MUST fix ALL listed violations in this retry. Pay special attention to:\n- Each matter must open with a DIFFERENT strategic angle (not generic mandate)\n- Do NOT use any prohibited filler phrases\n- Preserve all client descriptors VERBATIM from the original\n- Outcomes must be STRONG (quantified) or MODERATE (institutional change), never WEAK (generic benefit)"
    
    for matter in matters:
        # Construct the raw matter text to feed to the optimizer
        raw_text = f"Title: {matter.get('title', '')}\nClient: {matter.get('client', '')}\nValue: {matter.get('value', '')}\nSummary: {matter.get('summary', '')}\nSignificance: {matter.get('significance', '')}\nLead Partner: {matter.get('lead_partner', '')}"
        
        messages = [
            SystemMessage(content=MATTER_OPTIMIZER_PROMPT),
            HumanMessage(content=f"{matter_context_block}\n\nOptimize this raw matter:\n\n{raw_text}")
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
            # v17.0 FIX: Use raw_text (full matter) for entity extraction, not just summary field
            original_entities = set(_re.findall(r'\b[A-Z][A-Za-z]{2,}(?:\s+[A-Z][A-Za-z]+)*\b', raw_text))
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
                    "- The CLIENT DESCRIPTOR phrase (industry/sector description after the client name) — copy VERBATIM\n"
                    "- All monetary values with currency\n"
                    "- All jurisdictions mentioned\n"
                    "- The firm's specific role (not generic 'advised')\n"
                    "- All team members mentioned\n"
                    "- The outcome or result\n"
                    "- ALL numeric counts (e.g., '17 matters', '300 contracts', '8 years') — NEVER compress to 'various' or 'multiple'\n"
                    "- ALL named sub-entities (e.g., PUREM, Hutchison, ISOCLIMA) — preserve EVERY name\n"
                    "- Exclusivity signals (e.g., 'exclusive external counsel') — NEVER drop\n"
                    "- Duration signals (e.g., 'eight-year relationship', 'nearly five decades') — NEVER drop\n\n"
                )
                
                # v19.2: Extract and inject client descriptor as hard requirement
                client_name = matter.get("client", "")
                descriptor_match = None
                if client_name:
                    import re as _re_local
                    # Try to find the descriptor pattern: "ClientName, descriptor phrase"
                    escaped_name = _re_local.escape(client_name.split(",")[0].strip())
                    desc_pattern = _re_local.compile(
                        rf'{escaped_name}[^,]*,\s*(.+?)(?:\.|,\s*(?:on |in |for |to |with ))',
                        _re_local.IGNORECASE
                    )
                    desc_match = desc_pattern.search(raw_text)
                    if desc_match:
                        descriptor_match = desc_match.group(1).strip()
                
                if descriptor_match:
                    preservation_prompt += (
                        f"⚠️ CLIENT DESCRIPTOR (MUST APPEAR VERBATIM IN OUTPUT):\n"
                        f'"{client_name}, {descriptor_match}"\n'
                        f"This phrase MUST appear word-for-word in your enhanced text. Do NOT paraphrase it.\n\n"
                    )
                
                preservation_prompt += (
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
            optimized_text = strip_markdown(optimized_text)
            
            # v16.0: MATTER ENHANCEMENT VALIDATOR — ensure fact preservation
            # v17.0 FIX: Compare against raw_text (full matter), not just summary/significance (title-like short text)
            is_valid, enhancement_details = validate_matter_enhancement(raw_text, optimized_text)
            if not is_valid:
                print(f"  [ENHANCEMENT GATE] ⚠️ Matter '{matter.get('title', 'unknown')}' failed fact preservation check")
                print(f"  Details: {enhancement_details}")
                # Fall back to original rather than lose facts
                if enhancement_details.get('word_ratio', 1.0) < 0.5:
                    # Drastic compression — use original
                    print(f"  [ENHANCEMENT GATE] Using original text (word ratio {enhancement_details.get('word_ratio', 0):.2f} too low)")
                    optimized_text = strip_markdown(original_summary)
            
            # ═══ v17.5: FILLER STRIP — remove generic phrases ═══
            optimized_text = strip_fillers(optimized_text)
            
            # ═══ v18.8: CLIENT DESCRIPTOR VERIFICATION — programmatic repair ═══
            # This is DETERMINISTIC — extracts the client descriptor from the ORIGINAL
            # document text (not the extracted fields, which may have lost descriptors).
            # e.g., "dairy producers" → restored if LLM replaced with "prominent client"
            #
            # v18.8 ROOT CAUSE FIX: Previously used `raw_text` (built from extracted
            # fields where the extraction LLM already compressed out the descriptor).
            # Now uses `doc_text` — the ORIGINAL DOCX text which contains:
            #   "Grupo Excelsior, one of Mexico's leading dairy producers"
            # The extraction chain's `summary` field often strips this to:
            #   "Advised Grupo Excelsior on data protection..."
            # So verify_client_descriptors could never find the descriptor.
            client_name = matter.get('client', '')
            original_doc_text = state.get('doc_text', '') or raw_text
            optimized_text = verify_client_descriptors(original_doc_text, optimized_text, client_name)
            
            matter['optimized_text'] = optimized_text
            matter['status'] = 'AI Enhanced' if is_valid else 'AI Enhanced (partial)'
            
        except Exception as e:
            print(f"Error enhancing matter: {e}")
            matter['optimized_text'] = strip_markdown(matter.get('summary', ''))
            matter['status'] = 'Enhancement Failed'
            
        optimized_matters.append(matter)
    
    # ═══════════════════════════════════════════════════════════════
    # v17.0: GRAMMAR POST-PROCESSING LAYER
    # Fixes spelling, grammar, and punctuation errors in all optimized texts
    # Uses a lightweight LLM call focused ONLY on grammar correction
    # ═══════════════════════════════════════════════════════════════
    print("--- GRAMMAR CHECK ---")
    grammar_llm = get_model()
    grammar_llm = grammar_llm.bind(response_format={"type": "json_object"})
    
    grammar_fixed_count = 0
    for matter in optimized_matters:
        opt_text = matter.get('optimized_text', '')
        if not opt_text or len(opt_text) < 20:
            continue
        
        try:
            grammar_response = grammar_llm.invoke([
                SystemMessage(content=(
                    "You are a professional English proofreader. Fix ONLY grammar, spelling, "
                    "and punctuation errors. Do NOT change meaning, content, names, numbers, "
                    "or sentence structure. Do NOT add or remove information. "
                    "Return JSON: {\"corrected_text\": \"...\", \"corrections_made\": 0}"
                )),
                HumanMessage(content=f"Proofread this text:\n\n{opt_text}")
            ])
            grammar_result = safe_json_loads(grammar_response.content, fallback={})
            corrected = grammar_result.get("corrected_text", "")
            corrections = grammar_result.get("corrections_made", 0)
            
            if corrected and corrections > 0:
                matter['optimized_text'] = corrected
                grammar_fixed_count += 1
                print(f"  [GRAMMAR] Fixed {corrections} issue(s) in '{matter.get('title', '?')[:40]}'")
        except Exception as e:
            # Non-fatal — keep original optimized text
            pass
    
    if grammar_fixed_count > 0:
        print(f"[GRAMMAR] ✅ Fixed grammar in {grammar_fixed_count}/{len(optimized_matters)} matters")
    else:
        print(f"[GRAMMAR] ✅ No grammar issues found")
    
    # v17.5: Apply centralized filler strip to ALL matters
    for matter in optimized_matters:
        opt_text = matter.get('optimized_text', '')
        if opt_text:
            matter['optimized_text'] = strip_fillers(opt_text)
    
    # ═══════════════════════════════════════════════════════════════
    # v17.3: B7 ENHANCEMENT PIPELINE
    # Takes the firm's ORIGINAL B10 department narrative as the BASE
    # and uses narrative_architecture as EDITORIAL DIRECTION to produce
    # an expanded, strengthened version.
    # RULE: Output MUST be ≥100% of original word count — NEVER shorter.
    # ═══════════════════════════════════════════════════════════════
    print("--- B7 ENHANCEMENT ---")
    original_b10 = state.get("original_b10", "")
    narrative_arch = state.get("narrative_architecture", {})
    enhanced_b7 = ""
    
    if original_b10 and len(original_b10.split()) > 20:
        b7_llm = get_model()
        b7_llm = b7_llm.bind(response_format={"type": "json_object"})
        
        # Build editorial direction from narrative_architecture
        editorial_direction = []
        if narrative_arch.get("thesis_statement"):
            editorial_direction.append(f"THESIS: {narrative_arch['thesis_statement']}")
        if narrative_arch.get("positioning_statement"):
            editorial_direction.append(f"POSITIONING: {narrative_arch['positioning_statement']}")
        if narrative_arch.get("key_differentiators"):
            diffs = narrative_arch["key_differentiators"]
            if isinstance(diffs, list):
                editorial_direction.append(f"KEY DIFFERENTIATORS: {', '.join(str(d) for d in diffs)}")
        if narrative_arch.get("hero_matter"):
            editorial_direction.append(f"HERO MATTER: {narrative_arch['hero_matter']}")
        
        # Get strategic context for additional direction
        strategic_ctx = state.get("strategic_context", {})
        if strategic_ctx.get("verified_band"):
            editorial_direction.append(f"VERIFIED BAND: {strategic_ctx['verified_band']}")
        if strategic_ctx.get("resolved_jurisdiction"):
            editorial_direction.append(f"MARKET: {strategic_ctx['resolved_jurisdiction']}")
        
        # v18.5: Extract department head names for B7 partner mention
        metadata = state.get("metadata", {})
        dept_info = metadata.get("department", {})
        dept_heads = []
        if isinstance(dept_info, dict):
            raw_heads = dept_info.get("department_heads", [])
            for h in raw_heads:
                name = h.get("name", "") if isinstance(h, dict) else str(h)
                if name and name.strip():
                    dept_heads.append(name.strip())
        # Fallback: extract unique lead partners from matters
        if not dept_heads:
            matters_for_heads = state.get("matters", [])
            seen_partners = set()
            for m in matters_for_heads:
                lp = m.get("lead_partner", "")
                if lp:
                    for name in lp.split(","):
                        name = name.strip()
                        if name and name not in seen_partners:
                            seen_partners.add(name)
                            dept_heads.append(name)
        if dept_heads:
            editorial_direction.append(f"DEPARTMENT HEADS/KEY PARTNERS: {', '.join(dept_heads)}")
        
        # v18.5: Extract STRATEGIC PATTERNS from matters (not raw client lists)
        # The owner's rule: B7 = strategic proposition. Matters = evidence.
        # B7 should show PATTERNS, using 2-3 client names as EXAMPLES of those patterns.
        matters_data = state.get("matters", [])
        client_names = []
        matter_summaries = []  # condensed summaries for pattern extraction
        for m in matters_data:
            client = m.get("client", "") or m.get("title", "")
            if client and client.strip():
                client_names.append(client.strip())
            summary = m.get("summary", "") or m.get("optimized_text", "") or m.get("original_text", "")
            if summary:
                # Keep a short summary per matter for the LLM to identify patterns
                words = summary.split()
                short = ' '.join(words[:60])  # ~60 words max per matter
                matter_summaries.append(f"• {client}: {short}")
        
        # Build strategic context for pattern extraction
        strategic_matter_context = ""
        if matter_summaries:
            unique_clients = list(dict.fromkeys(client_names))
            strategic_matter_context += f"\nCLIENT PORTFOLIO ({len(unique_clients)} clients across {len(matters_data)} matters):\n"
            strategic_matter_context += ", ".join(unique_clients)
            strategic_matter_context += f"\n\nMATTER EVIDENCE (extract PATTERNS from these — do NOT list them all):\n"
            strategic_matter_context += "\n".join(matter_summaries[:8])  # cap to avoid prompt bloat
        
        print(f"[B7 ENHANCEMENT] v18.5: Injecting {len(client_names)} clients, {len(matter_summaries)} matter summaries for PATTERN extraction")
        
        editorial_direction_text = "\n".join(editorial_direction) if editorial_direction else "Enhance for Chambers editorial standards."
        
        original_word_count = len(original_b10.split())
        
        b7_enhancement_prompt = f"""You are a Chambers & Partners Senior Editor enhancing a law firm's B7 section ("What is this department best known for?").

EDITORIAL PHILOSOPHY (CONSTITUTIONAL RULE):
The objective is NOT to produce more words than the client.
The objective IS to produce more STRATEGIC DENSITY per word, preserving all relevant evidence.
B7 is the STRATEGIC PROPOSITION of the practice. The matters (listed separately) are the EVIDENCE that proves it.

You are given:
1. The ORIGINAL B7 text written by the firm (THIS IS YOUR BASE — preserve its strategic thesis)
2. Editorial direction from the AI analysis (use to sharpen the thesis)
3. Matter evidence summaries (extract PATTERNS from these — do NOT dump them as a list)

YOUR TASK — INTERPRET THE PRACTICE:
- Preserve the firm's original strategic thesis (e.g., "data protection integrated into governance" — that's GOOD, keep it)
- INTERPRET what the matters reveal about the practice's REAL differentiation
- Extract PATTERNS from the matters: recurring advisory relationships, governance integration, sector diversity, measurable outcomes, institutional capability, regulatory defence
- Use 2-3 client names as EXAMPLES that illustrate these patterns (e.g., "For [Client], the team..." or "including work for [Client] on...")
- Add Chambers-grade editorial intelligence: why this practice is positioned differently, what the evidence MEANS, not just what it IS
- Every sentence must either: (a) establish the practice's strategic thesis, (b) demonstrate a pattern with a specific example, or (c) differentiate the practice from generic descriptions

WHAT "STRATEGIC DENSITY" MEANS:
✅ GOOD: "The team positions privacy as an operational and governance issue that affects consumer relationships, regulatory exposure, internal decision-making and the integrity of information-driven business models." (INTERPRETS the practice)
❌ BAD: "The practice is widely recognised for its strategic advisory role in guiding corporations on the governance of personal data." (GENERIC — adds no intelligence)
✅ GOOD: "For Grupo Hermes, the team achieved 100% compliance across ARCO requests while embedding privacy governance within broader operational structures." (PATTERN + EXAMPLE + EVIDENCE)
❌ BAD: "The firm advises Grupo Hermes, Mega Direct, Biocodex, Hotel Riazor, Excelsior, Modelquipo, and Chedraui." (CLIENT LIST — no strategic value)

MANDATORY REQUIREMENTS:
1. Mention the lead partner or department head BY NAME (e.g., "Led by [Name], the practice...")
2. Mention AT MOST 3 client names in the entire B7. Choose the 2-3 that best ILLUSTRATE the patterns you discovered. The remaining clients are CONTEXT — they prove the pattern exists, but do NOT name them individually. If you name 4+ clients, your output has FAILED.
3. Include at least 2 specific measurable outcomes from the matters (percentages, year counts, concrete results)
4. The narrative must reveal WHY this practice is differentiated, not just WHAT it does
5. HARD CAP: Count the client names in your output BEFORE submitting. If you have named more than 3 clients, REMOVE the excess ones and refer to them generically (e.g., "across additional mandates for corporate groups in regulated sectors").

WORD COUNT:
- Your output MUST be between {max(original_word_count, 300)} and 500 words (Chambers hard limit for B7).
- Do NOT inflate word count with generic prose. If 400 words of high strategic density is better than 500 words with padding, write 400 words.

ABSOLUTE PROHIBITIONS:
- NEVER make the text shorter than the original ({original_word_count} words)
- NEVER exceed 500 words
- NEVER replace specific names with generic categories
- NEVER add meta-text ("The narrative should...", "This section highlights...")
- NEVER use promotional/generic language: "widely recognised", "particularly recognised", "strategic advisory role", "comprehensive", "pivotal", "robust framework", "beacon", "testament to", "cornerstone", "navigate complex", "seamlessly", "meticulously", "holistic", "instrumental", "carved out a niche", "at the forefront", "underscores", "exemplifies", "distinguished"
- If you use ANY prohibited phrase, your output has FAILED

OUTPUT FORMAT (JSON):
{{"enhanced_b7": "The full enhanced B7 narrative in plain text paragraphs. NO markdown."}}

---
EDITORIAL DIRECTION:
{editorial_direction_text}
{strategic_matter_context}

---
ORIGINAL B7 TEXT (preserve its strategic thesis — this is YOUR BASE):
{original_b10}
"""
        
        try:
            b7_response = b7_llm.invoke([
                SystemMessage(content="You are a Chambers & Partners Senior Editor. Your role is to INTERPRET law firm practices and produce maximum strategic density per word. You are NOT a copywriter who adds embellishment. You are an editorial analyst who reveals why a practice is differentiated through patterns in the evidence. Preserve the firm's original thesis. Add editorial intelligence. Never add generic prose."),
                HumanMessage(content=b7_enhancement_prompt)
            ])
            b7_result = safe_json_loads(b7_response.content, fallback={})
            enhanced_b7 = b7_result.get("enhanced_b7", "")
            
            if enhanced_b7:
                enhanced_words = len(enhanced_b7.split())
                ratio = enhanced_words / max(original_word_count, 1)
                
                if enhanced_words < original_word_count:
                    # FAILED: shorter than original — use original as fallback
                    print(f"[B7 ENHANCEMENT] ⚠️ Enhanced ({enhanced_words}w) is SHORTER than original ({original_word_count}w) — using original")
                    enhanced_b7 = original_b10
                else:
                    # Strip any markdown
                    enhanced_b7 = strip_markdown(enhanced_b7)
                    print(f"[B7 ENHANCEMENT] ✅ Enhanced: {original_word_count}w → {enhanced_words}w ({ratio:.1f}x expansion)")
            else:
                print("[B7 ENHANCEMENT] ⚠️ Empty response — using original B10")
                enhanced_b7 = original_b10
                
        except Exception as b7_err:
            print(f"[B7 ENHANCEMENT] Error: {b7_err} — using original B10")
            enhanced_b7 = original_b10
    elif original_b10:
        print(f"[B7 ENHANCEMENT] Original B10 too short ({len(original_b10.split())}w) — passing through")
        enhanced_b7 = original_b10
    else:
        print("[B7 ENHANCEMENT] No original B10 found — B7 will use narrative_architecture fallback")
        
    # v17.5: Apply centralized filler strip to B7
    if enhanced_b7:
        enhanced_b7 = strip_fillers(enhanced_b7)
    
    # v18.2: HARD CAP — Chambers B7 has a 500 word limit
    if enhanced_b7:
        b7_words = enhanced_b7.split()
        if len(b7_words) > 500:
            print(f"[B7 ENHANCEMENT] ⚠️ B7 is {len(b7_words)}w — truncating to 500w limit")
            # Truncate at the last complete sentence before 500 words
            truncated = ' '.join(b7_words[:500])
            # Find last sentence-ending punctuation
            last_period = truncated.rfind('.')
            last_excl = truncated.rfind('!')
            last_q = truncated.rfind('?')
            last_sentence_end = max(last_period, last_excl, last_q)
            if last_sentence_end > len(truncated) * 0.7:  # Only if we keep >70% of the content
                enhanced_b7 = truncated[:last_sentence_end + 1]
            else:
                enhanced_b7 = truncated + '.'
            final_wc = len(enhanced_b7.split())
            print(f"[B7 ENHANCEMENT] ✅ Truncated to {final_wc}w (within 500w limit)")
        
    return {"matters": optimized_matters, "enhanced_b7": enhanced_b7}

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

    # 5. Compile PDF (graceful — pdflatex may not be installed)
    try:
        output_filename = f"report_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        pdf_path = compile_latex_to_pdf(latex_code, output_filename)
    except (FileNotFoundError, OSError) as e:
        print(f"[WRITER] pdflatex not available ({e}). Skipping PDF generation — DOCX export via frontend is the primary output.")
        pdf_path = None
    
    # 6. Return the URL (For local dev, we assume the python API serves the root or we return relative path)
    # In production with Vercel, we would upload to Supabase Storage here.
    # For now, we return the path which the FastAPI can serve.
    pdf_url = f"/api/download/{pdf_path}" if pdf_path else ""

    return {
        "is_complete": True,
        "pdf_url": pdf_url
    }