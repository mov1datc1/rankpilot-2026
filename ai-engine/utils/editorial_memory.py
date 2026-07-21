"""
Editorial Memory — v7.0 Continuous Learning System
===================================================
Stores editorial decisions, lessons, and patterns from past submissions
so the AI progressively improves its reasoning quality.

Architecture:
- Memory is stored as a JSON file per practice area in rag_knowledge/editorial_memory/
- Each submission contributes new lessons after processing
- When processing a new submission, relevant memories are loaded and injected
  into the pipeline context so the AI can learn from past experience

"Art. XV: Memory is intelligence. Each project feeds future knowledge."
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from core.schema import EditorialMemoryEntry, EditorialMemoryBank


MEMORY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rag_knowledge", "editorial_memory")


def _ensure_memory_dir():
    """Create the editorial memory directory if it doesn't exist."""
    os.makedirs(MEMORY_DIR, exist_ok=True)


def _memory_file_path(practice_area: str, jurisdiction: str) -> str:
    """Generate a safe filename for a practice area + jurisdiction combination."""
    safe_practice = practice_area.lower().replace(" ", "_").replace("&", "and").replace("/", "_")[:50]
    safe_jurisdiction = jurisdiction.lower().replace(" ", "_")[:30]
    return os.path.join(MEMORY_DIR, f"{safe_practice}_{safe_jurisdiction}.json")


def _global_memory_path() -> str:
    """Path for the global (cross-practice) memory bank."""
    return os.path.join(MEMORY_DIR, "_global_memory.json")


def load_memory(practice_area: str, jurisdiction: str) -> EditorialMemoryBank:
    """Load the editorial memory bank for a specific practice area + jurisdiction.
    
    Returns both the specific memory AND relevant global memories.
    If no memory exists, returns an empty bank.
    """
    _ensure_memory_dir()
    
    # Load practice-specific memory
    specific_path = _memory_file_path(practice_area, jurisdiction)
    specific_entries = []
    total_processed = 0
    
    if os.path.exists(specific_path):
        try:
            with open(specific_path, "r") as f:
                data = json.load(f)
                specific_entries = [EditorialMemoryEntry(**e) for e in data.get("entries", [])]
                total_processed = data.get("total_submissions_processed", 0)
        except (json.JSONDecodeError, Exception) as e:
            print(f"[EDITORIAL MEMORY] Error loading specific memory: {e}")
    
    # Load global memory (cross-practice lessons)
    global_path = _global_memory_path()
    global_entries = []
    
    if os.path.exists(global_path):
        try:
            with open(global_path, "r") as f:
                data = json.load(f)
                global_entries = [EditorialMemoryEntry(**e) for e in data.get("entries", [])]
        except (json.JSONDecodeError, Exception) as e:
            print(f"[EDITORIAL MEMORY] Error loading global memory: {e}")
    
    # Combine: specific first (higher relevance), then global
    all_entries = specific_entries + [e for e in global_entries if e.confidence >= 0.8]
    
    # Keep only the most recent 50 entries to avoid context bloat
    all_entries = sorted(all_entries, key=lambda e: e.timestamp, reverse=True)[:50]
    
    return EditorialMemoryBank(
        entries=all_entries,
        total_submissions_processed=total_processed,
        practice_areas_covered=list(set(e.practice_area for e in all_entries)),
        jurisdictions_covered=list(set(e.jurisdiction for e in all_entries)),
    )


def save_memory(practice_area: str, jurisdiction: str, new_entries: List[EditorialMemoryEntry]):
    """Save new editorial memory entries after processing a submission.
    
    Appends to the existing memory bank, deduplicates, and persists.
    """
    _ensure_memory_dir()
    
    # Load existing
    specific_path = _memory_file_path(practice_area, jurisdiction)
    existing_entries = []
    total_processed = 0
    
    if os.path.exists(specific_path):
        try:
            with open(specific_path, "r") as f:
                data = json.load(f)
                existing_entries = data.get("entries", [])
                total_processed = data.get("total_submissions_processed", 0)
        except (json.JSONDecodeError, Exception):
            pass
    
    # Append new entries
    for entry in new_entries:
        entry_dict = entry.model_dump() if hasattr(entry, "model_dump") else entry.dict()
        existing_entries.append(entry_dict)
    
    # Keep only the most recent 100 entries per practice area
    existing_entries = existing_entries[-100:]
    
    # Save
    memory_data = {
        "practice_area": practice_area,
        "jurisdiction": jurisdiction,
        "total_submissions_processed": total_processed + 1,
        "last_updated": datetime.utcnow().isoformat(),
        "entries": existing_entries,
    }
    
    with open(specific_path, "w") as f:
        json.dump(memory_data, f, indent=2, default=str)
    
    print(f"[EDITORIAL MEMORY] Saved {len(new_entries)} new lessons for {practice_area}/{jurisdiction}. "
          f"Total: {len(existing_entries)} entries, {total_processed + 1} submissions processed.")


