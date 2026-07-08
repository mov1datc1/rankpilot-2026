import fitz  # PyMuPDF
from docx import Document
import os

class DocumentParser:
    """
    Utility class to handle multi-format document ingestion (PDF & DOCX).
    Ensures text is extracted cleanly for LLM processing.
    """
    
    @staticmethod
    def parse(file_path: str) -> str:
        extension = os.path.splitext(file_path)[1].lower()
        
        if extension == '.docx':
            return DocumentParser._parse_docx(file_path)
        elif extension == '.pdf':
            return DocumentParser._parse_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file format: {extension}")

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