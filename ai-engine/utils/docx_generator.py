from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os

def generate_docx_report(structured_data: dict, output_filename: str) -> str:
    """
    Generates a professional DOCX report using python-docx by appending to the official template.
    """
    template_path = os.path.join(os.path.dirname(__file__), '..', 'templates', 'chambers_template.docx')
    
    if os.path.exists(template_path):
        doc = Document(template_path)
    else:
        doc = Document()
        title = doc.add_heading(level=0)
        title_run = title.add_run('RANKPILOT OFFICIAL SUBMISSION')
        title_run.font.color.rgb = RGBColor(26, 35, 126) # Brand Navy
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
    firm_name = structured_data.get('firm_metadata', {}).get('firm_name', 'Professional Law Firm')
    practice_area = structured_data.get('firm_metadata', {}).get('practice_area', 'General Practice')
    
    # Extraer los datos estratégicos de la sesión
    chambers_data = structured_data.get('chambersData', {})
    analysis = chambers_data.get('analysis', {})
    context = chambers_data.get('strategicContext', {})
    letter = analysis.get('audit_letter', {})

    doc.add_page_break()
    audit_title = doc.add_heading('Strategic Audit Letter', level=1)
    audit_title.runs[0].font.color.rgb = RGBColor(26, 35, 126)
    
    # Metadatos del Audit
    p_meta = doc.add_paragraph()
    p_meta.add_run('To: ').bold = True
    p_meta.add_run('The Board of Directors at the Firm\n')
    p_meta.add_run('From: ').bold = True
    p_meta.add_run('RankPilot Consulting\n')

    # Executive Summary
    if analysis.get('summary'):
        doc.add_heading('Executive Summary', level=2)
        p_sum = doc.add_paragraph(str(analysis.get('summary')))
        p_sum.italic = True

    # State of Play
    if letter.get('the_state_of_play'):
        doc.add_heading('The State of Play', level=2)
        doc.add_paragraph(str(letter.get('the_state_of_play')))

    # Reality Check
    reality = letter.get('the_reality_check', [])
    if reality and isinstance(reality, list):
        doc.add_heading('The Reality Check', level=2)
        doc.add_paragraph('The submission is currently held back by avoidable defects:')
        for item in reality:
            doc.add_paragraph(str(item), style='List Bullet')

    # Path to Dominance
    path = letter.get('the_path_to_dominance', [])
    if path and isinstance(path, list):
        doc.add_heading('The Path to Dominance', level=2)
        for idx, step in enumerate(path, 1):
            title = step.get('title', 'Strategic Step') if isinstance(step, dict) else 'Strategic Step'
            desc = step.get('description', str(step)) if isinstance(step, dict) else str(step)
            p_step = doc.add_paragraph()
            p_step.add_run(f"STEP {idx}: {title}").bold = True
            doc.add_paragraph(desc)

    # Matters Section
    doc.add_page_break()
    doc.add_heading('Portfolio Analysis (Matters)', level=1)
    
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
        doc.add_paragraph("_" * 50)
        
    # Save the document
    file_path = f"{output_filename}.docx"
    doc.save(file_path)
    return file_path