def extract_lessons_from_result(result: Dict, practice_area: str, jurisdiction: str) -> List[EditorialMemoryEntry]:
    """Extract editorial lessons from a completed pipeline result.
    
    This runs AFTER the pipeline completes and extracts reusable intelligence:
    - What thesis worked well (if confidence was high)
    - What inference patterns to avoid (from refutation results)
    - What client diversity patterns look like in this practice area
    - What matter quality signals are most important
    """
    lessons = []
    timestamp = datetime.utcnow().isoformat()
    firm_id = result.get("metadata", {}).get("firm_name", "anonymous")[:20]
    
    # Lesson 1: Successful thesis patterns (from high-confidence results)
    confidence = result.get("editorial_confidence", {})
    if confidence.get("overall_confidence") in ("high", "moderate"):
        thesis = result.get("comprehension", {}).get("apparent_thesis", "")
        if thesis:
            lessons.append(EditorialMemoryEntry(
                practice_area=practice_area,
                jurisdiction=jurisdiction,
                lesson_type="successful_thesis",
                lesson=f"A thesis that achieved {confidence.get('overall_confidence')} confidence: '{thesis}'",
                source_firm=firm_id,
                confidence=0.8 if confidence.get("overall_confidence") == "high" else 0.6,
                timestamp=timestamp,
            ))
    
    # Lesson 2: Identity patterns (from identity discovery)
    identity = result.get("competitive_identity", {})
    if identity.get("identity_coherence") == "coherent":
        lessons.append(EditorialMemoryEntry(
            practice_area=practice_area,
            jurisdiction=jurisdiction,
            lesson_type="inference_pattern",
            lesson=f"Coherent identity pattern: {identity.get('identity_statement', '')}. "
                   f"Recurring patterns: {', '.join(identity.get('recurring_patterns', [])[:3])}",
            source_firm=firm_id,
            confidence=0.75,
            timestamp=timestamp,
        ))
    
    # Lesson 3: Client diversity benchmarks
    blueprint = result.get("submission_blueprint", {})
    if blueprint.get("client_diversity"):
        diversity = blueprint.get("client_diversity", [])
        lessons.append(EditorialMemoryEntry(
            practice_area=practice_area,
            jurisdiction=jurisdiction,
            lesson_type="client_diversity_pattern",
            lesson=f"Client diversity profile observed: {', '.join(diversity[:5])}",
            source_firm=firm_id,
            confidence=0.7,
            timestamp=timestamp,
        ))
    
    # Lesson 4: Matter quality signals from high-scoring matters
    analysis = result.get("analysis", {})
    matter_evals = analysis.get("audit_letter", {}).get("matter_evaluations", [])
    high_quality = [m for m in matter_evals if isinstance(m, dict) and m.get("score", 0) >= 80]
    if high_quality:
        labels = [m.get("quality_label", "") for m in high_quality[:3]]
        lessons.append(EditorialMemoryEntry(
            practice_area=practice_area,
            jurisdiction=jurisdiction,
            lesson_type="matter_quality_signal",
            lesson=f"High-quality matter patterns in {practice_area}: {', '.join(labels)}. "
                   f"These scored 80+ in Chambers evaluation.",
            source_firm=firm_id,
            confidence=0.8,
            timestamp=timestamp,
        ))
    
    # Lesson 5: Refutation lessons (what didn't work)
    refutation = result.get("refutation_results", {})
    destroyed = refutation.get("destroyed_hypotheses", [])
    if destroyed:
        lessons.append(EditorialMemoryEntry(
            practice_area=practice_area,
            jurisdiction=jurisdiction,
            lesson_type="common_error",
            lesson=f"Hypotheses that failed refutation in {practice_area}: {'; '.join(destroyed[:2])}. "
                   f"Avoid building narratives around these patterns.",
            source_firm=firm_id,
            confidence=0.85,
            timestamp=timestamp,
        ))
    
    return lessons


def format_memory_for_prompt(memory_bank: EditorialMemoryBank) -> str:
    """Format the memory bank into a string that can be injected into prompts.
    
    Returns a concise summary of past editorial intelligence for this
    practice area + jurisdiction, suitable for inclusion in LLM context.
    """
    if not memory_bank.entries:
        return ""
    
    lines = [
        f"\n### EDITORIAL MEMORY (v7.0 — {memory_bank.total_submissions_processed} past submissions analyzed):",
        f"Practice areas covered: {', '.join(memory_bank.practice_areas_covered[:5])}",
        f"Jurisdictions: {', '.join(memory_bank.jurisdictions_covered[:5])}",
        "",
        "KEY LESSONS FROM PAST SUBMISSIONS:",
    ]
    
    # Group by lesson type and take top entries
    by_type = {}
    for entry in memory_bank.entries[:20]:  # Max 20 entries in context
        by_type.setdefault(entry.lesson_type, []).append(entry)
    
    for lesson_type, entries in by_type.items():
        lines.append(f"\n[{lesson_type.upper()}]:")
        for entry in entries[:3]:  # Max 3 per type
            lines.append(f"- {entry.lesson}")
    
    lines.append("\nUse these lessons to calibrate your analysis. Do NOT repeat past mistakes.")
    
    return "\n".join(lines)
