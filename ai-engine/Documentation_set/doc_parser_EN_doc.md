## Overview
Provides a utility class for parsing PDF and DOCX documents into plain text, ensuring clean text extraction suitable for LLM processing.

## Classes
- **DocumentParser**: Handles multi-format document ingestion by routing to format-specific parsers.

## Functions & Methods
| Name | Parameters | Responsibility |
|------|------------|----------------|
| parse | file_path: str | Determines file format and delegates to appropriate parser (DOCX or PDF); raises error for unsupported formats. |
| _parse_docx | file_path: str | Extracts text from DOCX files by concatenating non-empty paragraphs and table rows (cells separated by " | "). |
| _parse_pdf | file_path: str | Extracts text from PDF files using PyMuPDF, concatenating text from all pages. |