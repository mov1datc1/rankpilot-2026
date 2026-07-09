from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os

def generate_docx_report(structured_data: dict, output_filename: str) -> str:
    """
    Generates a professional DOCX report using python-docx.
    """
    doc = Document()
    
    # 1. Styling the Title
    title = doc.add_heading(level=0)
    title_run = title.add_run('RANKPILOT INTELLIGENCE\nSTRATEGIC DIAGNOSTIC SNAPSHOT™')
    title_run.font.color.rgb = RGBColor(26, 35, 126) # Brand Navy
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    firm_name = structured_data.get('firm_metadata', {}).get('firm_name', 'Professional Law Firm')
    practice_area = structured_data.get('firm_metadata', {}).get('practice_area', 'General Practice')
    
    doc.add_paragraph(f"Firm: {firm_name}").alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(f"Practice Area: {practice_area}").alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_page_break()

    # 2. Add Matters
    doc.add_heading('Optimized Matters for Submission', level=1)
    
    matters = structured_data.get('matters', [])
    for idx, matter in enumerate(matters, 1):
        doc.add_heading(f"Matter {idx}: {matter.get('name', 'Untitled')}", level=2)
        
        p = doc.add_paragraph()
        p.add_run('Client: ').bold = True
        p.add_run(f"{matter.get('client', 'N/A')}\n")
        
        p.add_run('Value: ').bold = True
        p.add_run(f"{matter.get('value', 'N/A')}\n")
        
        p.add_run('Lead Partner: ').bold = True
        p.add_run(f"{matter.get('lead_partner', 'N/A')}\n")
        
        doc.add_paragraph(matter.get('description', ''))
        
        # Add a subtle separator
        doc.add_paragraph("_" * 50)
        
    # Save the document
    file_path = f"{output_filename}.docx"
    doc.save(file_path)
    return file_path
