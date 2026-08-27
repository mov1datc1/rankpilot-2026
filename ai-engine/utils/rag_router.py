import os
import glob
from typing import List, Dict, Tuple

class RAGRouter:
    """
    v11.0 — Enhanced RAG Router
    
    Changes from v10:
    - Supports .txt AND .md files
    - Increased top-file limit from 3 → 7 for richer context
    - Tiered scoring: methodology files get priority over examples
    - Improved keyword matching for v1 RAG files
    - Added Tax and Regulatory category routes
    """
    
    def __init__(self, knowledge_dir: str = None):
        if not knowledge_dir:
            knowledge_dir = os.path.join(os.path.dirname(__file__), '..', 'rag_knowledge')
        self.knowledge_dir = knowledge_dir
        # v11.0: Support both .txt and .md files
        self.files = (
            glob.glob(os.path.join(self.knowledge_dir, '*.txt')) +
            glob.glob(os.path.join(self.knowledge_dir, '*.md'))
        )
        
    def _read_file(self, filepath: str) -> str:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return ""

    def get_rag_context(self, practice_area: str, directory: str) -> str:
        practice_area = str(practice_area).lower()
        directory = str(directory).lower()
        
        # Define keywords for practice areas — EXPANDED for v1 file names
        pa_keywords = []
        if "bank" in practice_area or "financ" in practice_area:
            pa_keywords = ["banking", "bank", "finance"]
        elif "tax" in practice_area or "fiscal" in practice_area:
            pa_keywords = ["tax ", " tax", "tax_", "tax.", "tax-", "fiscal"]
        elif "labour" in practice_area or "labor" in practice_area or "employ" in practice_area:
            pa_keywords = ["labour", "labor", "employment"]
        elif "corp" in practice_area or "m&a" in practice_area or "merger" in practice_area:
            pa_keywords = ["corporate", "m&a", "corporate_ma"]
        elif "dispute" in practice_area or "litig" in practice_area or "arbitrat" in practice_area:
            pa_keywords = ["dispute", "litigation", "arbitrat"]
        elif "competi" in practice_area or "antitrust" in practice_area:
            pa_keywords = ["competition", "antitrust"]
        elif "ip" in practice_area or "intellectual" in practice_area or "patent" in practice_area or "pi" in practice_area:
            pa_keywords = ["intellectual property", " pi ", "ip ", "_ip_"]
        elif "regulat" in practice_area or "public" in practice_area or "admin" in practice_area:
            pa_keywords = ["regulatory", "public", "administrative"]
        elif "energy" in practice_area or "project" in practice_area or "infra" in practice_area:
            pa_keywords = ["energy", "project", "infrastructure"]
        elif "real estate" in practice_area or "property" in practice_area or "real_estate" in practice_area or "inmobiliario" in practice_area:
            pa_keywords = ["real estate", "real_estate", "inmobiliario", "real property"]
            
        # Define keywords for directories — EXPANDED
        dir_keywords = []
        if "chamber" in directory:
            dir_keywords = ["chamber"]
        elif "500" in directory or "legal 500" in directory:
            dir_keywords = ["500", "legal500"]
        elif "iflr" in directory:
            dir_keywords = ["iflr"]
        elif "leader" in directory:
            dir_keywords = ["leader"]
            
        # Global documents to ALWAYS include
        global_files = [
            "editorial_constitution.txt",
            "global lawyer leadership framework",
            "¿cómo rankeamos abogado_as__",
            "volume_0_first_principles",
            "volume_ii_editorial_reasoning_engine"
        ]
        
        selected_files = []
        global_context = ""
        
        for f in self.files:
            basename = os.path.basename(f)
            lower_name = basename.lower()
            
            # Extract globals
            is_global = False
            for gf in global_files:
                if gf in lower_name:
                    global_context += f"\n--- GLOBAL KNOWLEDGE: {basename} ---\n" + self._read_file(f)
                    is_global = True
                    break
            
            if is_global:
                continue
                
            # Score specific files with TIERED SCORING (v11.0)
            score = 0
            
            # Match Practice Area
            pa_match = False
            for pak in pa_keywords:
                if pak in lower_name:
                    # v11.0: Extra check for 'tax' to prevent matching 'taxonomy'
                    if pak.strip() == 'tax' or (pak in ['tax ', ' tax', 'tax_', 'tax.', 'tax-']):
                        # Make sure it's actually a Tax file, not 'taxonomy'
                        import re as _re
                        if _re.search(r'\btax\b', lower_name) and 'taxonomy' not in lower_name:
                            score += 10
                            pa_match = True
                            break
                    else:
                        score += 10
                        pa_match = True
                        break
                    
            # Match Directory
            dir_match = False
            for dk in dir_keywords:
                if dk in lower_name:
                    score += 10
                    dir_match = True
                    break
            
            # v11.0: TIERED BONUS — methodology/rubric files get priority over examples
            if pa_match:
                # Tier 1: Core methodology and taxonomy (most important)
                if any(k in lower_name for k in ["methodology", "taxonomy", "matrix", "intelligence engine", "universal", "master"]):
                    score += 5
                # Tier 2: Scoring rubrics and overlays
                elif any(k in lower_name for k in ["scoring", "rubric", "overlay", "directory_overlay"]):
                    score += 4
                # Tier 3: Strong/weak matter examples and rewrites
                elif any(k in lower_name for k in ["strong", "weak", "rewrite", "example"]):
                    score += 2
                # Tier 4: Multi-ranking / cross-directory layers
                elif any(k in lower_name for k in ["multi-ranking", "intelligence layer"]):
                    score += 3
            
            # Keep if it matches the Practice Area at least
            if pa_match:
                selected_files.append((score, f, basename))

        # Sort selected by score descending
        selected_files.sort(key=lambda x: x[0], reverse=True)
        
        specific_context = ""
        # v11.0: Take the top 7 highest scoring specific documents (was 3)
        top_files = selected_files[:7]
        
        print(f"[RAG ROUTER v11.0] Practice: {practice_area} | Directory: {directory}")
        print(f"[RAG ROUTER v11.0] Found {len(selected_files)} matching files, selecting top {len(top_files)}:")
        for score, filepath, basename in top_files:
            print(f"  → Score {score}: {basename}")
            specific_context += f"\n--- SPECIFIC KNOWLEDGE (Relevance Score: {score}): {basename} ---\n" + self._read_file(filepath)
            
        # Combine
        final_rag = (
            "================ RAG KNOWLEDGE BASE (v11.0) =================\n"
            "CRITICAL INSTRUCTION: You MUST evaluate the submission strictly according to these guidelines. "
            "Do not use generic knowledge if it conflicts with these rules.\n"
            "The following documents contain practice-area-specific methodology, taxonomy, scoring rubrics, "
            "examples of strong and weak matters, and directory-specific editorial logic. "
            "USE THEM as your primary reference for analysis.\n"
            + specific_context + "\n" + global_context +
            "\n================ END RAG KNOWLEDGE BASE =================\n"
        )
        return final_rag
