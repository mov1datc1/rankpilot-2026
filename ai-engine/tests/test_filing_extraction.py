import unittest
from utils.filing_extraction import extract_filing_fields, resolve_filing_fields

class FilingExtractionTests(unittest.TestCase):
    def test_department_totals_survive_without_using_firm_totals(self):
        text='Composition of the firm:\nNumber of Partners | Number of Counsels/Associates\n29 | 120\n\nComposition of the department:\nNumber of Male Partners | Number of Female Partners | Number of Counsels/Associates\n3 | 2 | 17\n'
        result=extract_filing_fields(text)
        self.assertEqual(result['filing_details'],{'numPartners':5,'numLawyers':17})
        self.assertIn('3 | 2 | 17',result['filing_evidence']['numPartners'][0]['quote'])
    def test_unknown_is_not_zero_and_partial_gender_counts_are_not_summed(self):
        result=extract_filing_fields('Composition of the department:\nNumber of Male Partners | Number of Female Partners | Number of Counsels/Associates\n3 |  | 0\n')
        self.assertNotIn('numPartners',result['filing_details'])
        self.assertEqual(result['filing_details']['numLawyers'],0)
        self.assertEqual(extract_filing_fields('Composition of the firm:\nNumber of Partners | Number of Counsels/Associates\n9 | 43\n')['filing_details'],{})
    def test_multiple_sources_disagreement_is_preserved_not_chosen(self):
        a=extract_filing_fields('B2 Number of partners\n4\nB3 Number of other qualified lawyers\n20\n')
        b=extract_filing_fields('B2 Number of partners: 7\n');a['source']='one.docx';b['source']='two.pdf'
        merged=resolve_filing_fields([a,b])
        self.assertEqual(merged['filing_field_status']['numPartners'],'conflicting')
        self.assertNotIn('numPartners',merged['filing_details'])
        self.assertEqual([e['source'] for e in merged['filing_evidence']['numPartners']],['one.docx','two.pdf'])
    def test_explicit_name_without_promoting_next_header(self):
        self.assertEqual(extract_filing_fields('B1 Department name (used by firm)\nTax Litigation\nB2 Number of partners\n2\n')['filing_details']['departmentName'],'Tax Litigation')
        self.assertNotIn('departmentName',extract_filing_fields('B1 Department name (used by firm)\nB2 Number of partners\n2\n')['filing_details'])
    def test_same_fields_from_real_docx_and_pdf_readers(self):
        import tempfile
        from pathlib import Path
        import fitz
        from docx import Document
        from utils.document_preflight import read_document
        content='B1 Department name (used by firm)\nCommercial disputes\nB2 Number of partners\n6\nB3 Number of other qualified lawyers\n19\n'
        with tempfile.TemporaryDirectory() as folder:
            word=Path(folder)/'new.docx';pdf=Path(folder)/'new.pdf'
            document=Document()
            for line in content.splitlines(): document.add_paragraph(line)
            document.save(word)
            document=fitz.open();page=document.new_page();page.insert_text((50,50),content);document.save(pdf);document.close()
            for path in (word,pdf):
                text,_=read_document(str(path))
                self.assertEqual(extract_filing_fields(text)['filing_details'],{'departmentName':'Commercial disputes','numPartners':6,'numLawyers':19})
    def test_explicit_contact_tables_keep_contact_roles_separate(self):
        result=extract_filing_fields('A4 Contact for arranging interviews\nName | Email | Telephone number\nAlex River | alex@example.test | +52 555 1234567\nB1 Department name\nTax\nB7 Head or Heads of department\nName | Email | Telephone number\nCasey Hill | casey@example.test | \nB8 Hires\n')
        self.assertEqual(result['filing_details']['contacts'][0]['name'],'Alex River')
        self.assertEqual(result['filing_details']['departmentHeads'][0]['name'],'Casey Hill')
        self.assertEqual(result['filing_details']['departmentName'],'Tax')

    def test_unstructured_evidence_merges_without_silencing_conflicts(self):
        from utils.filing_extraction import merge_model_filing_fields
        text='B2 Number of partners: 4\nLa práctica cuenta con seis socios. Ana Sol dirige el departamento.'
        findings=[{'field':'numPartners','number_value':6,'source_quote':'La práctica cuenta con seis socios.'}, {'field':'departmentHeads','people':[{'name':'Ana Sol','email':'','phone':''}],'source_quote':'Ana Sol dirige el departamento.'}, {'field':'numLawyers','number_value':7,'source_quote':'Invented seven lawyers'}]
        result=merge_model_filing_fields(extract_filing_fields(text),findings,text)
        self.assertEqual(result['filing_field_status']['numPartners'],'conflicting')
        self.assertNotIn('numPartners',result['filing_details'])
        self.assertNotIn('numLawyers',result['filing_details'])
        self.assertEqual(result['filing_details']['departmentHeads'][0]['name'],'Ana Sol')
