import fitz  # PyMuPDF
from docx import Document
import os
import tempfile
import urllib.request
from urllib.parse import urlparse

class DocumentParser:
    """
    Utility class to handle multi-format document ingestion (PDF & DOCX).
    Ensures text is extracted cleanly for LLM processing.
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

# Example Usage for your prototype:
# text = DocumentParser.parse("uploads/perez_correa.docx")