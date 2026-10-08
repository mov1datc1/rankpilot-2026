"""Stable identity of engine code and methodology, independent of UI-only commits."""
import hashlib
import unicodedata
from pathlib import Path
from functools import lru_cache

DIRECTORIES = ('agents', 'chains', 'config', 'core', 'rag_knowledge', 'templates', 'utils')
SUFFIXES = {'.py', '.json', '.txt', '.md', '.j2', '.jinja2', '.html', '.tex'}

@lru_cache(maxsize=1)
def engine_fingerprint(root=None):
    root = Path(root) if root else Path(__file__).resolve().parents[1]
    files = [root / name for name in ('main.py', 'requirements.txt', 'Dockerfile')]
    for directory in DIRECTORIES:
        files.extend(p for p in (root / directory).rglob('*') if p.is_file() and p.suffix in SUFFIXES and '__pycache__' not in p.parts)
    records = sorted((unicodedata.normalize('NFC', p.relative_to(root).as_posix()), hashlib.sha256(p.read_bytes()).hexdigest()) for p in files)
    return hashlib.sha256(''.join(name + '\0' + digest + '\n' for name, digest in records).encode()).hexdigest()
