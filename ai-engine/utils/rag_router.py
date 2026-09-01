"""Practice-aware, chunked RAG routing with auditable provenance."""

import glob
import hashlib
import os
import re
from dataclasses import asdict, dataclass
from typing import Dict, List, Sequence


@dataclass(frozen=True)
class RAGChunk:
    chunk_id: str
    source: str
    tier: str
    score: int
    text: str


class RAGRouter:
    """Route relevant methodology chunks without loading whole files."""

    GLOBAL_FILES = (
        "editorial_constitution", "global lawyer leadership framework",
        "¿cómo rankeamos abogado_as__", "volume_0_first_principles",
        "volume_ii_editorial_reasoning_engine",
    )
    MAX_CHUNKS = 16
    MAX_CONTEXT_CHARS = 42000
    CHUNK_CHARS = 2800

    def __init__(self, knowledge_dir: str = None):
        self.knowledge_dir = knowledge_dir or os.path.join(os.path.dirname(__file__), "..", "rag_knowledge")
        self.files = sorted(glob.glob(os.path.join(self.knowledge_dir, "*.txt")) + glob.glob(os.path.join(self.knowledge_dir, "*.md")))
        self.last_manifest: List[Dict] = []

    def _read_file(self, filepath: str) -> str:
        try:
            with open(filepath, "r", encoding="utf-8") as source:
                return source.read()
        except OSError as exc:
            print(f"[RAG ROUTER] Could not read {filepath}: {exc}")
            return ""

    @staticmethod
    def _practice_keywords(practice_area: str) -> Sequence[str]:
        practice = practice_area.lower()
        routes = [
            (("bank", "financ", "capital market", "fintech"), ("banking", "finance")),
            (("tax", "fiscal", "tributar"), ("tax", "fiscal")),
            (("labour", "labor", "employ", "trabajo"), ("labour", "labor", "employment")),
            (("corp", "m&a", "merger", "sociedad"), ("corporate", "m&a", "corporate_ma")),
            (("dispute", "litig", "arbitrat", "amparo"), ("dispute", "litigation", "arbitrat")),
            (("competi", "antitrust"), ("competition", "antitrust")),
            (("intellectual", "patent", "trademark", "privacy", "data protection"), ("intellectual", "privacy", "data")),
            (("regulat", "public", "admin"), ("regulatory", "public", "administrative")),
            (("energy", "project", "infra", "mining", "environ"), ("energy", "project", "infrastructure")),
            (("real estate", "property", "inmobiliario", "urban"), ("real estate", "real_estate", "property", "inmobiliario")),
        ]
        for triggers, keywords in routes:
            if any(trigger in practice for trigger in triggers):
                return keywords
        return ()

    @staticmethod
    def _directory_keywords(directory: str) -> Sequence[str]:
        value = directory.lower()
        if "chamber" in value:
            return ("chamber",)
        if "500" in value:
            return ("legal 500", "legal500")
        if "iflr" in value:
            return ("iflr",)
        if "leader" in value:
            return ("leader",)
        return ()

    @classmethod
    def _split_chunks(cls, text: str) -> List[str]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
        chunks: List[str] = []
        current = ""
        for paragraph in paragraphs:
            units = re.split(r"(?<=[.!?])\s+", paragraph) if len(paragraph) > cls.CHUNK_CHARS else [paragraph]
            for unit in units:
                candidate = f"{current}\n\n{unit}".strip() if current else unit
                if current and len(candidate) > cls.CHUNK_CHARS:
                    chunks.append(current)
                    current = unit
                else:
                    current = candidate
        if current:
            chunks.append(current)
        return chunks

    @staticmethod
    def _tier(filename: str) -> str:
        lower = filename.lower()
        if any(token in lower for token in ("methodology", "taxonomy", "matrix", "constitution", "principles", "framework")):
            return "methodology"
        if any(token in lower for token in ("scoring", "rubric", "overlay")):
            return "rubric"
        if any(token in lower for token in ("example", "strong", "weak", "rewrite")):
            return "example"
        return "reference"

    def retrieve(self, practice_area: str, directory: str) -> List[RAGChunk]:
        practice_keywords = self._practice_keywords(str(practice_area))
        directory_keywords = self._directory_keywords(str(directory))
        candidates: List[RAGChunk] = []
        for filepath in self.files:
            filename = os.path.basename(filepath)
            lower_name = filename.lower()
            is_global = any(token in lower_name for token in self.GLOBAL_FILES)
            practice_match = any(token in lower_name for token in practice_keywords)
            if not is_global and not practice_match:
                continue
            tier = self._tier(filename)
            file_score = (20 if is_global else 60) + {"methodology": 15, "rubric": 10, "reference": 5, "example": 0}[tier]
            if any(token in lower_name for token in directory_keywords):
                file_score += 10
            for index, text in enumerate(self._split_chunks(self._read_file(filepath)), start=1):
                lower_text = text.lower()
                score = file_score + min(12, 3 * sum(token in lower_text for token in practice_keywords)) + min(6, 3 * sum(token in lower_text for token in directory_keywords))
                digest = hashlib.sha1(f"{filename}:{index}:{text}".encode("utf-8")).hexdigest()[:12]
                candidates.append(RAGChunk(f"rag-{digest}", filename, tier, score, text))
        candidates.sort(key=lambda chunk: (-chunk.score, chunk.source, chunk.chunk_id))
        selected: List[RAGChunk] = []
        total_chars = 0
        for chunk in candidates:
            if len(selected) >= self.MAX_CHUNKS:
                break
            if selected and total_chars + len(chunk.text) > self.MAX_CONTEXT_CHARS:
                continue
            selected.append(chunk)
            total_chars += len(chunk.text)
        self.last_manifest = [{key: value for key, value in asdict(chunk).items() if key != "text"} for chunk in selected]
        return selected

    def get_rag_context(self, practice_area: str, directory: str) -> str:
        chunks = self.retrieve(practice_area, directory)
        print(f"[RAG ROUTER] practice={practice_area} directory={directory} chunks={len(chunks)} sources={len(set(c.source for c in chunks))}")
        blocks = [
            "RAG METHODOLOGY CONTEXT — NOT SUBMISSION EVIDENCE",
            "Use these chunks only for evaluation method and directory criteria. Examples, names, figures, and facts in RAG must never become claims about the submitted firm. Every submission fact must come from the canonical evidence ledger.",
        ]
        for chunk in chunks:
            blocks.append(f"[RAG {chunk.chunk_id} | source={chunk.source} | tier={chunk.tier} | score={chunk.score}]\n{chunk.text}")
        return "\n\n".join(blocks)

    def get_rag_manifest(self) -> List[Dict]:
        return list(self.last_manifest)
