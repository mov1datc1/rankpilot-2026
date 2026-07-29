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

    # =====================================================
    # v14.1 PRE-FLIGHT GATE — Rule 72: Ranking Evidence Detector
    # Scans DOCX for evidence that the firm is already ranked.
    # Used to flag contradictions when user declares "Unranked".
    # =====================================================
    @staticmethod
    def detect_ranking_evidence(file_path: str) -> dict:
        """
        Rule 72: Scan DOCX for evidence of existing ranking status.
        Looks for:
        - C2/Feedback sections mentioning "current rankings", "our coverage"
        - B9 sections listing "Ranked" lawyers
        - Any text mentioning "Band", "Tier", "currently ranked"
        
        Returns:
            {
                "has_ranking_evidence": bool,
                "evidence_type": str,     # "explicit" | "implicit" | "none"
                "evidence_text": str,     # The key phrase found
                "detected_band": str,     # If a specific band/tier is mentioned
                "ranked_lawyers": list,   # Names flagged as currently ranked
            }
        """
        is_url = file_path.startswith('http://') or file_path.startswith('https://')
        parsed_path = urlparse(file_path).path if is_url else file_path
        extension = os.path.splitext(parsed_path)[1].lower()
        
        result = {
            "has_ranking_evidence": False,
            "evidence_type": "none",
            "evidence_text": "",
            "detected_band": "",
            "ranked_lawyers": [],
        }
        
        if extension != '.docx':
            return result
        
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
            all_text_blocks = []
            
            # Collect text from tables for scanning
            for ti, table in enumerate(doc.tables):
                for ri, row in enumerate(table.rows):
                    for cell in row.cells:
                        txt = cell.text.strip()
                        if txt and len(txt) > 20:
                            all_text_blocks.append((f"T{ti}R{ri}", txt))
            
            # Also scan paragraphs
            for pi, para in enumerate(doc.paragraphs):
                txt = para.text.strip()
                if txt and len(txt) > 20:
                    all_text_blocks.append((f"P{pi}", txt))
            
            # Pattern 1: EXPLICIT ranking evidence
            # "current rankings", "our coverage", "currently ranked", "Band N"
            explicit_patterns = [
                (r'current\s+rank(?:ing|s)', 'explicit'),
                (r'our\s+(?:current\s+)?coverage', 'explicit'),
                (r'currently\s+(?:ranked|listed|included)', 'explicit'),
                (r'(?:Band|Tier)\s+\d', 'explicit'),
                (r'maintain\s+(?:our|the)\s+(?:current\s+)?rank', 'explicit'),
                (r'we\s+(?:are|remain)\s+ranked', 'explicit'),
            ]
            
            for location, text in all_text_blocks:
                text_lower = text.lower()
                for pattern, ev_type in explicit_patterns:
                    match = re.search(pattern, text_lower)
                    if match:
                        result["has_ranking_evidence"] = True
                        result["evidence_type"] = ev_type
                        # Extract surrounding context (max 200 chars)
                        start = max(0, match.start() - 50)
                        end = min(len(text), match.end() + 100)
                        result["evidence_text"] = text[start:end].strip()
                        
                        # Try to extract specific band
                        band_match = re.search(r'(?:Band|Tier)\s+(\d)', text, re.IGNORECASE)
                        if band_match:
                            result["detected_band"] = f"Band {band_match.group(1)}"
                        break
                if result["has_ranking_evidence"]:
                    break
            
            # Pattern 2: IMPLICIT evidence — check B9/lawyer table for "Ranked" column
            for ti, table in enumerate(doc.tables):
                if not table.rows:
                    continue
                header_text = " ".join(c.text.strip().lower() for c in table.rows[0].cells)
                if 'ranked' in header_text and ('lawyer' in header_text or 'unranked' in header_text):
                    # This is a B9-style table. Check for ranked lawyers
                    for ri in range(1, len(table.rows)):
                        row = table.rows[ri]
                        cells = [c.text.strip() for c in row.cells]
                        name = cells[0] if cells else ""
                        # Check if any cell says "Ranked", "Band", "Star" etc.
                        row_text = " ".join(cells).lower()
                        if any(k in row_text for k in ['ranked', 'band', 'star', 'tier']):
                            if name and name.lower() not in ['name', '']:
                                result["ranked_lawyers"].append(name)
                    
                    if result["ranked_lawyers"]:
                        result["has_ranking_evidence"] = True
                        if result["evidence_type"] == "none":
                            result["evidence_type"] = "implicit"
                            result["evidence_text"] = f"B9 table lists {len(result['ranked_lawyers'])} lawyers with ranking indicators"
            
        except Exception as e:
            result["error"] = str(e)
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
        
        return result

    # =====================================================
    # v14.1 PRE-FLIGHT GATE — Rule 73: Directory Template Detector
    # Auto-detects directory format, practice area, jurisdiction
    # from the DOCX structure itself — independent of user input.
    # =====================================================
    @staticmethod
    def detect_directory_template(file_path: str) -> dict:
        """
        Rule 73: Auto-detect directory, practice area, jurisdiction, and firm name
        from the DOCX template structure.
        
        Chambers: Has A1 (Firm name), A2 (Practice Area), A3 (Location) tables
        Legal 500: Different structure — firm name in first table, practice area 
                   in department area, matter tables use different patterns
        
        Returns:
            {
                "detected_directory": str,    # "Chambers" | "Legal 500" | "IFLR1000" | "Unknown"
                "detected_firm_name": str,
                "detected_practice_area": str,
                "detected_jurisdiction": str,
                "confidence": str,            # "high" | "medium" | "low"
                "detection_signals": list,    # What signals were used
            }
        """
        is_url = file_path.startswith('http://') or file_path.startswith('https://')
        parsed_path = urlparse(file_path).path if is_url else file_path
        extension = os.path.splitext(parsed_path)[1].lower()
        
        result = {
            "detected_directory": "Unknown",
            "detected_firm_name": "",
            "detected_practice_area": "",
            "detected_jurisdiction": "",
            "confidence": "low",
            "detection_signals": [],
        }
        
        if extension != '.docx':
            return result
        
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
            
            if len(doc.tables) < 3:
                return result
            
            # === CHAMBERS DETECTION ===
            # Chambers templates have: T0 = "A1 Firm name", T1 = "A2 Practice Area", T2 = "A3 Location"
            t0_header = doc.tables[0].rows[0].cells[0].text.strip().lower() if doc.tables[0].rows else ""
            t1_header = doc.tables[1].rows[0].cells[0].text.strip().lower() if len(doc.tables) > 1 and doc.tables[1].rows else ""
            t2_header = doc.tables[2].rows[0].cells[0].text.strip().lower() if len(doc.tables) > 2 and doc.tables[2].rows else ""
            
            is_chambers = (
                ('a1' in t0_header and 'firm' in t0_header) or
                ('a2' in t1_header and 'practice' in t1_header) or
                ('a3' in t2_header and 'location' in t2_header)
            )
            
            if is_chambers:
                result["detected_directory"] = "Chambers"
                result["confidence"] = "high"
                result["detection_signals"].append("Chambers A1/A2/A3 table structure detected")
                
                # Extract firm name (T0 R1)
                if len(doc.tables[0].rows) > 1:
                    result["detected_firm_name"] = doc.tables[0].rows[1].cells[0].text.strip()
                
                # Extract practice area (T1 R1)
                if len(doc.tables) > 1 and len(doc.tables[1].rows) > 1:
                    result["detected_practice_area"] = doc.tables[1].rows[1].cells[0].text.strip()
                
                # Extract jurisdiction (T2 R1)
                if len(doc.tables) > 2 and len(doc.tables[2].rows) > 1:
                    result["detected_jurisdiction"] = doc.tables[2].rows[1].cells[0].text.strip()
                
                return result
            
            # === LEGAL 500 DETECTION ===
            # Legal 500 templates: T0 = firm name (1 row), matter tables have "Publishable matter" / "Non-publishable matter"
            has_legal500_matters = False
            for ti, table in enumerate(doc.tables):
                if table.rows:
                    first_cell = table.rows[0].cells[0].text.strip().lower()
                    if re.match(r'^(?:publishable|non-publishable)\s+matter', first_cell):
                        has_legal500_matters = True
                        result["detection_signals"].append(f"Legal 500 matter format at table {ti}")
                        break
            
            # Legal 500 also has "leading partner 1", "next generation partner 1" etc.
            has_legal500_lawyers = False
            for ti, table in enumerate(doc.tables):
                if table.rows:
                    first_cell = table.rows[0].cells[0].text.strip().lower()
                    if 'leading partner' in first_cell or 'next generation partner' in first_cell:
                        has_legal500_lawyers = True
                        result["detection_signals"].append(f"Legal 500 lawyer format at table {ti}")
                        break
            
            if has_legal500_matters or has_legal500_lawyers:
                result["detected_directory"] = "Legal 500"
                result["confidence"] = "high" if (has_legal500_matters and has_legal500_lawyers) else "medium"
                
                # Firm name — usually T0 R0 (single-row table)
                if len(doc.tables[0].rows) == 1:
                    result["detected_firm_name"] = doc.tables[0].rows[0].cells[0].text.strip()
                
                # Practice area — try to find in file name or in known tables
                # Legal 500 doesn't have a clean "A2 Practice Area" — scan for it
                file_name = os.path.basename(parsed_path).lower()
                for pa in ['labour', 'employment', 'banking', 'finance', 'corporate', 'disputes', 
                          'tax', 'real estate', 'intellectual property', 'energy', 'competition']:
                    if pa in file_name:
                        result["detected_practice_area"] = pa.title()
                        result["detection_signals"].append(f"Practice area '{pa}' detected from filename")
                        break
                
                # Jurisdiction from lawyer locations
                for ti, table in enumerate(doc.tables):
                    if table.rows and len(table.rows) > 1:
                        header = table.rows[0].cells[0].text.strip().lower()
                        if header == 'name' and len(table.rows[0].cells) > 1:
                            loc_header = table.rows[0].cells[-1].text.strip().lower()
                            if 'location' in loc_header:
                                for ri in range(1, len(table.rows)):
                                    loc = table.rows[ri].cells[-1].text.strip()
                                    if loc and loc.lower() not in ['location', '']:
                                        result["detected_jurisdiction"] = loc
                                        break
                                break
                
                return result
            
            # === FALLBACK: Try filename ===
            file_name_lower = os.path.basename(parsed_path).lower()
            if 'chambers' in file_name_lower:
                result["detected_directory"] = "Chambers"
                result["confidence"] = "medium"
                result["detection_signals"].append("Directory 'Chambers' detected from filename")
            elif 'legal 500' in file_name_lower or 'legal500' in file_name_lower:
                result["detected_directory"] = "Legal 500"
                result["confidence"] = "medium"
                result["detection_signals"].append("Directory 'Legal 500' detected from filename")
            elif 'iflr' in file_name_lower:
                result["detected_directory"] = "IFLR1000"
                result["confidence"] = "medium"
                result["detection_signals"].append("Directory 'IFLR1000' detected from filename")
            
        except Exception as e:
            result["error"] = str(e)
        finally:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
        
        return result