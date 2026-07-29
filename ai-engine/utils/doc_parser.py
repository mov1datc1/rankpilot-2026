import fitz  # PyMuPDF
from docx import Document
import os
import re
import hashlib
import tempfile
import urllib.request
from urllib.parse import urlparse

class DocumentParser:
    """
    Utility class to handle multi-format document ingestion (PDF & DOCX).
    Ensures text is extracted cleanly for LLM processing.
    v14.0: Added Trust Layer — programmatic matter counting and document stats.
    """
    
    @staticmethod
    def parse(file_path: str) -> str:
        is_url = file_path.startswith('http://') or file_path.startswith('https://')
        
        # Parse extension correctly even with URL parameters
        parsed_path = urlparse(file_path).path if is_url else file_path
        extension = os.path.splitext(parsed_path)[1].lower()
        
        if extension not in ['.docx', '.pdf']:
            raise ValueError(f"Unsupported file format: {extension}")

        local_path = file_path
        temp_file = None

        if is_url:
            # Download to a temporary file
            fd, local_path = tempfile.mkstemp(suffix=extension)
            os.close(fd)
            req = urllib.request.Request(file_path, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
            temp_file = local_path

        try:
            if extension == '.docx':
                return DocumentParser._parse_docx(local_path)
            elif extension == '.pdf':
                return DocumentParser._parse_pdf(local_path)
        finally:
            # Cleanup temp file if it was created
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)

    @staticmethod
    def _parse_docx(file_path: str) -> str:
        """Extracts text from Word documents maintaining paragraph separation."""
        doc = Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        # Also extract text from tables (critical for Chambers forms)
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                full_text.append(" | ".join(row_text))
                
        return "\n".join(full_text)

    @staticmethod
    def _parse_pdf(file_path: str) -> str:
        """Extracts text from PDF using PyMuPDF."""
        text = ""
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text("text") + "\n"
        return text

    # =====================================================
    # v14.0 TRUST LAYER — Programmatic Source Verification
    # Rule 70: Extraction Validator
    # Rule 71: Pipeline Manifest
    # =====================================================

    @staticmethod
    def count_source_matters(file_path: str) -> dict:
        """
        Rule 70: Programmatically count matter sections in a DOCX by scanning
        table headers for 'Matter N' patterns. This count is INDEPENDENT of LLM
        extraction and serves as ground truth for validation.
        
        Returns:
            {
                "total": int,
                "publishable": int,
                "confidential": int,
                "matter_labels": ["Publishable Matter 1", "Confidential Matter 2", ...]
            }
        """
        is_url = file_path.startswith('http://') or file_path.startswith('https://')
        parsed_path = urlparse(file_path).path if is_url else file_path
        extension = os.path.splitext(parsed_path)[1].lower()
        
        if extension != '.docx':
            return {"total": 0, "publishable": 0, "confidential": 0, "matter_labels": [], "note": "Non-DOCX format — programmatic count not available"}
        
        local_path = file_path
        temp_file = None
        
        if is_url:
            fd, local_path = tempfile.mkstemp(suffix=extension)
            os.close(fd)
            req = urllib.request.Request(file_path, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
            temp_file = local_path
        
        try:
            doc = Document(local_path)
            matter_labels = []
            seen_table_indices = set()
            
            # Pattern 1: Chambers format — "Publishable Matter 1", "Confidential Matter 2"
            chambers_pattern = re.compile(
                r'(?:Publishable|Confidential|Non-publishable)\s+Matter\s+\d+',
                re.IGNORECASE
            )
            
            # Pattern 2: Legal 500 format — "Publishable matter" or "Non-publishable matter N"
            # In Legal 500, each matter is its own table. The first cell is the label.
            legal500_pattern = re.compile(
                r'^(?:Publishable|Non-publishable|Confidential)\s+matter(?:\s+\d+)?$',
                re.IGNORECASE
            )
            
            # Scan each table's first cell for matter headers
            for ti, table in enumerate(doc.tables):
                if ti in seen_table_indices:
                    continue
                if not table.rows or not table.rows[0].cells:
                    continue
                    
                first_cell_text = table.rows[0].cells[0].text.strip()
                
                # Check Chambers pattern (more specific — with number)
                chambers_match = chambers_pattern.search(first_cell_text)
                if chambers_match:
                    label = chambers_match.group(0).strip()
                    matter_labels.append(label)
                    seen_table_indices.add(ti)
                    continue
                
                # Check Legal 500 pattern (may lack number)
                legal500_match = legal500_pattern.match(first_cell_text)
                if legal500_match:
                    label = first_cell_text
                    # Add table index to disambiguate duplicate labels (e.g., multiple "Non-publishable matter 4")
                    matter_labels.append(f"{label} (Table {ti})")
                    seen_table_indices.add(ti)
                    continue
            
            # Also scan interior table cells for Chambers format (matter labels in non-first cells)
            for ti, table in enumerate(doc.tables):
                if ti in seen_table_indices:
                    continue
                for row in table.rows:
                    for cell in row.cells:
                        txt = cell.text.strip()
                        chambers_match = chambers_pattern.search(txt)
                        if chambers_match:
                            label = chambers_match.group(0).strip()
                            if label not in [l.split(' (Table')[0] for l in matter_labels]:
                                matter_labels.append(label)
                                seen_table_indices.add(ti)
                            break
                    if ti in seen_table_indices:
                        break
            
            # Also scan paragraphs for matter headers (some templates use headings)
            seen_para_labels = set()
            for para in doc.paragraphs:
                txt = para.text.strip()
                chambers_match = chambers_pattern.search(txt)
                if chambers_match:
                    label = chambers_match.group(0).strip()
                    if label not in seen_para_labels and label not in [l.split(' (Table')[0] for l in matter_labels]:
                        seen_para_labels.add(label)
                        matter_labels.append(label)
            
            # Classify
            publishable = sum(1 for l in matter_labels 
                            if 'publishable' in l.lower() 
                            and 'non' not in l.lower() 
                            and 'confidential' not in l.lower())
            confidential = sum(1 for l in matter_labels 
                             if 'confidential' in l.lower() 
                             or 'non-publishable' in l.lower() 
                             or 'non publishable' in l.lower())
            
            return {
                "total": len(matter_labels),
                "publishable": publishable,
                "confidential": confidential,
                "matter_labels": matter_labels,
            }
        except Exception as e:
            print(f"[MATTER COUNTER] Error counting matters: {e}")
            return {"total": 0, "publishable": 0, "confidential": 0, "matter_labels": [], "error": str(e)}
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)

    @staticmethod
    def get_document_stats(file_path: str) -> dict:
        """
        Rule 71: Generate document-level statistics for the Pipeline Manifest.
        Provides ground truth about what the system actually read.
        
        Returns:
            {
                "file_name": str,
                "file_hash": str (SHA-256 of content),
                "word_count": int,
                "paragraph_count": int,
                "table_count": int,
                "source_matters": { ... from count_source_matters },
            }
        """
        is_url = file_path.startswith('http://') or file_path.startswith('https://')
        parsed_path = urlparse(file_path).path if is_url else file_path
        extension = os.path.splitext(parsed_path)[1].lower()
        file_name = os.path.basename(parsed_path)
        
        stats = {
            "file_name": file_name,
            "file_hash": "",
            "word_count": 0,
            "paragraph_count": 0,
            "table_count": 0,
            "source_matters": {},
        }
        
        local_path = file_path
        temp_file = None
        
        if is_url:
            fd, local_path = tempfile.mkstemp(suffix=extension)
            os.close(fd)
            req = urllib.request.Request(file_path, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
            temp_file = local_path
        
        try:
            # File hash
            with open(local_path, 'rb') as f:
                stats["file_hash"] = hashlib.sha256(f.read()).hexdigest()[:16]
            
            if extension == '.docx':
                doc = Document(local_path)
                all_text = []
                for para in doc.paragraphs:
                    if para.text.strip():
                        all_text.append(para.text)
                
                stats["paragraph_count"] = len(all_text)
                stats["word_count"] = sum(len(p.split()) for p in all_text)
                stats["table_count"] = len(doc.tables)
                stats["source_matters"] = DocumentParser.count_source_matters(file_path)
            elif extension == '.pdf':
                text = DocumentParser._parse_pdf(local_path)
                stats["word_count"] = len(text.split())
                stats["paragraph_count"] = text.count('\n\n') + 1
        except Exception as e:
            stats["error"] = str(e)
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
        
        return stats