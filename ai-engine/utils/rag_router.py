import os
import glob
from typing import List, Dict

class RAGRouter:
    def __init__(self, knowledge_dir: str = None):
        if not knowledge_dir:
            knowledge_dir = os.path.join(os.path.dirname(__file__), '..', 'rag_knowledge')
        self.knowledge_dir = knowledge_dir
        self.files = glob.glob(os.path.join(self.knowledge_dir, '*.txt'))
        
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
        
        # Define keywords for practice areas
        pa_keywords = []
        if "bank" in practice_area or "financ" in practice_area:
            pa_keywords = ["banking", "bank"]
        elif "tax" in practice_area or "fiscal" in practice_area:
            pa_keywords = ["tax"]
        elif "labour" in practice_area or "employ" in practice_area:
            pa_keywords = ["labour", "employment"]
        elif "corp" in practice_area or "m&a" in practice_area or "merger" in practice_area:
            pa_keywords = ["corporate", "m&a"]
        elif "dispute" in practice_area or "litig" in practice_area or "arbitrat" in practice_area:
            pa_keywords = ["dispute", "litigation"]
        elif "competi" in practice_area or "antitrust" in practice_area:
            pa_keywords = ["competition"]
        elif "ip" in practice_area or "intellectual" in practice_area or "patent" in practice_area or "pi" in practice_area:
            pa_keywords = ["intellectual property", " pi ", "ip"]
        elif "regulat" in practice_area or "public" in practice_area or "admin" in practice_area:
            pa_keywords = ["regulatory", "public"]
            
        # Define keywords for directories
        dir_keywords = []
        if "chamber" in directory:
            dir_keywords = ["chamber"]
        elif "500" in directory:
            dir_keywords = ["500"]
        elif "iflr" in directory:
            dir_keywords = ["iflr"]
        elif "leader" in directory:
            dir_keywords = ["leader"]
            
        # Global documents to ALWAYS include
        global_files = [
            "global lawyer leadership framework — rankpilot rag v1.txt",
            "¿cómo rankeamos abogado_as__.txt",
            "volume_0_first_principles.txt",
            "volume_ii_editorial_reasoning_engine.txt"
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
                
            # Score specific files
            score = 0
            
            # Match PA
            pa_match = False
            for pak in pa_keywords:
                if pak in lower_name:
                    score += 10
                    pa_match = True
                    break
                    
            # Match Dir
            dir_match = False
            for dk in dir_keywords:
                if dk in lower_name:
                    score += 10
                    dir_match = True
                    break
            
            # Keep if it matches the Practice Area at least
            if pa_match:
                selected_files.append((score, f, basename))

        # Sort selected by score descending
        selected_files.sort(key=lambda x: x[0], reverse=True)
        
        specific_context = ""
        # Take the top 3 highest scoring specific documents
        top_files = selected_files[:3]
        for score, filepath, basename in top_files:
            specific_context += f"\n--- SPECIFIC KNOWLEDGE (Relevance Score: {score}): {basename} ---\n" + self._read_file(filepath)
            
        # Combine
        final_rag = (
            "================ RAG KNOWLEDGE BASE =================\n"
            "CRITICAL INSTRUCTION: You MUST evaluate the submission strictly according to these guidelines. "
            "Do not use generic knowledge if it conflicts with these rules.\n"
            + specific_context + "\n" + global_context +
            "\n================ END RAG KNOWLEDGE BASE =================\n"
        )
        return final_rag
